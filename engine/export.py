"""Artifact contract (spec-v2 §4.4) — emit + assert.

The engine OWNS web/public/data/. The web app never writes it.

  index.json      minimal per-product record for search + card render, <=200KB gz
  products.json   full records (chunked by category if >500KB gz)
  categories.json CategoryProfiles, for facet generation
  branches.json   retailer branch directory (§7)
  history.json    per-product per-retailer observed price series (lazy-loaded)
  meta.json       FX rate + source + date, run timestamp, per-category counts

history.json is deliberately its OWN file, not a field on the product record and
never on the index: it is the only artifact that grows without bound (one point
per product per retailer per day forever), and index.json has a hard 200KB gz
budget that the search path depends on. The app loads it only when a chart is
actually shown.

assert_contract() is the gate: it runs before the run is allowed to report done
and raises on the first violation. Nothing here is advisory.

**Publication is a two-step: emit -> assert -> publish.** `emit()` writes the
whole set into `web/public/data/.staging/`, `assert_contract()` runs over the
STAGED copy, and only then does `publish()` rename each file into place. Two
defects motivate the split:

1. A multi-file write is not atomic, so a consumer reading mid-export saw a
   partial or blank catalogue (`image_coverage` observed passing through 0 on
   2026-08-03). One `os.replace` per file is atomic on POSIX.
2. Asserting the OLD location meant a contract violation was discovered after
   the bad data was already live. Staging means a failed run leaves the
   previous good artifacts untouched.
"""
import gzip
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import db

INDEX_BUDGET_GZ = 200 * 1024
PRODUCTS_CHUNK_GZ = 500 * 1024
ISO = "%Y-%m-%dT%H:%M:%SZ"

# How far image coverage may fall, in percentage points, against the artifact
# currently published. A retailer editing one listing out of a few hundred is
# noise; anything larger is a linkage or fetch failure, which renders as a page
# of brand-initial placeholders and an omitted og:image. Sized from the measured
# regression (100% -> 51.7%) and its opposite (one image lost out of 100).
IMAGE_COVERAGE_TOLERANCE_PTS = 2.0

# ------------------------------------------------- per-source collapse guard
# THE HOLE THIS FILLS, named as a follow-up in the 2026-08-27 incident write-up
# and unbuilt until 2026-08-29: `assert_contract` PASSED with an
# entire retailer at zero. Every assertion in it — product totals, index size,
# image coverage, history — degrades GRACEFULLY when one source of twelve
# disappears, so none of them can trip on it. The count that did change,
# "11 independent groups" against yesterday's 12, was PRINTED AND NOT ASSERTED.
#
# It has now cost two incidents:
#   2026-08-27  One retailer starts answering 403. Catalogue 3.991 -> 3.656.
#   2026-08-28  A transient burst zeroes five retailers at once on
#               `lavadoras` in ONE run. Catalogue 3.991 -> 3.242, and 964 live
#               product URLs became 404s. It recovered by itself the next
#               morning — the damage was done entirely by PUBLISHING the hole.
#
# A ZERO TEST WOULD NOT HAVE CAUGHT THE SECOND ONE. One source did not vanish,
# it HALVED (1.248 -> 694 offers, -44%). So this is a drop tolerance, and the
# zero case is just its limit.
#
# THE THRESHOLD IS MEASURED, NOT GUESSED. Every committed artifact from
# 2026-08-02 to 2026-08-26 was replayed, 18 day-over-day transitions across 11
# retailers:
#   · largest ordinary drop ................ -10.5%  (448 -> 401)
#   · every real incident .................. -100%   (a source disabled,
#                                                     a source WAF-blocked)
#   · nothing whatsoever in between
# 25% sits clear of the noise and far under any incident. A guard set inside
# the noise band gets switched off after its third false alarm, which is the
# usual way a guard dies.
RETAILER_DROP_TOLERANCE_PCT = 25.0
# Below this many offers yesterday, the PERCENTAGE is noise: the smallest
# source carries 13 offers, so losing 4 reads as -31% and means nothing. Small sources
# are still covered by the non-zero -> zero rule, which has no size condition.
RETAILER_DROP_MIN_BASELINE = 25


def write_json(path: Path, payload, indent=1):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=indent), encoding="utf-8")
    return gz_size(path)


def gz_size(path: Path) -> int:
    return len(gzip.compress(path.read_bytes(), 9))


def freshness(products, generated_at):
    """How old the PRICES are at export time, in hours.

    Published because the freshness stamp is this product's trust claim, not
    decoration: a cache-first engine can re-run in 30 seconds over bodies from
    hours ago, and the only defence against that quietly drifting is to state
    the distribution every run. The UI can decide when to warn from these
    numbers instead of assuming the data is as fresh as the build.
    """
    ref = datetime.strptime(generated_at, ISO).replace(tzinfo=timezone.utc)
    ages = sorted((ref - datetime.strptime(o["scraped_at"], ISO).replace(tzinfo=timezone.utc))
                  .total_seconds() / 3600
                  for p in products for o in p["offers"] if o.get("scraped_at"))
    if not ages:
        return None
    mid = len(ages) // 2
    median = ages[mid] if len(ages) % 2 else (ages[mid - 1] + ages[mid]) / 2
    return {
        "offers": len(ages),
        "newest_age_h": round(ages[0], 2),
        "median_age_h": round(median, 2),
        "oldest_age_h": round(ages[-1], 2),
        "over_24h": sum(1 for a in ages if a > 24),
        "over_48h": sum(1 for a in ages if a > 48),
        "basis": ("hours between an offer's real retrieval time (scraped_at) and "
                  "meta.generated_at; scraped_at is when the bytes were fetched, "
                  "never when the export ran"),
    }


