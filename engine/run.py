#!/usr/bin/env python3
"""Engine orchestrator.

  python3 run.py                 full run: collect -> match -> export -> assert contract
  python3 run.py --only pantallas,celulares
  python3 run.py --refresh       SCHEDULED mode: expire price-bearing cache
                                 entries older than 20h and re-fetch them
  python3 run.py --max-age 6     same, with an explicit TTL in hours
  python3 run.py --sources norte restrict which adapters run (measurement)

By default everything is cache-first and a re-run costs zero network requests —
that is right for iteration and wrong for a collector. Without a TTL a daily job
would re-serve the same cached bodies forever, write the same prices back, and
record no new price history while still reporting success. `--refresh` expires
ONLY the price-bearing fetches (retailer category pages, PDPs, the FX rate).

Outputs (the artifact contract, all under ../web/public/data/):
  index.json  products.json  categories.json  branches.json  history.json  meta.json
plus engine-side audit surfaces: metrics.json, match-audit.csv,
review-queue.json, near-miss-overlap.csv, variant-collapse.csv, featured-audit.json.

Stages that exist in production and are omitted from this snapshot: product
image download + WebP derivation + object-storage sync, retailer branch
directories (geocoded), CR and US review capture, the US price benchmark, and
the IndexNow ping after publish. Every one of them is additive on top of what
is here; the artifact fields they fill are emitted as null / empty so the web
app's contract is unchanged.
"""
import csv
import hashlib
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import db
import export
import fetcher
import featured as featured_mod
import retailers
from export import ContractError
from fetcher import fetch_json
from match import run_matching, build_products, collapse_variants
from normalize import clean
from catprofile import load_profiles

