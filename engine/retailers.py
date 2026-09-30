"""Retailer adapters — the interface, the shared parsers, and one example.

    class Retailer:
        id: str                      # the key a CategoryProfile declares under `sources`
        retailer_id: int             # db.RETAILERS primary key
        display_name: str            # the name that reaches the UI
        def fetch_category(self, profile, max_age) -> list[RawOffer]
        def live_price(self, url, max_age) -> (price_crc, fetched_at)

Every adapter reads a storefront at one of two rungs on the extraction ladder:

  rung 1  a platform's own public JSON (a catalog API, a collection feed)
  rung 2  schema.org structured data embedded in the page (JSON-LD or microdata)

There are no CSS selectors anywhere. A selector couples the price to someone
else's theme and rots on their next redesign; the structured data is what the
retailer publishes for search engines, and it changes far less often.

An adapter is PLATFORM behaviour, not shop behaviour: the production engine has
one class per storefront platform and a four-constant subclass per shop, so a
new retailer on a known platform costs no new parsing code. Which shops those
are, and how each is read, is withheld from this public snapshot (see README).

What ships here is `FixtureStore`, a rung-2 adapter that reads saved product
pages off disk through the same `fetcher` the network adapters use, so the
cache, the politeness floor, the retry policy and the failure ledger are all
exercised without a single request leaving the machine.

RawOffer:
  {retailer_id, retailer, raw_title, brand_hint, model_hint, ean, url, image,
   cash_price_crc, list_price_crc, in_stock, credit, sku, fetched_at}

`fetched_at` is when the RESPONSE THAT CARRIED THIS PRICE was really retrieved
— never the export time. It is the offer's freshness stamp all the way to the
UI, and the artifact contract asserts it can never be later than the export.
"""
import hashlib
import json
import re
from pathlib import Path

from fetcher import fetch, fetched_at, FetchError

LDJSON_RE = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
FIXTURE_DIR = Path(__file__).parent / "fixtures"


def ld_blocks(page_html):
    out = []
    for m in LDJSON_RE.finditer(page_html):
        try:
            out.append(json.loads(m.group(1)))
        except json.JSONDecodeError:
            pass
    return out


def ld_products(page_html):
    """Every ld+json @type=Product on a page, list- or object-shaped."""
    out = []
    for block in ld_blocks(page_html):
        for b in (block if isinstance(block, list) else [block]):
            if isinstance(b, dict) and b.get("@type") == "Product":
                out.append(b)
    return out


def _first_price(offers):
    """schema.org offers: dict or list, price str or number."""
    for o in (offers if isinstance(offers, list) else [offers]):
        if not isinstance(o, dict):
            continue
        try:
            return int(round(float(o.get("price"))))
        except (TypeError, ValueError):
            continue
    return None


def _money(value):
    """'452500.00' / 452500 / None -> 452500 / None. Integer colones only."""
    if value in (None, "", False):
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


class Retailer:
    id = None
    retailer_id = None
    display_name = None

    def fetch_category(self, profile, max_age: float | None = None) -> list:
        """`max_age` (seconds) expires the cache for PRICE-BEARING fetches only.

        Default None keeps interactive re-runs zero-network and byte-identical.
        The scheduled collector (`run.py --refresh`) passes a TTL so a daily run
        genuinely re-reads the pages that carry prices — without it the cache
        would re-serve the same bytes forever and the price history would record
        nothing while the run still looked successful."""
        raise NotImplementedError

    def live_price(self, url: str, max_age: float) -> tuple:
        """Re-read ONE product's current cash price straight from the retailer.

        Returns (price_crc, fetched_at) — the stamp travels with the price so a
        re-verified offer can carry its genuinely fresh time. (None, None) when
        the price cannot be read; the caller treats that as unverifiable, not
        as agreement.

        Used only by the featured-slot re-verification (featured.py) — a stale
        price under a verdict headline is an actively wrong recommendation."""
        raise NotImplementedError

    def source(self, profile):
        return profile.sources.get(self.id)