# design-direction-v7 §2.1 — THE SPREAD BAR'S AXIS DOMAIN AND THE DISTRIBUTION'S BINS.
#
# The bar is drawn on `0 -> the largest gap in the catalogue on the export date`,
# on EVERY surface, so that every bar in the product is mutually comparable and the
# reader learns the scale once. A bar drawn on `[low, high]` makes an 8% gap and an
# 80% gap look identical; a bar drawn on `[0, high price]` makes every gap look like
# nothing. This is the one domain that is both honest and comparable — which means
# the axis maximum is A MEASURED CATALOGUE FACT and has to be emitted, never typed.
#
# THE ARITHMETIC IS THE WEB'S, DELIBERATELY, AND IT IS NOT featured.py's.
# `web/lib/catalog.ts enrich()` computes  (hi - lo) / LO  * 100 — the gap as a share
# of the cheaper price, i.e. "what the dearest chain charges ON TOP". featured.py's
# `gap_pct` divides by HI instead, which is a different statistic (the discount off
# the dearest). Both are defensible; they are not interchangeable, and an axis
# maximum computed with the wrong one would put every span on the page on a domain
# 20% too small — the maximum product would overflow its own track. So this function
# mirrors enrich() exactly, and web/lib/gaps.server.ts asserts the two agree at build
# time rather than trusting this comment. featured.py is NOT changed here: its
# figure is published as its own labelled number and nothing draws a bar from it.
#
# NO ROUNDING ON max_gap_pct. Python and JS both compute in IEEE-754 doubles from
# the same integer prices, and json round-trips a double exactly, so the emitted
# value is bit-identical to the one the browser derives. Rounding it to 1dp would
# make the largest product's span 100.06% of its own track.
#
# FIVE BINS, EDGES `[0, 5, 10, 20, 50, ∞]` — v7.1 §0.1/§9-1, AND THE EDGES ARE
# NOT A PRESENTATION CHOICE. v7's prose says "the five gap bins" while v7 §2.3's
# own diagram draws SIX (…20–30, 30–50, +50%); the two cannot both be built, and
# v7.1 rules for five because in v7.1 THE BIN EDGES ARE THE AMBER RAMP'S BANDS:
# bands 1–4 (5–10 / 10–20 / 20–50 / ≥50%) are the four ramp steps, and band 0
# (< 5%) is the near-tie bucket, which renders in NEUTRAL --fill and never in
# amber. Emit the wrong edges here and every spread bar downstream has to rebin
# in the browser to recover them — which is the `las 8` defect (a bin typed into
# a component) arriving by the back door.
GAP_BIN_EDGES = (0, 5, 10, 20, 50)


def gap_band(gap_pct):
    """The band index 0–4 for one gap, against GAP_BIN_EDGES.

    Emitted PER PRODUCT (v7.1 §9-1) so that no surface ever bins in the browser.
    Band 0 is the `parejo` near-tie floor and takes no amber at any scale; bands
    1–4 are the amber ramp's four steps.
    """
    for i in range(len(GAP_BIN_EDGES) - 1, -1, -1):
        if gap_pct >= GAP_BIN_EDGES[i]:
            return i
    return 0