ENGINE = Path(__file__).parent
WEB = ENGINE.parent / "web" / "public"
WEB_DATA = WEB / "data"
# The FX rate IS a price: production reads the central bank's daily selling
# rate (BCCR, via api.hacienda.go.cr) under the same --refresh TTL as every
# other price. This snapshot reads a fixture with the same shape; point
# VALE_FX_URL at the real endpoint to restore the live read.
FX_URL = os.environ.get("VALE_FX_URL") or (ENGINE / "fixtures" / "fx.json").resolve().as_uri()
# 20h, not 24h: a job that runs at the same clock time every day would find a
# 24h-old body 23h59m old and skip it, so the collector would silently do
# nothing on most days. 20h always expires yesterday's bytes and never expires
# bytes fetched earlier the same day.
REFRESH_MAX_AGE_H = 20
IMAGE_WIDTHS = (160, 320, 640)


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def store_offers(con, raw_offers, category):
    """`scraped_at` is the adapter's real retrieval time, NOT the run clock.

    The engine is cache-first by design, so a 30-second re-run can serve prices
    fetched hours ago; stamping those with now() published a specific untrue
    claim ("Precios verificados: 4:50 p.m.") over three-hour-old data, and the
    lie grew with every re-run. Export time still exists and is still honest —
    it is `meta.generated_at`, which answers a different question.
    If an adapter cannot say when it fetched, we fall back to now() rather than
    emit null, and the freshness distribution in metrics.json makes the real
    ages visible instead of something anyone has to remember to check.

    price_point policy — ONE ROW PER OBSERVATION, not per change.
    A row used to be written only when content_hash moved, so a price that
    held steady for a month left a single point and the series could not
    distinguish "stable" from "not collected". A flat line is real history and
    is exactly what proves stability to a user, so the trigger is now a NEW
    RETRIEVAL: a row is written whenever this offer's `scraped_at` differs from
    its newest recorded observation. That keeps a zero-network re-run idempotent
    (same cached bytes -> same scraped_at -> no duplicate row) while a --refresh
    run records a point every day whether or not the number moved.
    """
    fallback = now_iso()
    observations = 0
    for o in raw_offers:
        ts = o.get("fetched_at") or fallback
        row = con.execute("SELECT id, content_hash, cash_price_crc, scraped_at"
                          " FROM offer WHERE url=?", (o["url"],)).fetchone()
        # NEVER let an older retrieval overwrite a newer one. The featured-slot
        # re-verification fetches live prices at export time and persists them,
        # so the DB can legitimately hold a price NEWER than the cached category
        # page a later run parses. Measured: a chain cut a price and the
        # re-verification recorded it; the next cache-first run re-read the
        # same stale page and published the old price — a price this engine had
        # already proven wrong, under a 31% gap that did not exist.
        # The freshest observation wins, whichever path produced it.
        if row and row["scraped_at"] and row["scraped_at"] > ts:
            o["cash_price_crc"], ts = row["cash_price_crc"], row["scraped_at"]
        ch = retailers.content_hash(o)
        credit = json.dumps(o["credit"]) if o.get("credit") else None
        if row:
            oid = row["id"]
            con.execute(
                "UPDATE offer SET raw_title=?, ean=?, cash_price_crc=?, list_price_crc=?,"
                " in_stock=?, credit_json=?, content_hash=?, scraped_at=?, sku=?, category=?"
                " WHERE id=?",
                (o["raw_title"], o["ean"], o["cash_price_crc"], o["list_price_crc"],
                 int(o["in_stock"]), credit, ch, ts, o.get("sku"), category, oid))
            newest = con.execute(
                "SELECT MAX(observed_at) AS t FROM price_point WHERE offer_id=?",
                (oid,)).fetchone()["t"]
            # strictly newer, not merely different: `!=` let the series
            # oscillate between the re-verification stamp and the cached page
            # stamp and inflated `observations` — the very field the UI trusts
            # when deciding whether a trend is claimable.
            if newest is None or newest < ts:
                con.execute("INSERT INTO price_point VALUES (?,?,?)",
                            (oid, o["cash_price_crc"], ts))
                observations += 1
            o["id"] = oid
        else:
            cur = con.execute(
                "INSERT INTO offer(retailer_id, raw_title, raw_model, ean, url, cash_price_crc,"
                " list_price_crc, in_stock, credit_json, content_hash, scraped_at, sku, category)"
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (o["retailer_id"], o["raw_title"], o.get("model_hint"), o["ean"], o["url"],
                 o["cash_price_crc"], o["list_price_crc"], int(o["in_stock"]), credit, ch, ts,
                 o.get("sku"), category))
            con.execute("INSERT INTO price_point VALUES (?,?,?)",
                        (cur.lastrowid, o["cash_price_crc"], ts))
            observations += 1
            o["id"] = cur.lastrowid
        o["scraped_at"] = ts
    con.commit()
    return observations


def _url_key(url: str) -> str:
    return hashlib.sha256((url or "").encode()).hexdigest()[:8]


def _collapse_rows(profile, variants):
    """Hand-check surface for the collapse: every folded group, in full."""
    rows = []
    for rep_id, members in sorted(variants.items()):
        for o in members:
            rows.append([profile.id, rep_id, "rep" if o["id"] == rep_id else "variant",
                         o["retailer"], o["raw_title"],
                         int(o["cash_price_crc"] or 0), o["url"]])
    return rows


def _reconcile_collapsible(products, variants, by_id, profile):
    """A collapsed group covers several colours, so the product must not claim
    one of them. A collapsible attribute survives only when EVERY underlying
    listing agrees on the same non-null value; anything else is null, i.e.
    "varies". Unanimity is required rather than "one distinct non-null value"
    because unparsed colours are common — one recognized `Azul Oscuro` among
    three colours must not make the product blue."""
    if not profile.collapsible_keys:
        return
    for p in products:
        listings = [by_id[oid] for oid in p["offer_ids"]]
        for oid in p["offer_ids"]:
            listings.extend(o for o in variants.get(oid, []) if o["id"] != oid)
        for key in profile.collapsible_keys:
            vals = {profile.attributes_of(clean(o["raw_title"]))[key] for o in listings}
            p["attributes"][key] = vals.pop() if len(vals) == 1 and None not in vals else None


