"""Polite cached HTTP fetcher. stdlib only.

Politeness contract (spec.md §9):
- per-host delay floor, default ~1 req/sec, raised where the site asks for more
- honest descriptive User-Agent
- robots.txt compliance, verified manually (dates below); enforced by the
  declarative HOST_DISALLOW table rather than by per-site code
- guard rails below enforce the blocked paths; never touches cart/checkout
- every response cached to engine/cache/ keyed by sha256(url); re-runs cost zero
  requests unless a caller passes max_age (the scheduled --refresh path)
"""
import hashlib
import json
import ssl
import time
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

# python.org macOS builds ship without a wired CA bundle. Prefer certifi when
# it is installed (one retailer host needs a root the system bundle lacks);
# fall back to the system bundle. Cert verification STAYS ON either way.
try:
    import certifi
    _CA_FILE = certifi.where()
    _SSL_CTX = ssl.create_default_context(cafile=_CA_FILE)
except ImportError:
    _CA_FILE = None
    _SSL_CTX = ssl.create_default_context()
    try:
        _SSL_CTX.load_verify_locations("/etc/ssl/cert.pem")
    except (FileNotFoundError, ssl.SSLError):
        pass

CACHE_DIR = Path(__file__).parent / "cache"
CERT_DIR = Path(__file__).parent / "certs"
UA = "vale-cr-engine/0.2 (price comparison; +https://vale.cr/acerca)"

# Hosts that serve an INCOMPLETE certificate chain — the leaf is real and valid,
# the server just forgets to send the intermediate. The fix is to supply the
# missing intermediate ourselves, per host, from a PEM committed under certs/;
# verification stays fully ON and stays on for every other host.
#
# The alternative (an unverified context, or CERT_NONE anywhere near the shared
# opener) would disable verification for the whole engine to work around one
# misconfigured server — that trades a real security property for a convenience,
# and the blast radius would be every retailer we fetch. Production pins one
# GlobalSign intermediate this way, with its expiry date recorded next to it so
# the fetch fails loudly on that day rather than silently skipping verification.
HOST_EXTRA_CA: dict[str, str] = {
    # "shop.example": "some-intermediate.pem",
}
_host_ctx = {}


def _ctx_for(host: str) -> ssl.SSLContext:
    """Default verifying context, plus this host's missing intermediate if it
    has one. Never returns an unverified context."""
    pem = HOST_EXTRA_CA.get(host)
    if not pem:
        return _SSL_CTX
    if host not in _host_ctx:
        ctx = ssl.create_default_context(cafile=_CA_FILE) if _CA_FILE \
            else ssl.create_default_context()
        ctx.load_verify_locations(str(CERT_DIR / pem))
        _host_ctx[host] = ctx
    return _host_ctx[host]

# Per-host politeness floor, seconds between real network hits. Retailer pages
# get ~1 req/s. Static image CDNs get a shorter floor (they are built to serve
# assets and one product photo is far cheaper than a rendered page). A site that
# publishes its own Crawl-delay gets exactly what it asked for, however
# expensive that makes it — production honours one retailer's `Crawl-delay: 90`
# literally, which makes it two orders of magnitude dearer per product than any
# other source and is why it is declared but disabled on the daily timer.
#
# One rule worth writing down: a retailer that serves its product photos off
# the SAME host as its pages must be declared here explicitly, because
# `fetch_bytes` relaxes an undeclared image host to IMAGE_HOST_DELAY and
# `setdefault` cannot lower a value that is already present. Leaving such a host
# undeclared quietly tripled the rate at one retailer's application server.
DEFAULT_DELAY = 1.1
HOST_DELAY: dict[str, float] = {
    "nominatim.openstreetmap.org": 1.1,   # their published minimum
}
IMAGE_HOST_DELAY = 0.35
_last_hit = {}

# hard refusal list -- never fetch these path fragments, per robots + own policy
FORBIDDEN = ["/checkout", "/cart", "/customer", "/login", "/account", "/wishlist",
             "/catalogsearch", "/onestepcheckout", "/espiar", "/catalog/category/view",
             "/catalog/product/view", "/review/product", "/sendfriend"]