def gap_distribution(products):
    """meta.gap_distribution — the spread bar's axis (§2.1) and /brechas' strip (§2.3).

    FIVE bins, edges [0, 5, 10, 20, 50, ∞] (v7.1 §0.1). bins[0] is the `parejo`
    near-tie floor — < 5%, the same GAP_THRESHOLD web/lib/catalog.ts uses. It is
    counted and published rather than left as the remainder, because the size of
    the near-tie group is the honest denominator for everything else on the page.

    CORRECTED 2026-08-13 — this docstring used to assert that bins[0] "is the
    LARGEST bin in the catalogue", and that "the biggest group of comparable
    products is a near-tie" was the single strongest guard against the page being
    read as an accusation. BOTH CLAIMS ARE NOW FALSE, and they were true when
    written. Measured on the live artifact, 525 comparable products:

        < 5%   5–10   10–20   20–50   ≥50
         124     91     119     176     15      median gap 14,18%

    bins[3] (20–50%) is the largest; the near-tie is THIRD. The claim was true at
    the 2026-08-03 measurement — 54 comparable products, median 3,0% — and the
    catalogue has since grown to 4.338 products across 8 chains. The number moved;
    the comment did not.

    The lesson worth keeping: a docstring that states a MEASURED FACT about the
    data is a cache with no invalidation. This one silently propagated into
    design-direction-v7.2 §1.5/§3.5, which built an argument on it and shipped
    copy defending it. State the derivation here; state the facts where they can
    be re-measured. If you find yourself writing "X is the largest" in a comment,
    write the query instead. See the project's stop/restart decision record
    (addendum 2026-08-13).

    BIN COUNTS AND EDGES ARE DERIVED HERE AND MUST NEVER BE TYPED IN A
    COMPONENT. A binned histogram with a hard-coded bin is the `las 8` defect in a
    new costume — which is also why `edges` ships alongside `bins`.
    """
    pcts = sorted(100 * (max(pr) - min(pr)) / min(pr)
                  for p in products
                  for pr in [[o["price_crc"] for o in p["offers"] if o["price_crc"]]]
                  if len(pr) > 1 and min(pr))
    if not pcts:
        return None
    mid = len(pcts) // 2
    edges = list(GAP_BIN_EDGES)
    bins = []
    for i, lo in enumerate(edges):
        hi = edges[i + 1] if i + 1 < len(edges) else None
        bins.append({"from": lo, "to": hi,
                     "count": sum(1 for v in pcts if v >= lo and (hi is None or v < hi))})
    return {
        "comparable": len(pcts),
        "max_gap_pct": pcts[-1],
        "median_gap_pct": pcts[mid] if len(pcts) % 2 else (pcts[mid - 1] + pcts[mid]) / 2,
        "edges": list(GAP_BIN_EDGES),
        "bins": bins,
        "basis": ("gap = (dearest - cheapest) / cheapest * 100 over every product two or "
                  "more chains publish, which is web/lib/catalog.ts enrich() verbatim. "
                  "max_gap_pct is the domain EVERY spread bar in the product is drawn "
                  "on. FIVE bins, edges [0,5,10,20,50,inf]: bins[0] is the sub-5% "
                  "near-tie floor (`parejo`), never a brecha and never amber; bins[1..4] "
                  "are the four amber-ramp bands. Each product carries its own "
                  "`gap_band` index so nothing rebins in the browser."),
    }


def history(products, points_by_url, generated_at):
    """Observed price series per product per retailer.

    This is the one asset a competitor cannot clone: someone who copies the UI
    tomorrow still starts with zero history. It is also the easiest place in the
    product to accidentally lie, so three rules are hard-coded here:

    1. **Only observed days appear.** No interpolation, no carry-forward, no
       point for a day the collector did not run. A gap in the series is a real
       gap and must render as one.
    2. **Every series states how much data it rests on** (`observations` = raw
       retrievals, `days` = distinct days). Two points cannot support a trend
       claim, and the UI can only know that if the artifact says so.
    3. **Downsample, never smooth.** Several retrievals on one day collapse to
       that day's LAST observed price — a real number that was really on the
       shelf — not to an average, which is a number nobody was ever charged.

    Keyed by offer URL rather than by the DB product id because the product
    table is rebuilt every run (its rowids are not stable) while an offer's URL
    is its identity across runs.
    """
    out, all_days = {}, set()
    for p in products:
        series = {}
        for o in p["offers"]:
            pts = points_by_url.get(o["url"]) or []
            by_day = {}
            for price, observed_at in sorted(pts, key=lambda x: x[1]):
                if price is None:
                    continue                      # unreadable price is not an observation
                by_day[observed_at[:10]] = int(round(price))   # last of the day wins
            if not by_day:
                continue
            all_days |= set(by_day)
            series[o["retailer"]] = {
                "points": [[d, by_day[d]] for d in sorted(by_day)],
                "observations": len(pts),
                "days": len(by_day),
            }
        if series:
            out[p["id"]] = series
    days = sorted(all_days)
    return {
        "generated_at": generated_at,
        "observation_window": {
            "first_day": days[0] if days else None,
            "last_day": days[-1] if days else None,
            "distinct_days": len(days),
        },
        "products_with_history": len(out),
        "basis": ("one point per retailer per UTC day, taken from the LAST price "
                  "observed that day. Only days actually collected appear — the "
                  "series is never interpolated, smoothed or carried forward, so a "
                  "missing day means no observation, not an unchanged price. Read "
                  "`days`/`observations` before deriving any trend: a two-point "
                  "series cannot support one."),
        "products": out,
    }


def index_record(p):
    """Only what the search index and the card need — everything else is in
    products.json and is loaded on demand."""
    prices = [o["price_crc"] for o in p["offers"] if o["price_crc"]]
    cr = (p["reviews"] or {}).get("cr")
    us = (p["reviews"] or {}).get("us")
    # readable keys on purpose: gzip collapses the repeated key names to almost
    # nothing, so abbreviating them would buy bytes the budget does not need
    # and cost the app a translation layer.
    return {
        "id": p["id"],
        "name": p["name"],
        "brand": p["brand"],
        "model": p["model"],
        "category": p["category"],
        "price_min": min(prices) if prices else None,
        "price_max": max(prices) if prices else None,
        "retailer_count": p["retailer_count"],
        "image": p["image"],
        "review_cr": [cr["average"], cr["count"]] if cr else None,
        "review_us": [us["average"], us["count"]] if us else None,
    }


# per-process, so two engine runs staging at the same time cannot delete each
# other's half-written set before either gets to publish
STAGE_DIRNAME = f".staging-{os.getpid()}"
# every filename the engine owns; anything matching these that is NOT in the
# staged set is a leftover from a previous run and is removed at publish, so a
# category that stops chunking cannot leave a stale products-<cat>.json behind
# for the app to load.
MANAGED = ("index.json", "products.json", "categories.json", "branches.json",
           "history.json", "meta.json")


