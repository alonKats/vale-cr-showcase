"""Featured-slot live price re-verification.

Why this exists (measured, 2026-08-03): `7WRS25SDHM` was scraped at 13:55 with
chain A at ₡1.165.400 against chain B ₡799.920. Chain A discounted it inside the
hour to ₡792.472 — so the app would have headlined *"Cómprela en B,
₡365.480 más barato"* when A was in fact ₡7.448 cheaper. The match was
right and the scrape was right; the price simply aged. A stale price in a
compact row is a minor inaccuracy. A stale price under a verdict headline is an
actively wrong recommendation, and the featured slot is the second thing on the
homepage.

So: rank every multi-retailer product by cross-retailer gap, take the top
CANDIDATES (headroom for drops), re-fetch every one of their offers live, apply
whatever the retailer says now, and give the SLOTS to the survivors only. A
candidate is dropped when the fresh prices flip the verdict, when the gap falls
under the featured floor, or when any of its offers could not be read at all —
silence is not agreement.

Every drop is recorded with its reason so the drop rate stays visible in
metrics.json instead of being a quiet filter.
"""
CANDIDATES = 10          # ranked by gap; > SLOTS so drops don't empty the slot
SLOTS = 3                # spec-v2 §8.3: "top 1-3 genuine outliers"
MIN_GAP_PCT = 15.0       # §2.1: median spread is 1.1%; an outlier is nothing like it
MIN_GAP_CRC = 20_000     # and it has to be real money, not a big % of a small number
MAX_AGE_S = 3600         # re-verify window; the observed failure moved inside an hour


def gap_of(product):
    """Cross-retailer spread: cheapest vs dearest, one price per retailer.
    None when the product cannot support a verdict at all."""
    prices = {}
    for o in product["offers"]:
        if o["price_crc"]:
            prices.setdefault(o["retailer"], o["price_crc"])
    if len(prices) < 2:
        return None
    lo_ret, lo = min(prices.items(), key=lambda kv: kv[1])
    hi_ret, hi = max(prices.items(), key=lambda kv: kv[1])
    return {"cheapest_retailer": lo_ret, "price_crc": lo,
            "dearest_retailer": hi_ret, "price_max_crc": hi,
            "gap_crc": hi - lo, "gap_pct": round(100 * (hi - lo) / hi, 1)}


def qualifies(gap):
    return bool(gap) and gap["gap_pct"] >= MIN_GAP_PCT and gap["gap_crc"] >= MIN_GAP_CRC


# The slot ranks by gap, and a large gap is the SAME SIGNATURE as a false match.
# Measured 2026-08-04: `xiaomi-hdr10` was the largest gap in the catalogue at
# 151% precisely because it compared a Xiaomi A Pro 43" at one chain with an LG 65"
# Serie 7300 at another — the spec token `HDR10` had become a model number. So the
# slot is structurally biased toward whatever is most wrong, and the live-price
# re-verification below does NOT close that: it re-checks the price, never
# whether the two offers are the same product.
#
# the slot renders an exact identifier or nothing. A
# fingerprint match may never appear at 44px under "Cómprela en …", even if that
# leaves fewer than SLOTS items or an empty slot — the UI builds that state.
EXACT_METHODS = frozenset(("tier1a_ean", "tier1b_model_stem"))


def exact_match_ids(products, accepted):
    """Ids of products whose offers were joined by an EXACT identifier only.

    `accepted` rows are `(category, offer_a, offer_b, method, score, decided_by)`.
    A product qualifies when at least one accepted pair joins two of its offers
    by an exact method AND no accepted pair touching its offers used an inexact
    one — a mixed product is not defensible at headline size, and "conservative"
    is the only safe direction for a claim this loud.

    A single-retailer product has no pairs and therefore never qualifies, which
    is correct: it has no verdict to state.
    """
    exact, inexact = set(), set()
    for row in accepted:
        _, a, b, method = row[0], row[1], row[2], row[3]
        (exact if method in EXACT_METHODS else inexact).update((a, b))
    out = set()
    for p in products:
        oids = set(p.get("_offer_ids") or ())
        if oids & exact and not (oids & inexact):
            out.add(p["id"])
    return out