# Per-host robots rules that FORBIDDEN cannot express, as data instead of code.
# Two rule shapes, matching how robots.txt actually reads:
#   "/foo/"  -> PATH PREFIX, like `Disallow: /foo/`. Prefix and not substring is
#               load-bearing: `Disallow: /catalog/` blocks /catalog/... but says
#               nothing about /media/catalog/product/....jpg, which is where two
#               retailers serve their product photos. A substring test would
#               have silently killed image coverage for both.
#   other    -> substring anywhere in the URL, like `Disallow: /*cat=`.
# The literal "?" entry means "no query string at all on this host".
#
# Every entry is verified by hand against the site's live robots.txt and carries
# the date it was read; production holds one block per retailer. This snapshot
# ships the table empty apart from an illustrative entry for a host that does
# not exist.
HOST_DISALLOW: dict[str, list[str]] = {
    "norte.example": ["?", "/catalog/", "/search", "/customer/"],
}


class FetchError(Exception):
    pass


def _guard(url: str):
    low = url.lower()
    for frag in FORBIDDEN:
        if frag in low:
            raise FetchError(f"refusing forbidden path: {url}")
    path = urllib.parse.urlsplit(low).path
    for host, frags in HOST_DISALLOW.items():
        if not _host(low).endswith(host.lstrip(".")) and host not in _host(low):
            continue
        for frag in frags:
            hit = path.startswith(frag) if frag.startswith("/") else frag in low
            if hit:
                raise FetchError(f"{host} robots disallows {frag!r}: {url}")


def _host(url: str) -> str:
    return urllib.parse.urlsplit(url).netloc.lower()


def _is_local(url: str) -> bool:
    """`file://` bodies (fixtures, tests) go through the same cache and guard
    as a network fetch but are neither throttled nor counted as requests."""
    return url.lower().startswith("file:")


def _throttle(url: str):
    if _is_local(url):
        return
    host = _host(url)
    delay = HOST_DELAY.get(host, DEFAULT_DELAY)
    wait = delay - (time.time() - _last_hit.get(host, 0.0))
    if wait > 0:
        time.sleep(wait)


# Real network hits per host since import. Published so a scheduled --refresh
# run can prove it stayed polite BEFORE it goes on a timer, instead of the
# request rate being something nobody looks at until a retailer complains.
_hits = {}
_t0 = time.time()


def net_stats() -> dict:
    elapsed = time.time() - _t0
    total = sum(_hits.values())
    return {
        "requests": total,
        "wall_s": round(elapsed, 1),
        "per_host": {h: {"requests": n,
                         "min_delay_s": HOST_DELAY.get(h, DEFAULT_DELAY),
                         "observed_rate_per_s": round(n / elapsed, 3) if elapsed else None}
                     for h, n in sorted(_hits.items(), key=lambda kv: -kv[1])},
        "basis": "real network hits only; cache reads are not requests",
    }


# ---------------------------------------------------------------- transients
# WHY THIS EXISTS. 2026-08-28: five independent retailers on four different
# platforms all reported `0 scraped, 0 kept` for `lavadoras` in the same run. Five simultaneous
# retailer outages is not a thing; it was a transient failure burst. It
# recovered on its own by the next morning's run (lavadoras 113 -> 582
# scraped), but the run in between PUBLISHED the hole: the catalogue fell
# 3.991 -> 3.242 and 964 live product URLs became 404s, which is what Search
# Console had been reporting as "not found" since 2026-08-23.
#
# Every adapter reacts to a fetch failure with `break`, `continue` or
# `return []` — 21 call sites — because at the call site a failure and an
# empty page are genuinely indistinguishable. Patching 21 sites would be
# patching the symptom. A transient is a FETCHER concern, so it is retried
# here, once, where every adapter gets it for free.
#
# 429 and 5xx are retried; 403/404/401/410 are NOT. A WAF block or a missing
# page is a settled answer, and hammering it is both pointless and impolite —
# one retailer has answered 403 to every request since 2026-08-27 and must not
# be retried three times per page for it.
_TRANSIENT_STATUS = {408, 425, 429, 500, 502, 503, 504}
# Not a failure to reach the source — the source is telling us the thing is not
# there. A delisted product is exactly the catalogue change the collapse guard
# is meant to be able to SEE, so it must not be disguised as a network fault.
_GONE_STATUS = {404, 410}
_ATTEMPTS = 3
_BACKOFF_S = (2.0, 6.0)          # after attempt 1, after attempt 2
_MAX_RETRY_AFTER_S = 30.0        # a server asking for more is a no, not a wait

