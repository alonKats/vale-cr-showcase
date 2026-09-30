"""Matching cascade, Tiers 1a-3. Deterministic, precision over recall.

Unchanged from v1 in behaviour; what changed is that normalization and the
Tier-2 fingerprint are now driven by the CategoryProfile (`match_keys`,
`fingerprint`) instead of hardcoded refrigerator specs, and matching runs
strictly inside one category.

Accept:      1a EAN exact (1.00) · 1b model-stem exact (0.99)
             2  spec fingerprint (0.75) ONLY when unambiguous (exactly one
                cross-retailer candidate pair AND both sides model-less)
Never auto:  3  fuzzy title, same brand only (0.55) -> review queue
Everything else stays unmatched. A false match is worse than a missed one.
"""
import difflib
from collections import defaultdict

from normalize import normalize


class DSU:
    def __init__(self):
        self.p = {}

    def find(self, x):
        self.p.setdefault(x, x)
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a, b):
        self.p[self.find(a)] = self.find(b)


def collapse_variants(offers, profile):
    """Collapse SAME-RETAILER listings of one SKU published once per colour.

    One chain lists `iPhone 17 Air Negro / Blanco / Dorado` as three SKUs, which
    turned a clean 2-way comparison into a 4-offer ambiguous group that Tier 2
    refuses to auto-accept. Collapsing removes the ambiguity WITHOUT weakening
    the auto-accept rule.

    The key is every DECLARED spec attribute (profile.spec_keys) plus brand and
    model stem — never a colour-token heuristic on the title. That distinction
    is load-bearing: `Edge 70 Fusion FIFA Azul` is 4GB RAM where its three
    sibling colours are 8GB, so a token-level colour collapse would merge a
    genuinely different product. Declared attributes differ -> it does not
    collapse, no special case needed.

    Guard — the group must have a COMPLETE declared identity
    (`profile.fingerprint_of` returns a value). A missing attribute is not
    agreement: one chain writes `iPhone 16 8GB + 128GB Teal`, whose storage the
    profile cannot parse, and treating two unparsed storages as "identical"
    merged a 128GB and a 256GB phone (measured, 2 bad groups out of 39 before
    this guard). Requiring the fingerprint reuses the identity the category
    already declares instead of inventing a second rule.

    Second guard: at least one member must carry a parsed collapsible value, so
    that "these differ only in colour" rests on observed evidence rather than
    on two blanks agreeing.

    Returns (representative_offers, variants_by_representative_id). The
    representative is the cheapest listing in the group — the one a shopper
    would actually buy — so downstream price logic needs no changes.
    """
    if not profile.collapsible_keys:
        return list(offers), {}

    groups, has_colour = defaultdict(list), defaultdict(bool)
    for o in offers:
        n = normalize(o["raw_title"], profile, o.get("brand_hint"), o.get("model_hint"))
        specs = tuple(n["attributes"][k] for k in profile.spec_keys)
        if not profile.fingerprint_of(n["brand"], n["attributes"]):
            groups[("_solo", o["id"])].append(o)      # no complete identity -> never collapsible
            continue
        key = (o["retailer_id"], n["brand"], n["stem"], specs)
        groups[key].append(o)
        if any(n["attributes"][k] is not None for k in profile.collapsible_keys):
            has_colour[key] = True

    reps, variants = [], {}
    for key, members in groups.items():
        if len(members) > 1 and not has_colour[key]:
            reps.extend(members)                      # no colour evidence -> leave alone
            continue
        members.sort(key=lambda o: (o["cash_price_crc"] or float("inf"), o["id"]))
        rep = members[0]
        reps.append(rep)
        if len(members) > 1:
            variants[rep["id"]] = members
    reps.sort(key=lambda o: o["id"])
    return reps, variants


