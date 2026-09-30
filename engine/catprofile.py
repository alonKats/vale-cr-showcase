"""CategoryProfile loader (spec-v2 §4.2).

One JSON file per category under profiles/. Adding a category = adding a file.
No engine code changes: sources, the keep/drop filter, the brand vocabulary and
every `attributes` extractor are all declared in the profile and compiled here.

Extractor kinds (category-agnostic, so they never need extending per category):
  number  -> ordered `rules`, first match wins; each rule is
             {pattern, scale=1, min_raw, max_raw}; `round` = decimal places
  enum    -> ordered `values`, first match wins; each is {value, patterns[]}
"""
import json
import re
from pathlib import Path

PROFILE_DIR = Path(__file__).parent / "profiles"
DEFAULTS_FILE = "_defaults.json"


class CategoryProfile:
    def __init__(self, raw: dict, defaults: dict):
        d = {**defaults, **raw}
        self.raw = raw
        self.id = d["id"]
        self.label = d["label"]
        self.sources = d.get("sources", {})
        self.card_title = d.get("card_title", "{brand} {model}")
        self.match_keys = d.get("match_keys", ["brand", "model"])
        self.fingerprint = d.get("fingerprint", [])
        self.fingerprint_round = d.get("fingerprint_round", {})
        self.price_sentinels = set(d.get("price_sentinels", []))

        f = d.get("filter", {})
        self.include_res = [re.compile(p) for p in f.get("include", [])]
        self.exclude_res = [re.compile(p) for p in f.get("exclude", [])]
        self.price_floor = f.get("price_floor_crc", 0)
        # Declared upper bound for a REAL retail price in this category. Its job
        # is to catch the sentinel we have not met yet: a named-value list only
        # guards the placeholders some adapter already shipped, and one chain's
        # ₡10.000.000 proved that a guard written before a source exists does not
        # cover that source. A ceiling is a claim about the market, so it keeps
        # working when a new adapter invents a new placeholder. 0 = no ceiling.
        self.price_ceiling = f.get("price_ceiling_crc", 0)

        self.brands = list(d.get("brands", []))
        self.brand_aliases = dict(d.get("brand_aliases", {}))
        # word-boundary match: bare `"LG" in title` also fires inside ALGO/BULGARI
        self._brand_res = [(re.compile(rf"(?<![A-Z0-9]){re.escape(b)}(?![A-Z0-9])"), b)
                           for b in self.brands]
        self._alias_res = [(re.compile(rf"(?<![A-Z0-9]){re.escape(a)}(?![A-Z0-9])"), c)
                           for a, c in self.brand_aliases.items()]

        self.model_blocklist = [re.compile(p) for p in d.get("model_blocklist", [])]
        self.model_stop_tokens = set(d.get("model_stop_tokens", []))

        self.attributes = d.get("attributes", [])
        self.attribute_keys = [a["key"] for a in self.attributes]
        self._extractors = [(a["key"], _compile_extractor(a.get("extract") or {}))
                            for a in self.attributes]
        # attributes a retailer varies per SKU without changing the product
        # (colour). Same-retailer listings identical on every OTHER declared
        # attribute collapse into one offer — see match.collapse_variants.
        self.collapsible_keys = [a["key"] for a in self.attributes if a.get("collapsible")]
        self.spec_keys = [k for k in self.attribute_keys if k not in self.collapsible_keys]
        clash = set(self.collapsible_keys) & set(self.fingerprint)
        if clash:
            raise ValueError(f"{self.id}: {sorted(clash)} is both an identity key and "
                             f"collapsible — a profile cannot say a value both "
                             f"distinguishes products and does not")

    # ---- filter ---------------------------------------------------------
    def trusts(self, source_id: str) -> bool:
        """A source whose URL *is* the category (a retailer category page) does
        not need the include test — one chain lists 'Samsung Galaxy S25 Ultra'
        with no category word anywhere in the title, and the include filter
        dropped 63 of its 95 phones. Exclude patterns and the price floor still apply."""
        return bool((self.sources.get(source_id) or {}).get("trusted_category"))

    def keeps(self, name_clean: str, price_crc, trusted: bool = False) -> bool:
        """Is this listing a member of the category? Declared, not coded."""
        if not trusted and self.include_res \
                and not any(r.search(name_clean) for r in self.include_res):
            return False
        if any(r.search(name_clean) for r in self.exclude_res):
            return False
        price = price_crc or 0
        if self.price_ceiling and price > self.price_ceiling:
            return False
        return price >= self.price_floor and int(price) not in self.price_sentinels

    # ---- brand / attributes --------------------------------------------
    def brand_of(self, name_clean: str, hint: str = None) -> str | None:
        if hint:
            h = _clean(hint)
            h = self.brand_aliases.get(h, h)
            if h in self.brands:
                return h
        for rx, canon in self._alias_res:
            if rx.search(name_clean):
                return canon
        for rx, brand in self._brand_res:
            if rx.search(name_clean):
                return brand
        return None

    def attributes_of(self, name_clean: str) -> dict:
        """Always returns EVERY declared key. Unfound = None, never defaulted."""
        return {key: fn(name_clean) for key, fn in self._extractors}

    def fingerprint_of(self, brand, attrs) -> tuple | None:
        """Tier-2 spec fingerprint from profile-declared keys; None if incomplete."""
        if not self.fingerprint:
            return None
        vals = []
        for key in self.fingerprint:
            v = brand if key == "brand" else attrs.get(key)
            if v is None:
                return None
            step = self.fingerprint_round.get(key)
            if step:
                v = round(round(v / step) * step, 3)
            vals.append(v)
        return tuple(vals)

    def to_json(self) -> dict:
        """categories.json record — what the UI needs to generate facets AND to
        compose a spec line with no category-specific code.

        `unit` alone cannot do that: a laptop declares 512 GB storage and 16 GB
        RAM, so "512 GB · 16 GB" is ambiguous. `display` is the per-attribute
        template — substitute {value} and you have the phrase. `value_labels`
        maps an enum's internal key (TOP_LOAD, the matcher's identity token) to
        its es-CR reading; the app does
            attr.display.replace("{value}", attr.value_labels?.[v] ?? v)
        and needs to know nothing about washing machines."""
        return {
            "id": self.id,
            "label": self.label,
            "attributes": [{"key": a["key"], "label": a.get("label", a["key"]),
                            "unit": a.get("unit"), "facet": a.get("facet", "enum"),
                            "display": a.get("display", "{value}"),
                            "values": _enum_values(a),
                            "value_labels": a.get("value_labels"),
                            "collapsible": bool(a.get("collapsible"))}
                           for a in self.attributes],
            "card_title": self.card_title,
            "match_keys": self.match_keys,
            "retailers": sorted(self.sources.keys()),
        }