# Fetches that exhausted every attempt. THE POINT OF THIS LEDGER: without it a
# failed source and an empty source produce the same artifact — 0 offers — and
# the run reports success either way. `run.py` attributes these per source and
# `export.assert_contract` refuses to publish a collapse that a failure
# explains. See `feedback_a_guard_that_logs_but_has_no_reader_is_not_a_guard`.
_failures: list[dict] = []


def fetch_failures() -> list[dict]:
    """Every fetch that gave up, in order. Callers snapshot len() around a unit
    of work to attribute failures to it."""
    return list(_failures)


def clear_failures() -> None:
    _failures.clear()


def _retry_after(e) -> float | None:
    try:
        v = float((e.headers or {}).get("Retry-After", ""))
    except (TypeError, ValueError, AttributeError):
        return None
    return v if 0 <= v <= _MAX_RETRY_AFTER_S else None


def _record_failure(url: str, err, attempts: int = 1) -> None:
    """The one place a failed fetch is recorded, so no caller can forget to.
    `_get` is also what `fetch_bytes` uses, so image fetches land here too."""
    _failures.append({"host": _host(url), "url": url,
                      "reason": f"{type(err).__name__}: {err}"[:200],
                      "attempts": attempts})


def _get(url: str, max_bytes: int, headers: dict | None = None) -> bytes:
    """`_get_once` with a bounded retry on transient conditions only.

    Each attempt goes through `_throttle`, so the politeness floor holds across
    retries exactly as it does across ordinary requests — a retry is a normal
    request that happens to be a repeat, not a licence to burst."""
    last = None
    for attempt in range(1, _ATTEMPTS + 1):
        try:
            return _get_once(url, max_bytes, headers)
        except urllib.error.HTTPError as e:
            last = e
            if e.code not in _TRANSIENT_STATUS:
                # Settled answer: do not hammer it. Whether it is LEDGERED
                # depends on what it settles, and the distinction is the whole
                # point of the ledger.
                #
                # 404/410 = the product is GONE. That is a real catalogue
                # change and the correct answer to the question we asked, not a
                # failure to reach the retailer. Measured on the first full run
                # of this code: one chain alone returns 3 of them in
                # `smartwatches` from ordinary delisting. Ledger those and `failed_hosts`
                # holds most retailers every single run, which would make the
                # collapse guard tell the reader "this is a transient fault"
                # about a genuine shrink — wrong in the direction that hurts.
                #
                # Everything else (403 WAF, 401, 451…) IS a failure to reach a
                # source that may well still stock the product, and must be
                # recorded — without it a WAF-blocked retailer's daily 403s
                # leave `failed_hosts` empty and its zero reads as a real change.
                if e.code not in _GONE_STATUS:
                    _record_failure(url, e)
                raise
            # 429/503 may name their own wait; honour it up to a sane cap.
            wait = _retry_after(e)
        except (urllib.error.URLError, TimeoutError, ssl.SSLError, ConnectionError) as e:
            # URLError wraps the socket errors that a flaky link produces:
            # timeouts, resets, DNS blips. This is the shape the 2026-08-28
            # burst took.
            last = e
            wait = None
        if attempt == _ATTEMPTS:
            break
        time.sleep(wait if wait is not None else _BACKOFF_S[attempt - 1])
    _record_failure(url, last, _ATTEMPTS)
    raise FetchError(f"{_ATTEMPTS} attempts failed: {url} ({last!r})")