def emit(out_dir: Path, products, profiles, branches, meta, price_history=None):
    """Write the full artifact set to a STAGING directory and return its path.

    Nothing lands in web/public/data/ here. `publish()` does that, after
    `assert_contract()` has passed over the staged copy — see the module
    docstring for why the two steps are separate."""
    out_dir = out_dir / STAGE_DIRNAME
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    sizes = {}
    if price_history is not None:
        sizes["history.json"] = write_json(out_dir / "history.json", price_history, indent=None)
    sizes["index.json"] = write_json(out_dir / "index.json",
                                     [index_record(p) for p in products], indent=None)
    sizes["products.json"] = write_json(out_dir / "products.json", products)

    # chunk by category only if the single file blows the budget
    chunks = {}
    if sizes["products.json"] > PRODUCTS_CHUNK_GZ:
        by_cat = {}
        for p in products:
            by_cat.setdefault(p["category"], []).append(p)
        for cat, rows in sorted(by_cat.items()):
            name = f"products-{cat}.json"
            sizes[name] = write_json(out_dir / name, rows)
            chunks[cat] = f"/data/{name}"

    sizes["categories.json"] = write_json(out_dir / "categories.json",
                                          [pr.to_json() for pr in profiles])
    sizes["branches.json"] = write_json(out_dir / "branches.json", branches)
    meta = {**meta, "artifact_gzip_bytes": sizes, "product_chunks": chunks or None}
    sizes["meta.json"] = write_json(out_dir / "meta.json", meta)
    return sizes, chunks, out_dir