def _enum_values(attr: dict):
    """The closed value set of an enum extractor — the app builds a facet from
    this instead of scanning every product. None for open kinds (number/text)."""
    ex = attr.get("extract") or {}
    if ex.get("kind") != "enum":
        return None
    return [v["value"] for v in ex.get("values", [])]


def _clean(text: str) -> str:
    import unicodedata
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", text.upper()).strip()


def _compile_extractor(spec: dict):
    kind = spec.get("kind")
    if kind == "number":
        rules = [(re.compile(r["pattern"]), r.get("scale", 1),
                  r.get("min_raw"), r.get("max_raw")) for r in spec.get("rules", [])]
        digits = spec.get("round", 1)

        def num(text):
            for rx, scale, lo, hi in rules:
                m = rx.search(text)
                if not m:
                    continue
                try:
                    raw = float(m.group(1).replace(",", "."))
                except (TypeError, ValueError):
                    continue
                if (lo is not None and raw < lo) or (hi is not None and raw > hi):
                    continue
                v = round(raw * scale, digits)
                return int(v) if digits == 0 else v
            return None
        return num

    if kind == "text":
        # capture group 1 as a normalized string — the identity token a listing
        # carries instead of a model number (phone product lines, for instance)
        rules = [re.compile(r["pattern"]) for r in spec.get("rules", [])]

        def text(t):
            for rx in rules:
                m = rx.search(t)
                # `m.group(1)` is None whenever a profile writes an OPTIONAL
                # capture group — `\bIPAD\s*(PRO|AIR|MINI)?` matches a plain
                # "iPad 11" with nothing captured. Without this guard that
                # returned None into re.sub() and killed the entire run with a
                # TypeError, mid-category (observed 2026-08-06, tablets).
                # A profile is DATA: the engine's contract is that adding a
                # category needs no code change, and that only holds if bad data
                # degrades to "attribute not found" instead of taking the
                # pipeline down. Falls through to the next rule, so a later
                # pattern can still match.
                if m and m.group(1):
                    return re.sub(r"\s+", " ", m.group(1)).strip()
            return None
        return text

    if kind == "enum":
        values = [(v["value"], [re.compile(p) for p in v["patterns"]])
                  for v in spec.get("values", [])]

        def enum(text):
            for val, pats in values:
                if any(p.search(text) for p in pats):
                    return val
            return None
        return enum

    return lambda _text: None


def load_profiles(only: list[str] = None) -> list[CategoryProfile]:
    defaults = json.loads((PROFILE_DIR / DEFAULTS_FILE).read_text(encoding="utf-8"))
    out = []
    for p in sorted(PROFILE_DIR.glob("*.json")):
        if p.name.startswith("_"):
            continue
        raw = json.loads(p.read_text(encoding="utf-8"))
        if only and raw["id"] not in only:
            continue
        out.append(CategoryProfile(raw, defaults))
    return out