def candidates(products, exact_ids=None):
    """Top CANDIDATES products by cross-retailer gap that clear the floor.

    `exact_ids` (from `exact_match_ids`) applies the match-tier floor BEFORE the
    CANDIDATES slice, so filtering does not silently eat the headroom the live
    re-verification needs for its drops. Passing None disables the floor and is
    for measurement only — never for a published artifact.
    """
    ranked = sorted(((gap_of(p), p) for p in products if len(p["offers"]) > 1),
                    key=lambda gp: -(gp[0] or {}).get("gap_crc", 0))
    out = [(g, p) for g, p in ranked if qualifies(g)]
    if exact_ids is not None:
        out = [(g, p) for g, p in out if p["id"] in exact_ids]
    return out[:CANDIDATES]


def verify(candidates, adapters_by_name, now_iso, log=print):
    """Returns (featured, dropped, corrections, audit).

    Mutates the offer records of the candidates in place with re-verified
    prices — the fresh number is the true one, and discarding it would leave a
    price we have just proven wrong sitting in products.json.
    `corrections` lets the caller persist the same change to the DB.
    """
    featured, dropped, corrections, audit = [], [], [], []
    for before, p in candidates:
        log(f"  {p['id']}: gap {before['gap_crc']:,} ({before['gap_pct']}%) — re-verifying")
        live_ok, changed = True, []
        for o in p["offers"]:
            adapter = adapters_by_name.get(o["retailer"])
            price, ts = adapter.live_price(o["url"], MAX_AGE_S) if adapter else (None, None)
            if price is None:
                live_ok = False
                continue
            # A candidate really WAS re-read at export time, so its stamp moves
            # forward even when the price agrees — that is the one place in this
            # engine where a fresh stamp is earned rather than assumed. The time
            # still comes from the fetch, never from the clock.
            o["scraped_at"] = ts or o["scraped_at"]
            moved = price != o["price_crc"]
            if moved:
                changed.append({"retailer": o["retailer"], "was": o["price_crc"],
                                "now": price})
                o["price_crc"] = price
            corrections.append({"url": o["url"], "price_crc": price,
                                "scraped_at": o["scraped_at"], "price_moved": moved})
        # cheapest first is a contract of the offers array, and a correction
        # can reorder it
        p["offers"].sort(key=lambda x: x["price_crc"] or 9_000_000_000_000)
        p["scraped_at"] = max(o["scraped_at"] for o in p["offers"])

        after = gap_of(p)
        if not live_ok:
            reason = "unverifiable"
        elif not after:
            reason = "no_comparable_price"
        elif after["cheapest_retailer"] != before["cheapest_retailer"]:
            reason = "verdict_flipped"
        elif not qualifies(after):
            reason = "gap_below_threshold"
        else:
            reason = None

        # A verdict is only as verified as its STALEST input: comparing a price
        # read 2 minutes ago against one read 2 hours ago is a 2-hour-old claim.
        verified_at = min((o["scraped_at"] for o in p["offers"] if o.get("scraped_at")),
                          default=now_iso())
        row = {"id": p["id"], "category": p["category"],
               "gap_before": before, "gap_after": after,
               "price_changes": changed, "verified_at": verified_at,
               "dropped_reason": reason}
        audit.append(row)
        if reason:
            dropped.append(row)
            log(f"  DROP {p['id']}: {reason} — gap {before['gap_crc']:,} -> "
                f"{(after or {}).get('gap_crc', 'n/a')} ({changed or 'no price change'})")
        else:
            featured.append({"id": p["id"], "category": p["category"],
                             **after, "verified_at": verified_at})
    return featured[:SLOTS], dropped, corrections, audit


def policy(candidates_seen, dropped, audit):
    return {
        "candidates_considered": candidates_seen,
        "slots": SLOTS,
        "min_gap_pct": MIN_GAP_PCT,
        "min_gap_crc": MIN_GAP_CRC,
        "reverify_window_s": MAX_AGE_S,
        "products_with_price_change": sum(1 for r in audit if r["price_changes"]),
        "dropped_count": len(dropped),
        "drop_rate_pct": round(100 * len(dropped) / candidates_seen, 1) if candidates_seen else 0.0,
        "drop_reasons": sorted({r["dropped_reason"] for r in dropped}),
        "note": ("every offer of every candidate is re-fetched live at export time; "
                 "a candidate whose verdict flips, whose gap falls under the floor, or "
                 "whose price cannot be read is dropped from the slot rather than shown"),
    }