# ------------------------------------------------------------ fixture store
class FixtureStore(Retailer):
    """Rung 2 over saved pages: `fixtures/<id>/<category>/*.html`, each carrying
    one schema.org Product as JSON-LD, exactly as a real product page would.

    The pages are read through `fetcher.fetch` as `file://` URLs, so this
    adapter is the network adapters' shape end to end: guard, cache, freshness
    stamp from the cached body's mtime, failure ledger. The only difference is
    that the bytes come off disk.

    A profile declares it as
        "sources": {"norte": {"category_dir": "microondas", "trusted_category": true}}
    and the offer URL is whatever the page's JSON-LD says it is — a real https
    URL on this retailer's declared host, which is what the artifact contract
    will insist on before anything is published."""
    BASE = None

    def __init__(self):
        self._page_by_url = {}      # offer url -> fixture path, for live_price

    def _pages(self, profile):
        src = self.source(profile)
        if not src:
            return []
        return sorted((FIXTURE_DIR / self.id / src["category_dir"]).glob("*.html"))

    def _offer(self, p, page_ts):
        offer = p.get("offers") or {}
        if isinstance(offer, list):
            offer = offer[0] if offer else {}
        list_price = None
        for spec in offer.get("priceSpecification", []) or []:
            if str(spec.get("priceType", "")).endswith("ListPrice"):
                list_price = _money(spec.get("price"))
        gtin = str(p.get("gtin13") or p.get("gtin") or "")
        brand = p.get("brand")
        return {
            "retailer_id": self.retailer_id,
            "retailer": self.display_name,
            "raw_title": p.get("name", ""),
            "brand_hint": brand.get("name") if isinstance(brand, dict) else brand,
            "model_hint": p.get("mpn") or p.get("model"),
            "ean": gtin if len(gtin) in (12, 13, 14) and gtin.isdigit() else None,
            "url": offer.get("url") or p.get("url"),
            "image": p.get("image"),
            "cash_price_crc": _money(offer.get("price")),
            "list_price_crc": list_price,
            "in_stock": str(offer.get("availability", "")).endswith("InStock"),
            "credit": None,
            "sku": str(p.get("sku")) if p.get("sku") else None,
            "fetched_at": page_ts,
        }

    def fetch_category(self, profile, max_age=None):
        offers = []
        for path in self._pages(profile):
            url = path.resolve().as_uri()
            try:
                page_html = fetch(url, max_age=max_age)
            except (FetchError, OSError):
                continue
            page_ts = fetched_at(url)
            for p in ld_products(page_html):
                o = self._offer(p, page_ts)
                if o["url"]:
                    self._page_by_url[o["url"]] = path
                    offers.append(o)
                break                       # one Product per page
        return offers

    def live_price(self, url, max_age):
        path = self._page_by_url.get(url)
        if not path:
            return None, None
        furl = path.resolve().as_uri()
        try:
            page_html = fetch(furl, max_age=max_age)
        except (FetchError, OSError):
            return None, None
        for p in ld_products(page_html):
            price = _first_price(p.get("offers"))
            if price:
                return price, fetched_at(furl)
        return None, None


class TiendaNorte(FixtureStore):
    """Example retailer #1. Not a real shop; `norte.example` cannot resolve."""
    id = "norte"
    retailer_id = 1
    display_name = "Tienda Norte"
    BASE = "https://norte.example"


class TiendaSur(FixtureStore):
    """Example retailer #2. Same adapter, different host — which is the whole
    point of the platform-adapter design."""
    id = "sur"
    retailer_id = 2
    display_name = "Tienda Sur"
    BASE = "https://sur.example"


ADAPTERS = [TiendaNorte(), TiendaSur()]
DISPLAY_NAMES = {r.retailer_id: r.display_name for r in ADAPTERS}
BY_DISPLAY_NAME = {r.display_name: r for r in ADAPTERS}

# Parent group per retailer — two brands of one company are NOT competitors, and
# presenting them as such would sell a single retailer's price discrimination as
# a shopping choice. Asserted at export time (run.py) so a future adapter cannot
# quietly join an existing group. Keyed by display_name — the name that reaches
# the UI, which is the name a shopper would read as "a different shop".
#
# In production this table is where the ownership research lives: several
# Costa Rican chains that look independent share a parent, and one candidate
# retailer was rejected on exactly this check (its sitemap template gave the
# shared infrastructure away before the corporate page did).
PARENT_COMPANY = {
    TiendaNorte.display_name: "Grupo Norte (ejemplo)",
    TiendaSur.display_name: "Comercial Sur (ejemplo)",
}


def content_hash(o):
    basis = f"{o['raw_title']}|{o['cash_price_crc']}|{o['list_price_crc']}|{o['in_stock']}"
    return hashlib.sha256(basis.encode()).hexdigest()[:16]