def _get_once(url: str, max_bytes: int, headers: dict | None = None) -> bytes:
    _throttle(url)
    hdrs = {"User-Agent": UA, "Accept": "*/*"}
    hdrs.update(headers or {})
    req = urllib.request.Request(url, headers=hdrs)
    host = _host(url)
    if not _is_local(url):
        _hits[host] = _hits.get(host, 0) + 1
    try:
        with urllib.request.urlopen(req, timeout=30, context=_ctx_for(host)) as r:
            raw = r.read(max_bytes + 1)
    finally:
        _last_hit[host] = time.time()
    # A body cut off at the read cap is a SILENT DROP, not a small body: the
    # truncated JSON fails to parse, the adapter swallows the error and the
    # category reports "0 scraped" as though the retailer stocked nothing.
    # (Measured: one retailer's celulares response is ~3 MB and did exactly this.)
    # Refusing here means the corrupt body is never written to the cache, so
    # the failure cannot outlive the run that caused it.
    if len(raw) > max_bytes:
        raise FetchError(f"response exceeds the {max_bytes} B read cap "
                         f"(refusing to cache a truncated body): {url}")
    return raw


def fetch(url: str, max_bytes: int = 12_000_000, max_age: float | None = None) -> str:
    """Return body text for url, from cache if present.

    `max_age` (seconds) makes the cache entry expire: used by the featured-slot
    price re-verification, where a body older than the window is worthless
    (that IS the thing being checked). It stays cache-first inside the window,
    so an immediate re-run is still zero-request and byte-identical."""
    _guard(url)
    key = hashlib.sha256(url.encode()).hexdigest()[:24]
    body_p = CACHE_DIR / f"{key}.body"
    meta_p = CACHE_DIR / f"{key}.meta.json"
    if body_p.exists() and (max_age is None
                            or time.time() - body_p.stat().st_mtime <= max_age):
        return body_p.read_text(encoding="utf-8", errors="replace")

    text = _get(url, max_bytes).decode("utf-8", errors="replace")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    body_p.write_text(text, encoding="utf-8")
    meta_p.write_text(json.dumps({"url": url, "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")}))
    return text


def fetch_json(url: str, max_age: float | None = None):
    return json.loads(fetch(url, max_age=max_age))


def fetched_at(url: str) -> str | None:
    """UTC stamp of when the bytes behind `url` were ACTUALLY retrieved.

    This is the honest basis for a product's freshness stamp. Export time is
    not: a cache-first engine re-runs in 30 seconds off bodies that may be
    hours old, and stamping those with now() turns an honest limitation ("this
    price is 3 hours old") into a specific untrue assertion ("verified at
    16:50"). The body file's mtime IS the retrieval time — it is written at
    fetch and is already the clock the max_age expiry trusts, so freshness and
    expiry can never disagree.
    """
    key = hashlib.sha256((url or "").encode()).hexdigest()[:24]
    for p in (CACHE_DIR / f"{key}.body", BIN_CACHE / key):
        if p.exists():
            return datetime.fromtimestamp(p.stat().st_mtime, timezone.utc) \
                           .strftime("%Y-%m-%dT%H:%M:%SZ")
    return None


BIN_CACHE = CACHE_DIR / "bin"


def fetch_bytes(url: str, max_bytes: int = 8_000_000, cached_only: bool = False) -> bytes:
    """Binary fetch (product images), separately cached. Re-runs cost zero
    requests, same contract as fetch().

    `cached_only` returns what is already on disk and raises rather than going
    to the network. It is what `run.py --skip-images` means: download nothing
    new, but do not throw away the images we already have."""
    _guard(url)
    key = hashlib.sha256(url.encode()).hexdigest()[:24]
    p = BIN_CACHE / key
    if p.exists():
        return p.read_bytes()
    if cached_only:
        raise FetchError(f"not cached and cached_only is set: {url}")
    HOST_DELAY.setdefault(_host(url), IMAGE_HOST_DELAY)
    raw = _get(url, max_bytes)
    BIN_CACHE.mkdir(parents=True, exist_ok=True)
    p.write_bytes(raw)
    return raw