def overlap_report(products):
    """The number that decides whether this is a business or a demo.

    Catalogue size is not the metric — a source that adds 200 products nobody
    else sells adds nothing a shopper can act on. What matters is how many
    products can be COMPARED (>=2 chains) and, of those, how many carry a gap
    worth the trip. Reported per retailer as well, so a source that contributes
    catalogue but no comparisons is visible as such instead of being counted as
    a win by product count.
    """
    comparable = [p for p in products if p["retailer_count"] > 1]
    gaps = []
    for p in comparable:
        prices = [o["price_crc"] for o in p["offers"]]
        lo, hi = min(prices), max(prices)
        gaps.append(100.0 * (hi - lo) / lo if lo else 0.0)
    gaps.sort()
    mid = len(gaps) // 2
    per_retailer = defaultdict(lambda: {"products": 0, "comparable": 0})
    for p in products:
        for o in p["offers"]:
            per_retailer[o["retailer"]]["products"] += 1
            if p["retailer_count"] > 1:
                per_retailer[o["retailer"]]["comparable"] += 1
    return {
        "products_total": len(products),
        "comparable_products": len(comparable),
        "comparable_pct": round(100 * len(comparable) / len(products), 1) if products else 0,
        "gap_ge_5pct": sum(1 for g in gaps if g >= 5),
        "gap_ge_20pct": sum(1 for g in gaps if g >= 20),
        "gap_median_pct": (round(gaps[mid] if len(gaps) % 2 else
                                 (gaps[mid - 1] + gaps[mid]) / 2, 1)) if gaps else None,
        "gap_max_pct": round(gaps[-1], 1) if gaps else None,
        "per_retailer": {r: dict(v) for r, v in sorted(per_retailer.items())},
        "basis": ("gap = (max price - min price) / min price across the offers of one "
                  "product; comparable = a product carried by more than one chain"),
    }


def assert_distinct_parents(products):
    """Two brands of one company are not competitors. If a future adapter ever
    joins a group already in the set, every 'compare and save' verdict built on
    that pair would be selling one retailer's own price discrimination as a
    shopping choice — so it fails the run instead of shipping quietly."""
    groups = defaultdict(set)
    for name in {o["retailer"] for p in products for o in p["offers"]}:
        parent = retailers.PARENT_COMPANY.get(name)
        if not parent:
            raise ContractError(f"retailer {name!r} has no declared parent company")
        groups[parent].add(name)
    shared = {p: sorted(n) for p, n in groups.items() if len(n) > 1}
    if shared:
        raise ContractError(
            f"these retailers share a parent company and cannot be presented as "
            f"competing chains: {shared}")
    return {p: sorted(n)[0] for p, n in groups.items()}


def slugger():
    used = set()

    def slugify(*parts):
        s = "-".join(str(p) for p in parts if p)
        s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "producto"
        base, n = s, 2
        while s in used:
            s, n = f"{base}-{n}", n + 1
        used.add(s)
        return s
    return slugify