def run_matching(offers, profile):
    """offers: dicts with id, retailer_id, raw_title, brand_hint, model_hint, ean.
    Returns (norm_by_id, accepted_pairs, review_queue).
    accepted pair = (id_a, id_b, method, score, decided_by)."""
    norm = {o["id"]: normalize(o["raw_title"], profile, o.get("brand_hint"),
                               o.get("model_hint")) for o in offers}
    accepted, review, matched = [], [], set()
    by_id = {o["id"]: o for o in offers}

    def cross_retailer(ids):
        return len({by_id[i]["retailer_id"] for i in ids}) > 1

    # ---- Tier 1a: EAN exact
    by_ean = defaultdict(list)
    for o in offers:
        ean = (o.get("ean") or "").strip()
        if ean and len(ean) >= 12 and len(set(ean)) > 2:
            by_ean[ean.lstrip("0")].append(o["id"])
    for ean, ids in by_ean.items():
        if len(ids) > 1 and cross_retailer(ids):
            for other in ids[1:]:
                accepted.append((ids[0], other, "tier1a_ean", 1.00, "engine"))
            matched.update(ids)

    # ---- Tier 1b: model stem exact, brands must not contradict
    # This tier auto-accepts at 0.99 and carried 95% of all accepted pairs, and
    # until 2026-08-04 the stem was its ONLY precondition — Tier 2 folds brand
    # into the fingerprint and Tier 3 requires brand equality, but the tier we
    # trust most had no brand check. It rests on "a manufacturer model number is
    # globally unique", which is true of a model number and false of a spec token
    # the extractor mistook for one. Measured: `HDR10` passed model_of (three
    # letters, two digits, present in every TV title) and merged a Xiaomi A Pro
    # 43" at one chain with an LG 65" Serie 7300 at another into one product carrying
    # the top price gap in the catalogue, 151%.
    #
    # Two DISTINCT KNOWN brands under one stem is not a match this engine can
    # defend, so it goes to review instead of `accepted` — precision over recall,
    # the same call Tier 2 already makes. An unknown brand is not a contradiction
    # and still matches: refusing those would drop every retailer that omits the
    # brand from its title.
    by_stem = defaultdict(list)
    for o in offers:
        s = norm[o["id"]]["stem"]
        if s:
            by_stem[s].append(o["id"])
    for stem, ids in by_stem.items():
        if len(ids) < 2 or not cross_retailer(ids):
            continue
        brands = {norm[i]["brand"] for i in ids if norm[i]["brand"]}
        if len(brands) > 1:
            review.append({"category": profile.id, "method": "tier1b_brand_conflict",
                           "score": 0.99, "stem": stem, "brands": sorted(brands),
                           "offers": [{"id": i, "retailer_id": by_id[i]["retailer_id"],
                                       "brand": norm[i]["brand"],
                                       "title": by_id[i]["raw_title"]} for i in ids]})
            continue
        for other in ids[1:]:
            accepted.append((ids[0], other, "tier1b_model_stem", 0.99, "engine"))
        matched.update(ids)

    # ---- Tier 2: spec fingerprint from profile.fingerprint, unambiguous only
    by_fp = defaultdict(list)
    for o in offers:
        if o["id"] in matched:
            continue
        n = norm[o["id"]]
        fp = profile.fingerprint_of(n["brand"], n["attributes"])
        if fp:
            by_fp[fp].append(o["id"])
    for fp, ids in by_fp.items():
        if len({by_id[i]["retailer_id"] for i in ids}) < 2:
            continue
        # Auto-accept ONLY if unambiguous AND neither side carries a model
        # number. If one side has a model and the other doesn't, an exact
        # Tier-1b match was impossible and a same-spec variant may exist
        # (v1 hand-check caught two such false-positive risks). Precision over
        # recall -> review queue.
        if len(ids) == 2 and all(norm[i]["model"] is None for i in ids):
            accepted.append((ids[0], ids[1], "tier2_fingerprint_unambiguous", 0.75, "engine"))
            matched.update(ids)
        else:
            review.append({"category": profile.id,
                           "method": "tier2_fingerprint_candidate", "score": 0.75,
                           "fingerprint": list(map(str, fp)),
                           "offers": [{"id": i, "retailer_id": by_id[i]["retailer_id"],
                                       "title": by_id[i]["raw_title"]} for i in ids]})

    # ---- Tier 3: fuzzy title, same brand, candidates only (0.55 < 0.75 -> never auto)
    rest = [o["id"] for o in offers if o["id"] not in matched]
    for i, a in enumerate(rest):
        na = norm[a]
        if not na["brand"]:
            continue
        for b in rest[i + 1:]:
            nb = norm[b]
            if nb["brand"] != na["brand"]:
                continue
            if by_id[a]["retailer_id"] == by_id[b]["retailer_id"]:
                continue
            ratio = difflib.SequenceMatcher(None, na["name_clean"], nb["name_clean"]).ratio()
            if ratio >= 0.80:
                review.append({"category": profile.id, "method": "tier3_fuzzy_title",
                               "score": 0.55, "similarity": round(ratio, 3),
                               "offers": [{"id": a, "retailer_id": by_id[a]["retailer_id"],
                                           "title": by_id[a]["raw_title"]},
                                          {"id": b, "retailer_id": by_id[b]["retailer_id"],
                                           "title": by_id[b]["raw_title"]}]})

    return norm, accepted, review


def build_products(offers, norm, accepted, profile):
    """Union-find accepted pairs into canonical products; every offer gets a
    product (single-offer products included)."""
    dsu = DSU()
    for a, b, *_ in accepted:
        dsu.union(a, b)
    groups = defaultdict(list)
    for o in offers:
        groups[dsu.find(o["id"])].append(o["id"])

    def signal(i):
        n = norm[i]
        return (sum(v is not None for v in n["attributes"].values())
                + (n["model"] is not None) + (n["brand"] is not None))

    products = []
    for _root, ids in groups.items():
        best = max(ids, key=signal)
        n = norm[best]
        # merge attributes across the group: first non-null wins, canonical first
        merged = {}
        order = [best] + [i for i in ids if i != best]
        for key in profile.attribute_keys:
            merged[key] = next((norm[i]["attributes"][key] for i in order
                                if norm[i]["attributes"][key] is not None), None)
        products.append({
            "offer_ids": sorted(ids), "canonical_offer_id": best,
            "category": profile.id,
            "brand": n["brand"] or next((norm[i]["brand"] for i in order if norm[i]["brand"]), None),
            "model": n["model"] or next((norm[i]["model"] for i in order if norm[i]["model"]), None),
            "attributes": merged,
        })
    return products