def publish(stage_dir: Path, out_dir: Path) -> list:
    """Move a validated staging set into place, one atomic rename per file.

    A multi-file write is not atomic. Measured on 2026-08-03: during a live
    re-export `meta.image_coverage` was read as 0 and the catalogue as partial,
    because a consumer opened the files while the exporter was still writing
    them. `os.replace` on the same filesystem is atomic on POSIX — a reader
    holds either the whole old file or the whole new one, never a half-written
    one, and never a zero-byte one.

    Renames are done newest-dependency-last: `meta.json` is what the app reads
    to decide what to load, so it is published only after every artifact it
    describes is already in place. That closes the remaining window — a reader
    can still see old-meta + new-products (both individually complete and both
    self-consistent), never new-meta pointing at a chunk that is not there yet.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    staged = sorted(p for p in stage_dir.iterdir() if p.is_file())
    order = sorted(staged, key=lambda p: (p.name == "meta.json", p.name))
    published = []
    for src in order:
        os.replace(src, out_dir / src.name)     # atomic within one filesystem
        published.append(src.name)
    keep = set(published)
    for p in out_dir.iterdir():
        if p.is_file() and p.name not in keep and (
                p.name in MANAGED or p.name.startswith("products-")):
            p.unlink()
    shutil.rmtree(stage_dir, ignore_errors=True)
    return published


# --------------------------------------------------------------- assertions
OFFER_KEYS = {"retailer", "price_crc", "list_price_crc", "in_stock", "url",
              "credit", "variant_count", "variant_price_max_crc", "scraped_at"}
PRODUCT_KEYS = {"id", "category", "brand", "model", "name", "image", "image_srcset",
                "attributes", "offers", "retailer_count", "reviews", "us_reference",
                "markup_pct", "markup_basis", "scraped_at", "gap_band"}
BRANCH_KEYS = {"retailer", "name", "canton", "address", "lat", "lng"}


class ContractError(AssertionError):
    pass


def _check(cond, msg):
    if not cond:
        raise ContractError(msg)


def _host_of(url) -> str:
    """Lowercased host, `www.` stripped. Never raises — a malformed URL yields
    '' and fails the allowlist, which is the correct outcome."""
    try:
        h = urlparse(str(url)).netloc.lower().split("@")[-1].split(":")[0]
    except Exception:                                   # pragma: no cover
        return ""
    return h[4:] if h.startswith("www.") else h


# Offer URLs may only point at a retailer we actually declare. Built from
# db.RETAILERS so the allowlist cannot drift from the source of truth — adding an
# adapter extends it automatically.
#
# `www.` is normalised on BOTH sides, and that is not cosmetic: production
# declares one retailer as `shop.tld` while every one of its offer URLs is
# `www.shop.tld`. A literal allowlist would have refused all 81 of its offers, failed the contract, and the 06:00 unattended run would have published
# NOTHING — a security guard causing a silent outage. Caught before it shipped by
# diffing declared hosts against the hosts actually present in the artifact.
ALLOWED_OFFER_HOSTS = frozenset(
    _host_of(base) for *_, base, _ in db.RETAILERS
)


def assert_contract(out_dir: Path, profiles, img_dir: Path = None,
                    published_dir: Path = None, failed_hosts: set | None = None,
                    allow_source_drop: bool = False):
    by_id = {pr.id: pr for pr in profiles}
    products = json.loads((out_dir / "products.json").read_text(encoding="utf-8"))
    index = json.loads((out_dir / "index.json").read_text(encoding="utf-8"))
    cats = json.loads((out_dir / "categories.json").read_text(encoding="utf-8"))
    branches = json.loads((out_dir / "branches.json").read_text(encoding="utf-8"))
    meta = json.loads((out_dir / "meta.json").read_text(encoding="utf-8"))

    _check(isinstance(products, list), "products.json must be a top-level ARRAY")
    _check(isinstance(index, list), "index.json must be a top-level ARRAY")
    _check(isinstance(cats, list), "categories.json must be a top-level ARRAY")
    _check(isinstance(branches, list), "branches.json must be a top-level ARRAY")
    _check(isinstance(meta, dict), "meta.json must be an OBJECT")
    _check(len(index) == len(products), "index.json and products.json length mismatch")

    slugs = set()
    for p in products:
        pid = p.get("id")
        _check(set(p) == PRODUCT_KEYS,
               f"{pid}: product keys {sorted(set(p) ^ PRODUCT_KEYS)} off contract")
        _check(pid and pid not in slugs, f"duplicate or empty slug: {pid!r}")
        slugs.add(pid)
        _check(p["category"] in by_id, f"{pid}: unknown category {p['category']!r}")
        profile = by_id[p["category"]]

        # attributes keys match the DECLARING profile, exactly
        _check(set(p["attributes"]) == set(profile.attribute_keys),
               f"{pid}: attributes {sorted(set(p['attributes']) ^ set(profile.attribute_keys))} "
               f"do not match profile {profile.id}")

        _check(isinstance(p["offers"], list) and p["offers"], f"{pid}: no offers")
        retailers = [o["retailer"] for o in p["offers"]]
        _check(len(retailers) == len(set(retailers)),
               f"{pid}: more than one offer per retailer {retailers}")
        _check(p["retailer_count"] == len(set(retailers)),
               f"{pid}: retailer_count {p['retailer_count']} != {len(set(retailers))}")
        for o in p["offers"]:
            _check(set(o) == OFFER_KEYS,
                   f"{pid}: offer keys {sorted(set(o) ^ OFFER_KEYS)} off contract")
            price = o["price_crc"]
            _check(isinstance(price, int) and not isinstance(price, bool),
                   f"{pid}: price_crc {price!r} is not an int (colones)")
            _check(price >= profile.price_floor,
                   f"{pid}: price {price} below the {profile.id} floor {profile.price_floor}")
            # Two guards, and the second exists because the first was not enough.
            # The named-sentinel list only catches placeholders we have already
            # MET: one chain's ₡10.000.000 shipped as a real offer for 7 products
            # because the value was not on the list yet, and it sorted straight
            # to the top of the page. A declared per-category CEILING catches the
            # next one without anybody having to see it first — it is a claim
            # about the market ("no refrigerator in CR retails above ₡X"), which
            # is checkable, rather than a list of strings we happen to know.
            _check(price not in profile.price_sentinels,
                   f"{pid}: sentinel price {price}")
            _check(not profile.price_ceiling or price <= profile.price_ceiling,
                   f"{pid}: price {price} is above the {profile.id} ceiling "
                   f"{profile.price_ceiling} — real price or unlisted sentinel? "
                   f"({o['retailer']} {o['url']})")
            # ---- the offer URL, which becomes an href in a STATIC page
            # Security review 2026-08-04 (H1): every offer URL is rendered
            # straight into `href={o.url}` (OfferTable, VerdictPlate x2) and
            # baked into 4,440 prerendered documents. React warns about a
            # `javascript:` href in dev and renders it anyway in production. The
            # value is scraped from retailers we do not control, and
            # `OFFER_KEYS` only insisted the field EXIST — it never asked what
            # was in it.
            #
            # Refused here rather than sanitised at render time, because that is
            # how every other guard in this file works: a bad artifact does not
            # get published. Sanitising in the component would leave the bad URL
            # in products.json, which is committed.
            #
            # Latent, not live: all 2.515 URLs in the artifact of 2026-08-04 are
            # https across the 8 expected hosts. But the artifact regenerates
            # UNATTENDED DAILY at 06:00, so "clean today" is not a control.
            _check(isinstance(o["url"], str) and o["url"].startswith("https://"),
                   f"{pid}: offer url is not an https:// string — {o['url']!r} "
                   f"({o['retailer']}). A scraped href reaches 4.440 static "
                   f"documents; javascript: and data: are the shapes that matter")
            _check(_host_of(o["url"]) in ALLOWED_OFFER_HOSTS,
                   f"{pid}: offer url host {_host_of(o['url'])!r} is not a "
                   f"declared retailer host ({o['retailer']}). Allowed: "
                   f"{sorted(ALLOWED_OFFER_HOSTS)}")
            _check(o["list_price_crc"] is None or isinstance(o["list_price_crc"], int),
                   f"{pid}: list_price_crc not int")
            _check(isinstance(o["in_stock"], bool), f"{pid}: in_stock not bool")
            # collapsed colour variants: price_crc is the CHEAPEST of the group
            # and the group's spread is never hidden
            _check(isinstance(o["variant_count"], int) and o["variant_count"] >= 1,
                   f"{pid}: variant_count {o['variant_count']!r} must be an int >= 1")
            vmax = o["variant_price_max_crc"]
            _check(vmax is None or (isinstance(vmax, int) and vmax > price),
                   f"{pid}: variant_price_max_crc {vmax!r} must be null or above price_crc")
            _check(vmax is None or o["variant_count"] > 1,
                   f"{pid}: variant_price_max_crc set on a single-listing offer")

        rv = p["reviews"]
        _check(set(rv) == {"cr", "us"}, f"{pid}: reviews must have exactly cr + us")
        for scope in ("cr", "us"):
            r = rv[scope]
            if r is None:
                continue
            _check(r.get("count", 0) > 0, f"{pid}: {scope} review with count<=0 must be null")
            _check(bool(r.get("source")), f"{pid}: {scope} review has no named source")
            _check(0 < r["average"] <= 5, f"{pid}: {scope} average {r['average']} out of range")

    idx_ids = [r["id"] for r in index]
    _check(len(idx_ids) == len(set(idx_ids)), "index.json has duplicate ids")
    _check(set(idx_ids) == slugs, "index.json ids differ from products.json ids")

    _check({c["id"] for c in cats} >= {p["category"] for p in products},
           "categories.json is missing a category used by products.json")

    # every attribute must be renderable from declarations alone: `unit` cannot
    # disambiguate 512 GB storage from 16 GB RAM, `display` can
    for c in cats:
        for a in c["attributes"]:
            _check("{value}" in (a.get("display") or ""),
                   f"{c['id']}.{a['key']}: display template must contain {{value}}")
            vl, values = a.get("value_labels"), a.get("values")
            _check(vl is None or (isinstance(vl, dict) and vl
                                  and all(isinstance(v, str) for v in vl.values())),
                   f"{c['id']}.{a['key']}: value_labels must be null or a non-empty str map")
            # a closed enum ships as internal keys (TOP_LOAD) because the matcher
            # uses them for identity — every one needs a reading
            _check(values is None or (vl and not set(values) - set(vl)),
                   f"{c['id']}.{a['key']}: value_labels missing "
                   f"{sorted(set(values or []) - set(vl or {}))}")

    # featured slot: only re-verified products, never more than the slot count
    feat = meta.get("featured")
    _check(isinstance(feat, list), "meta.json missing the featured array")
    for f in feat:
        _check(f["id"] in slugs, f"featured {f['id']} is not in products.json")
        _check(f["gap_crc"] > 0 and f["verified_at"],
               f"featured {f['id']} carries no gap or no verification stamp")
        prod = next(p for p in products if p["id"] == f["id"])
        cheapest = min(prod["offers"], key=lambda o: o["price_crc"])
        _check(cheapest["retailer"] == f["cheapest_retailer"]
               and cheapest["price_crc"] == f["price_crc"],
               f"featured {f['id']} verdict disagrees with its own offers "
               f"({f['cheapest_retailer']} {f['price_crc']} vs "
               f"{cheapest['retailer']} {cheapest['price_crc']})")

    for b in branches:
        _check(set(b) == BRANCH_KEYS,
               f"branch keys {sorted(set(b) ^ BRANCH_KEYS)} off contract")
        for k in ("lat", "lng"):
            _check(b[k] is None or isinstance(b[k], float), f"branch {k} not float/null")
        _check(b["lat"] is None or 5 < b["lat"] < 12, f"branch lat {b['lat']} outside CR")
        _check(b["lng"] is None or -87 < b["lng"] < -82, f"branch lng {b['lng']} outside CR")

    for k in ("fx_rate_crc_usd", "fx_rate_date", "fx_source", "generated_at",
              "category_counts", "artifact_gzip_bytes", "featured", "featured_policy",
              "featured_dropped", "price_freshness"):
        _check(k in meta, f"meta.json missing {k}")

    # A price cannot have been verified after the export that published it. This
    # is the assertion that keeps `scraped_at` from drifting back to now(): the
    # old behaviour stamped every offer within a second of generated_at, so the
    # spread being real is the evidence the stamp is real.
    fresh = meta["price_freshness"]
    _check(fresh and fresh["offers"] == sum(len(p["offers"]) for p in products),
           "price_freshness does not cover every offer")
    _check(fresh["newest_age_h"] >= 0 and fresh["oldest_age_h"] >= fresh["median_age_h"]
           >= fresh["newest_age_h"], f"price_freshness is not ordered: {fresh}")
    gen = datetime.strptime(meta["generated_at"], ISO)
    for p in products:
        for o in p["offers"]:
            _check(datetime.strptime(o["scraped_at"], ISO) <= gen,
                   f"{p['id']}: offer scraped_at {o['scraped_at']} is after the "
                   f"export at {meta['generated_at']} — a price cannot be verified "
                   f"in the future")
    _check(len(feat) <= meta["featured_policy"]["slots"],
           f"{len(feat)} featured products exceeds the declared slot count")

    # ---- price history: the differentiator, therefore the easiest thing to lie with
    hist_path = out_dir / "history.json"
    hist_gz, hist_products = 0, 0
    if hist_path.exists():
        hist = json.loads(hist_path.read_text(encoding="utf-8"))
        _check(isinstance(hist, dict) and "products" in hist,
               "history.json must be an object carrying a products map")
        win = hist.get("observation_window") or {}
        _check({"first_day", "last_day", "distinct_days"} <= set(win),
               "history.json must declare its observation window")
        _check(bool(hist.get("basis")),
               "history.json must state what its points are and are not")
        prices_now = {(p["id"], o["retailer"]): o["price_crc"]
                      for p in products for o in p["offers"]}
        for pid, series in hist["products"].items():
            _check(pid in slugs, f"history for {pid!r} is not in products.json")
            for retailer, s in series.items():
                pts = s["points"]
                _check(pts, f"history {pid}/{retailer}: empty series must be omitted")
                days = [d for d, _ in pts]
                _check(days == sorted(set(days)),
                       f"history {pid}/{retailer}: days not unique and ascending")
                # one point per day means the count can never exceed the raw
                # retrievals it was derived from — the guard against a
                # downsample that quietly invents days
                _check(s["days"] == len(pts) <= s["observations"],
                       f"history {pid}/{retailer}: {len(pts)} points from "
                       f"{s['observations']} observations is not a downsample")
                for d, v in pts:
                    _check(isinstance(v, int) and not isinstance(v, bool) and v > 0,
                           f"history {pid}/{retailer}: price {v!r} is not a positive int")
                    _check(len(d) == 10 and d.count("-") == 2,
                           f"history {pid}/{retailer}: {d!r} is not a YYYY-MM-DD day")
                    _check(d <= meta["generated_at"][:10],
                           f"history {pid}/{retailer}: observed on {d}, after the "
                           f"export — a price cannot be observed in the future")
                # the newest point must agree with the price the card shows,
                # or the chart and the headline contradict each other
                shown = prices_now.get((pid, retailer))
                _check(shown is None or pts[-1][1] == shown,
                       f"history {pid}/{retailer}: newest point {pts[-1][1]} "
                       f"disagrees with the displayed price {shown}")
        hist_gz, hist_products = gz_size(hist_path), len(hist["products"])

    # ---- images: the linkage, not the files
    # Regression this exists to catch (2026-08-03): every product.image went
    # null while 2,322 derived WebP files sat in public/img/. Nothing failed —
    # the images were simply never linked, meta said `self_hosted: 0`, and the
    # only symptom was a page of brand-initial placeholders. The files existing
    # and the products pointing at them are two different facts; assert both.
    cov = meta.get("image_coverage") or {}
    linked = sum(1 for p in products if p["image"])
    _check(cov.get("self_hosted") == linked,
           f"meta.image_coverage.self_hosted {cov.get('self_hosted')} disagrees with "
           f"the {linked} products carrying an image path")
    _check(cov.get("of_products") == len(products),
           "meta.image_coverage.of_products does not cover every product")
    if img_dir and img_dir.exists() and any(img_dir.glob("*.webp")):
        _check(linked > 0,
               f"{len(list(img_dir.glob('*.webp')))} derived images exist in "
               f"{img_dir} but NO product references one — the image linkage "
               f"broke, which renders as a catalogue of empty placeholders")

    # A floor of one was not a regression guard. Measured 2026-08-04: an
    # expansion run published 1,927 products carrying 996 images — coverage fell
    # from 100% to 51.7% — and every assertion above passed, because `linked` was
    # neither zero nor disagreeing with meta. The published artifact is the only
    # honest baseline, and during validation it is still on disk: `publish()`
    # renames into `published_dir` only after this function returns.
    prev_meta = (published_dir / "meta.json") if published_dir else None
    if prev_meta and prev_meta.exists():
        try:
            prev = (json.loads(prev_meta.read_text(encoding="utf-8"))
                    .get("image_coverage") or {})
        except (json.JSONDecodeError, OSError):
            prev = {}                     # an unreadable baseline must not block
        was, of_was = prev.get("self_hosted"), prev.get("of_products")
        if isinstance(was, int) and isinstance(of_was, int) and of_was > 0:
            before, now = 100.0 * was / of_was, 100.0 * linked / len(products)
            _check(now >= before - IMAGE_COVERAGE_TOLERANCE_PTS,
                   f"image coverage regressed {before:.1f}% -> {now:.1f}% "
                   f"({was}/{of_was} -> {linked}/{len(products)}), more than the "
                   f"{IMAGE_COVERAGE_TOLERANCE_PTS:.0f}-point tolerance. Every "
                   f"unlinked product renders a brand-initial placeholder and "
                   f"omits og:image. Common cause: --skip-images on a run that "
                   f"added products whose bytes were never fetched — those link "
                   f"from cache only if the cache has them. Warm the images, or "
                   f"raise the tolerance deliberately if the drop is real.")
    missing = [p["id"] for p in products if p["image"]
               and img_dir and not (img_dir / Path(p["image"]).name).exists()][:5]
    _check(not missing, f"products point at image files that do not exist: {missing}")
    for p in products:
        srcset = p["image_srcset"]
        _check(bool(p["image"]) == bool(srcset),
               f"{p['id']}: image and image_srcset must be set or null together")

    # ------------------------------------------- per-source collapse, vs baseline
    # Same baseline trick as the image-coverage guard above: during validation
    # `published_dir` still holds the PREVIOUS run's artifact, because publish()
    # renames over it only after this function returns.
    #
    # WHY REFUSING IS CHEAP HERE, which is the whole reason this can be a
    # hard failure rather than a warning. By the time this runs the day's prices
    # are ALREADY in the sqlite db — history is collected during the scrape and
    # read before export — and `emit()` has written only to a STAGE directory.
    # So a refusal costs the DEPLOY and not the price clock: vale.cr keeps
    # serving the previous, COMPLETE build, every URL still resolves, and the
    # next run republishes. The engine's standing rule is that a growth report
    # is never worth a lost day of history; nothing here risks one.
    #
    # Publishing the hole is the expensive branch, and it is the one we took on
    # 2026-08-28: 964 product URLs went 404 for a fault that had already fixed
    # itself by morning. A 404 is not free — Google drops the page, and an AI
    # answer that cited it now cites a dead link.
    if prev_meta and prev_meta.exists():
        prev_products_p = published_dir / "products.json"
        if prev_products_p.exists():
            try:
                prevp = json.loads(prev_products_p.read_text(encoding="utf-8"))
                prevp = prevp if isinstance(prevp, list) else prevp["products"]
            except (json.JSONDecodeError, OSError, KeyError, TypeError):
                prevp = None              # an unreadable baseline must not block
            # ONLY COMPARABLE IF THE RUN COVERED THE SAME GROUND. An
            # interactive `--only microondas` run stages ONE category against a
            # 15-category baseline, and every retailer then reads as a -95%
            # collapse. Measured on the first end-to-end run of this guard: 10
            # retailers tripped at once on a completely correct artifact. A
            # partial artifact is not a regression, it is a different question —
            # and a guard that fires on every scoped run is one that ends up
            # with `--allow-source-drop` pasted permanently into the command.
            #
            # A SUPERSET is fine: that is a new category (parrillas, 2026-08-27)
            # and everything in it is growth. Only a MISSING category makes the
            # comparison meaningless.
            missing_cats = set()
            if prevp:
                missing_cats = ({p.get("category") for p in prevp}
                                - {p.get("category") for p in products})
            if prevp and missing_cats:
                print(f"  per-source collapse guard SKIPPED: this run staged "
                      f"{len({p.get('category') for p in products})} categories and the "
                      f"published artifact carries {len(missing_cats)} it does not "
                      f"({', '.join(sorted(missing_cats))}). A partial run is not "
                      f"comparable with a full one; the guard needs a full run.")
            elif prevp:
                def _by_retailer(ps):
                    out = {}
                    for p in ps:
                        for o in p.get("offers") or []:
                            r = o.get("retailer")
                            out[r] = out.get(r, 0) + 1
                    return out

                was, now_c = _by_retailer(prevp), _by_retailer(products)
                trips = []
                for r in sorted(was):
                    a, b = was[r], now_c.get(r, 0)
                    if a <= 0:
                        continue          # already gone yesterday; nothing to lose
                    pct = 100.0 * (b - a) / a
                    if b == 0:
                        trips.append((r, a, b, pct, "went to ZERO"))
                    elif a >= RETAILER_DROP_MIN_BASELINE and pct < -RETAILER_DROP_TOLERANCE_PCT:
                        trips.append((r, a, b, pct, "dropped past the tolerance"))
                if trips:
                    # Name the fetch failures next to the collapse. A source that
                    # collapsed AND could not be fetched is an engine/network
                    # fault and will fix itself; one that collapsed with every
                    # fetch succeeding is a real retailer event and wants a human
                    # — the two need different responses and the message must not
                    # make the reader guess which one this is.
                    fh = failed_hosts or set()
                    detail = "; ".join(
                        f"{r} {a} -> {b} ({pct:+.0f}%, {why})" for r, a, b, pct, why in trips)
                    _check(allow_source_drop,
                           f"per-source collapse against the published artifact: {detail}. "
                           f"Tolerance is {RETAILER_DROP_TOLERANCE_PCT:.0f}% on a baseline of "
                           f"{RETAILER_DROP_MIN_BASELINE}+ offers; a non-zero source going to "
                           f"zero always trips regardless of size. "
                           + (f"Hosts that failed to fetch this run: {sorted(fh)} — if a "
                              f"collapsed retailer is in that list this is a TRANSIENT "
                              f"fault, the artifact on disk is fine, and the next run "
                              f"republishes with no action needed. " if fh else
                              "NO fetch failures were recorded this run, so this is a real "
                              "catalogue change at the retailer, not a network fault — read "
                              "it before overriding. ")
                           + "Refusing PUBLISH only: today's prices are already in the db and "
                           "vale.cr keeps serving the previous complete build, so nothing is "
                           "lost by stopping here. If the drop is real and intended (a "
                           "retailer disabled, a source removed), re-run with "
                           "--allow-source-drop to record that decision.")

    gz = gz_size(out_dir / "index.json")
    _check(gz <= INDEX_BUDGET_GZ,
           f"index.json {gz} B gzipped exceeds the {INDEX_BUDGET_GZ} B budget")
    return {"products": len(products), "index_gz_bytes": gz, "branches": len(branches),
            "featured": len(feat), "history_products": hist_products,
            "history_gz_bytes": hist_gz, "images_linked": linked}