def main():
    argv = sys.argv[1:]
    only = None
    if "--only" in argv:
        only = [c.strip() for c in argv[argv.index("--only") + 1].split(",")]
    # Records a DECISION, deliberately as a flag rather than a tolerance bump:
    # overriding the per-source collapse guard should appear in the command that
    # ran, not be absorbed into a constant somebody later forgets is loosened.
    allow_source_drop = "--allow-source-drop" in argv
    # price-cache TTL in seconds. None (the default) = cache never expires, so
    # an interactive re-run stays zero-network and byte-for-byte deterministic.
    max_age = None
    # `--sources norte,sur` restricts which adapters run. Its purpose is
    # measurement: the only honest way to state a new retailer's overlap gain
    # is to run the same pipeline with and without it.
    sources = None
    if "--sources" in argv:
        sources = {s.strip() for s in argv[argv.index("--sources") + 1].split(",")}
    if "--max-age" in argv:
        max_age = float(argv[argv.index("--max-age") + 1]) * 3600
    elif "--refresh" in argv:
        max_age = REFRESH_MAX_AGE_H * 3600

    profiles = load_profiles(only)
    print(f"== profiles: {', '.join(p.id for p in profiles)}")
    print(f"== price cache: {'never expires (interactive)' if max_age is None else f'expires after {max_age/3600:.0f}h (scheduled refresh)'}")
    con = db.connect()
    con.execute("DELETE FROM match_decision")
    con.execute("DELETE FROM product")

    slugify = slugger()
    all_products, all_review_q, all_accepted, raw_counts = [], [], [], {}
    # Hosts whose fetches exhausted every retry this run. Handed to the contract
    # so a per-source collapse can be told apart from a real catalogue change.
    failed_hosts = set()
    near_miss_rows, near_miss_groups, collapse_rows = [], 0, []
    price_observations = 0

    for profile in profiles:
        print(f"== {profile.id} ==")
        kept, counts = [], {}
        for adapter in retailers.ADAPTERS:
            src = profile.sources.get(adapter.id)
            if src is None or (sources and adapter.id not in sources):
                counts[adapter.id] = {"scraped": 0, "kept": 0, "skipped": "not a source"}
                continue
            # a source can be declared, working and documented but not worth its
            # collection cost — disabling it in the profile keeps the adapter and
            # its measurement while keeping it off the daily timer
            if src.get("disabled") and not (sources and adapter.id in sources):
                counts[adapter.id] = {"scraped": 0, "kept": 0,
                                      "skipped": src.get("disabled_reason", "disabled")}
                print(f"  {adapter.id}: disabled — {src.get('disabled_reason', '')}")
                continue
            # Snapshot the fetch-failure ledger around this source so a zero
            # can be attributed. WITHOUT THIS, "norte: 0 scraped, 0 kept" is
            # printed identically whether the shop stocks nothing or whether
            # every request to it timed out — which is exactly how a transient
            # burst once passed for a healthy run. Adapters catch their own
            # fetch errors and `break` (at the call site a failure and an empty
            # page really are indistinguishable), so the attribution has to
            # happen out here, around the call.
            _f0 = len(fetcher.fetch_failures())
            try:
                batch = adapter.fetch_category(profile, max_age=max_age)
            except Exception as e:                       # one dead source must not kill the run
                print(f"  {adapter.id}: FAILED {e!r}")
                counts[adapter.id] = {"scraped": 0, "kept": 0, "error": repr(e)}
                for fx in fetcher.fetch_failures()[_f0:]:
                    failed_hosts.add(fx["host"])
                continue
            new_fails = fetcher.fetch_failures()[_f0:]
            for fx in new_fails:
                failed_hosts.add(fx["host"])
            trusted = profile.trusts(adapter.id)
            good = [o for o in batch
                    if profile.keeps(clean(o["raw_title"]), o["cash_price_crc"], trusted)]
            counts[adapter.id] = {"scraped": len(batch), "kept": len(good)}
            if new_fails:
                counts[adapter.id]["fetch_failures"] = len(new_fails)
            # A zero with failures behind it is never printed the same way as a
            # zero without them.
            note = ""
            if new_fails:
                note = (f"   WARNING: {len(new_fails)} FETCH FAILURE(S) — this count is "
                        f"a floor, not a measurement: {new_fails[0]['reason'][:70]}")
            print(f"  {adapter.id}: {len(batch)} scraped, {len(good)} kept{note}")
            kept.extend(good)
        raw_counts[profile.id] = counts
        if not kept:
            continue

        price_observations += store_offers(con, kept, profile.id)
        # Colour variants collapse BEFORE matching: every raw listing is stored
        # and price-tracked, but one SKU published once per colour enters the
        # matcher once, so Tier 2 sees an unambiguous pair instead of a 4-offer
        # group. The auto-accept rule itself is untouched.
        reps, variants = collapse_variants(kept, profile)
        collapsed = sum(len(v) for v in variants.values()) - len(variants)
        if collapsed:
            print(f"  colour-variant collapse: {len(kept)} listings -> {len(reps)} offers "
                  f"({collapsed} folded into {len(variants)} groups)")
            collapse_rows.extend(_collapse_rows(profile, variants))
        by_id = {o["id"]: o for o in reps}
        norm, accepted, review = run_matching(reps, profile)
        products = build_products(reps, norm, accepted, profile)
        _reconcile_collapsible(products, variants, by_id, profile)
        all_review_q.extend(review)
        all_accepted.extend((profile.id, *a) for a in accepted)

        prod_rows = []
        for p in products:
            cur = con.execute(
                "INSERT INTO product(brand, model_number, normalized_name, category, specs_json)"
                " VALUES (?,?,?,?,?)",
                (p["brand"], p["model"], norm[p["canonical_offer_id"]]["name_clean"],
                 profile.id, json.dumps(p["attributes"])))
            p["product_id"] = cur.lastrowid
            for oid in p["offer_ids"]:
                # every collapsed colour variant belongs to the product too —
                # the DB keeps the raw listings and their price history
                for vid in [v["id"] for v in variants.get(oid, [])] or [oid]:
                    con.execute("UPDATE offer SET product_id=? WHERE id=?",
                                (p["product_id"], vid))
            prod_rows.append(p)
        for a, b, method, score, decided_by in accepted:
            pid = next(x["product_id"] for x in prod_rows if a in x["offer_ids"])
            for oid in (a, b):
                con.execute("INSERT INTO match_decision VALUES (?,?,?,?,?,?)",
                            (oid, pid, method, score, decided_by, now_iso()))
        con.commit()

        multi = [p for p in prod_rows
                 if len({by_id[i]["retailer_id"] for i in p["offer_ids"]}) > 1]
        print(f"  {len(reps)} offers -> {len(prod_rows)} products, {len(multi)} multi-retailer")

        # ---- near-miss overlap (independent evidence surface for the matcher)
        prod_of = {oid: p["product_id"] for p in prod_rows for oid in p["offer_ids"]}
        groups = defaultdict(list)
        for o in reps:
            n = norm[o["id"]]
            fp = profile.fingerprint_of(n["brand"], n["attributes"])
            if fp:
                groups[fp].append(o["id"])
        for fp, ids in sorted(groups.items(), key=lambda kv: str(kv[0])):
            if len({by_id[i]["retailer_id"] for i in ids}) < 2:
                continue
            if len({prod_of[i] for i in ids}) < 2:
                continue
            near_miss_groups += 1
            for i in sorted(ids, key=lambda x: by_id[x]["retailer_id"]):
                near_miss_rows.append([profile.id, " | ".join(map(str, fp)),
                                       by_id[i]["retailer"], by_id[i]["raw_title"],
                                       norm[i]["model"] or "", by_id[i]["cash_price_crc"]])

        # ---- assemble the export records
        for p in sorted(prod_rows, key=lambda x: -len(x["offer_ids"])):
            offers_out = []
            for oid in p["offer_ids"]:
                o = by_id[oid]
                # a collapsed group is ONE offer at the cheapest colour's price;
                # variant_count + variant_price_max_crc keep that visible instead
                # of hiding that the other colours cost more ("desde ₡X")
                group = variants.get(oid, [o])
                group_prices = [int(round(v["cash_price_crc"])) for v in group
                                if v["cash_price_crc"]]
                price = int(round(o["cash_price_crc"])) if o["cash_price_crc"] else None
                offers_out.append({
                    "retailer": o["retailer"],
                    "price_crc": price,
                    "list_price_crc": int(round(o["list_price_crc"])) if o["list_price_crc"] else None,
                    "in_stock": bool(o["in_stock"]),
                    "url": o["url"],
                    "credit": o.get("credit"),
                    "variant_count": len(group),
                    "variant_price_max_crc": (max(group_prices)
                                              if group_prices and max(group_prices) != price
                                              else None),
                    "scraped_at": o["scraped_at"],
                })
            offers_out.sort(key=lambda x: x["price_crc"] or 9_000_000_000_000)
            # at most ONE offer per retailer (cheapest survives) — a duplicate
            # retailer row renders as a broken-looking double line in the UI
            seen_ret, deduped = set(), []
            for off in offers_out:
                if off["retailer"] in seen_ret or off["price_crc"] is None:
                    continue
                seen_ret.add(off["retailer"])
                deduped.append(off)
            if not deduped:
                continue
            can = by_id[p["canonical_offer_id"]]
            all_products.append({
                # slug must be STABLE across runs: the DB rowid is not (the
                # product table is rebuilt every run), so a product with no
                # model number is keyed by a hash of its canonical offer URL.
                "id": slugify(p["brand"], p["model"]) if p["model"] else
                      slugify(p["brand"] or can["raw_title"][:40], _url_key(can["url"])),
                "category": profile.id,
                "brand": p["brand"],
                "model": p["model"],
                "name": can["raw_title"],
                "image": None,
                "image_srcset": None,
                "attributes": p["attributes"],
                "offers": deduped,
                "retailer_count": len(seen_ret),
                "reviews": {"cr": None, "us": None},
                "us_reference": None,
                "markup_pct": None,
                "markup_basis": "pre_tax",
                "scraped_at": max(o["scraped_at"] for o in deduped),
                "_product_id": p["product_id"],
                "_offer_ids": p["offer_ids"],
            })

    # ------------------------------------------------- featured re-verification
    print("== featured slot (live price re-verification) ==")
    # Match-tier floor before the gap ranking is sliced: the slot states a
    # verdict at 44px, so it renders an exact identifier or nothing.
    exact_ids = featured_mod.exact_match_ids(all_products, all_accepted)
    cands = featured_mod.candidates(all_products, exact_ids=exact_ids)
    cand_seen = len(cands)
    print(f"  {len(exact_ids)} products carry an exact-identifier match; "
          f"{cand_seen} clear the gap floor and are eligible")
    feat, feat_dropped, corrections, feat_audit = featured_mod.verify(
        cands, retailers.BY_DISPLAY_NAME, now_iso)
    for c in corrections:
        con.execute("UPDATE offer SET cash_price_crc=?, scraped_at=? WHERE url=?",
                    (c["price_crc"], c["scraped_at"], c["url"]))
        if c["price_moved"]:      # price_point is append-only observation history
            con.execute("INSERT INTO price_point SELECT id, ?, ? FROM offer WHERE url=?",
                        (c["price_crc"], c["scraped_at"], c["url"]))
    con.commit()
    feat_policy = featured_mod.policy(cand_seen, feat_dropped, feat_audit)
    print(f"  {cand_seen} candidates re-fetched, {feat_policy['products_with_price_change']} "
          f"changed price, {len(feat_dropped)} dropped "
          f"({feat_policy['drop_rate_pct']}%), {len(feat)} featured")

    # -------------------------------------------------------------------- FX
    print("== FX ==")
    # the FX rate IS a price: a scheduled run that keeps yesterday's rate
    # publishes a stale US comparison under a fresh timestamp
    fx = fetch_json(FX_URL, max_age=max_age)
    fx_rate, fx_date = fx["venta"]["valor"], fx["venta"]["fecha"]
    print(f"  venta {fx_rate} CRC/USD ({fx_date})")

    # ---------------------------------------------------------------- export
    print("== export ==")
    for p in all_products:
        for k in ("_product_id", "_offer_ids"):
            p.pop(k, None)
    category_counts = defaultdict(int)
    for p in all_products:
        category_counts[p["category"]] += 1
    # EVERY PRODUCT CARRIES ITS OWN BAND INDEX, so that no surface in the app
    # ever bins a gap in the browser. The band is the amber ramp's step on the
    # spread bar; emitting it here means the bin edges exist in exactly one
    # place (export.GAP_BIN_EDGES) and travel with the data. `None` where there
    # is nothing to band — a single-offer product has no gap, which is NOT band 0.
    for p in all_products:
        pr = [o["price_crc"] for o in p["offers"] if o["price_crc"]]
        p["gap_band"] = (export.gap_band(100 * (max(pr) - min(pr)) / min(pr))
                         if len(pr) > 1 and min(pr) else None)
    # export time — honest, useful, and a DIFFERENT question from "how old is
    # this price". The two are allowed to differ; that difference is the point.
    generated_at = now_iso()
    meta = {
        "fx_rate_crc_usd": fx_rate,
        "fx_rate_date": fx_date,
        "fx_source": fx.get("source", "BCCR (tipo de cambio venta, via api.hacienda.go.cr)"),
        "generated_at": generated_at,
        # the chains actually PRESENT in this dataset, with the group each
        # belongs to. Derived from the offers rather than from the adapter list:
        # "chains checked" is a trust claim in the UI, and a declared-but-empty
        # adapter would have made it a false one.
        "retailers": [{"name": name, "parent_company": retailers.PARENT_COMPANY[name],
                       "products": sum(1 for p in all_products
                                       if any(o["retailer"] == name for o in p["offers"]))}
                      for name in sorted({o["retailer"] for p in all_products
                                          for o in p["offers"]})],
        "independent_groups": len({retailers.PARENT_COMPANY[name] for p in all_products
                                   for o in p["offers"] for name in [o["retailer"]]}),
        "product_count": len(all_products),
        "category_counts": dict(category_counts),
        "price_freshness": export.freshness(all_products, generated_at),
        # the spread bar's axis domain + the /brechas distribution, derived.
        # It gates every bar in the product, so it is emitted before any of them exist.
        "gap_distribution": export.gap_distribution(all_products),
        "featured": feat,
        "featured_policy": feat_policy,
        "featured_dropped": [{"id": d["id"], "reason": d["dropped_reason"],
                              "gap_before_crc": d["gap_before"]["gap_crc"],
                              "gap_after_crc": (d["gap_after"] or {}).get("gap_crc"),
                              "price_changes": d["price_changes"]} for d in feat_dropped],
        "branch_coverage": {},
        "image_coverage": {"self_hosted": 0, "of_products": len(all_products),
                           "widths": list(IMAGE_WIDTHS)},
        "honesty_note": ("Missing data is null, never fabricated or defaulted. "
                         "Branch stock is not published by any retailer; "
                         "availability is retailer-level only."),
    }
    # price history — read AFTER the featured re-verification, which corrects
    # prices and appends its own observations, so the newest point in the series
    # is the same number the card shows
    points_by_url = defaultdict(list)
    for r in con.execute("SELECT o.url, pp.cash_price_crc AS price, pp.observed_at AS ts"
                         " FROM price_point pp JOIN offer o ON o.id = pp.offer_id"):
        points_by_url[r["url"]].append((r["price"], r["ts"]))
    price_history = export.history(all_products, points_by_url, generated_at)
    meta["price_history"] = {
        "artifact": "/data/history.json",
        **{k: price_history[k] for k in ("observation_window", "products_with_history")},
        "note": ("history is a separate lazily-loaded artifact: it is the only one that "
                 "grows without bound, and index.json has a hard search-path budget"),
    }
    # emit -> assert -> publish. Nothing reaches web/public/data/ until the
    # whole set has passed the contract, and each file lands by one atomic
    # rename, so a consumer reading mid-export can never see a partial or blank
    # catalogue.
    sizes, chunks, stage = export.emit(WEB_DATA, all_products, profiles, [],
                                       meta, price_history)
    for name, gz in sorted(sizes.items()):
        print(f"  {name}: {gz/1024:.1f} KB gzipped")
    if chunks:
        print(f"  products.json chunked by category: {sorted(chunks)}")

    print("== contract ==")
    # WEB_DATA still holds the PREVIOUS run's artifact at this point — publish()
    # renames over it only after the contract passes — so it is the baseline the
    # regression guards measure against.
    if failed_hosts:
        print(f"  WARNING: hosts that exhausted every fetch retry this run: {sorted(failed_hosts)}")
        print(f"     ({len(fetcher.fetch_failures())} failed fetches total — a source that "
              f"collapsed AND appears here is a transient fault, not a retailer change)")
    summary = export.assert_contract(stage, profiles, None, published_dir=WEB_DATA,
                                     failed_hosts=failed_hosts,
                                     allow_source_drop=allow_source_drop)
    parents = assert_distinct_parents(all_products)
    published = export.publish(stage, WEB_DATA)
    print(f"  PASS — {summary}")
    print(f"  published atomically: {len(published)} files -> {WEB_DATA}")
    print(f"  parent companies all distinct: {len(parents)} independent groups")

    # ------------------------------------------------------- audit surfaces
    with open(ENGINE / "match-audit.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["category", "offer_a", "offer_b", "method", "score", "decided_by"])
        for cat, a, b, method, score, decided_by in all_accepted:
            w.writerow([cat, a, b, method, score, decided_by])
    (ENGINE / "review-queue.json").write_text(
        json.dumps(all_review_q, ensure_ascii=False, indent=1), encoding="utf-8")
    with open(ENGINE / "near-miss-overlap.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["category", "fingerprint", "retailer", "raw_title", "model", "price_crc"])
        w.writerows(near_miss_rows)
    with open(ENGINE / "variant-collapse.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["category", "group", "role", "retailer", "raw_title", "price_crc", "url"])
        w.writerows(collapse_rows)
    (ENGINE / "featured-audit.json").write_text(
        json.dumps(feat_audit, ensure_ascii=False, indent=1), encoding="utf-8")

    multi_total = sum(1 for p in all_products if p["retailer_count"] > 1)
    offers_total = sum(len(p["offers"]) for p in all_products)
    metrics = {
        "generated_at": now_iso(),
        "raw_counts": raw_counts,
        "category_counts": dict(category_counts),
        "products_total": len(all_products),
        "offers_total": offers_total,
        "accepted_match_pairs": len(all_accepted),
        "review_queue_size": len(all_review_q),
        "near_miss_groups": near_miss_groups,
        "multi_retailer_products": multi_total,
        "price_freshness": meta["price_freshness"],
        "variant_collapse": {
            "groups": len({r[1] for r in collapse_rows}),
            "listings_folded": len(collapse_rows) - len({r[1] for r in collapse_rows}),
            "audit": "variant-collapse.csv",
        },
        "featured_verification": {**feat_policy, "featured": [f["id"] for f in feat],
                                  "dropped": [{"id": d["id"], "reason": d["dropped_reason"]}
                                              for d in feat_dropped],
                                  "audit": "featured-audit.json"},
        "overlap": overlap_report(all_products),
        "parent_companies": {name: retailers.PARENT_COMPANY[name] for name in
                             sorted({o["retailer"] for p in all_products
                                     for o in p["offers"]})},
        "collection": {
            "sources_run": sorted(sources) if sources else "all declared",
            "price_cache_max_age_h": (max_age / 3600) if max_age else None,
            "price_observations_recorded": price_observations,
            "price_point_policy": ("one row per new retrieval (scraped_at change), "
                                   "price moved or not — a flat line is real history"),
            "network": fetcher.net_stats(),
        },
        "overlap_pct": round(100 * multi_total / len(all_products), 1) if all_products else 0,
        "overlap_note": ("computed from matcher output; an independent human-labeled sample "
                         "is required before trusting it — treat as a lower bound "
                         "(precision-biased matcher under-reports overlap)"),
        "artifact_gzip_bytes": sizes,
    }
    (ENGINE / "metrics.json").write_text(json.dumps(metrics, indent=1), encoding="utf-8")
    print(json.dumps({k: metrics[k] for k in
                      ("category_counts", "products_total", "offers_total",
                       "overlap", "collection")}, indent=1))
    print("done.")


if __name__ == "__main__":
    try:
        main()
    except ContractError as e:
        print(f"CONTRACT VIOLATION: {e}", file=sys.stderr)
        sys.exit(2)
