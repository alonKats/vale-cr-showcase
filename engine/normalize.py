"""Tier 0 normalization — category-agnostic.

v1 hardcoded the refrigerator vocabulary here (brands, capacity, door, finish,
`is_refrigerator`). v2 moves all of that into the CategoryProfile; what stays is
only what is true for every category: text cleanup, model-token extraction and
the model stem used by the Tier-1b matcher.
"""
import re
import unicodedata

MODEL_TOKEN_RE = re.compile(r"\b[A-Z0-9][A-Z0-9/.-]{3,18}\b")


def clean(text: str) -> str:
    """uppercase + strip accents + collapse whitespace."""
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", text.upper()).strip()


def model_of(name_clean: str, profile, hint: str = None) -> str | None:
    """Model candidate: alphanumeric, >=2 letters AND >=2 digits, 5-18 chars,
    not a spec token ("256GB", "1080P") — those would merge every 256GB phone
    on the market into one product."""
    def valid(tok):
        if not (5 <= len(tok) <= 18):
            return False
        if len(re.findall(r"[A-Z]", tok)) < 2 or len(re.findall(r"[0-9]", tok)) < 2:
            return False
        if tok in profile.model_stop_tokens:
            return False
        return not any(rx.search(tok) for rx in profile.model_blocklist)

    if hint:
        h = clean(hint)
        # A model NUMBER is one token (WA23C3553GW/AP, XT2601-3, QN65Q7FAAPXPA).
        # A retailer `model` field containing a space is the product NAME
        # ("iPhone 17 Air", "HONOR 400") — measured: 35 of 191 hints, all one chain's
        # phones. Promoting a name to a model identity is wrong twice over: it
        # invents an exact-match key out of marketing text, and it makes the
        # Tier-2 guard ("one side has a model, the other doesn't -> a same-spec
        # variant may exist") fire on a phantom model. The candidate path below
        # can never produce a space, so this only disciplines the hint.
        if " " not in h and valid(h):
            return h
    cands = [t for t in MODEL_TOKEN_RE.findall(name_clean) if valid(t)]
    return max(cands, key=len) if cands else None


def model_stem(model: str | None) -> str | None:
    """Tier 1b stem: strip ONLY the recognized after-slash suffix, then drop
    separators for comparison. NEVER truncate the core alphanumeric."""
    if not model:
        return None
    stem = model.split("/")[0]
    stem = re.sub(r"[^A-Z0-9]", "", stem)
    return stem if len(stem) >= 5 else None


def normalize(raw_title: str, profile, brand_hint: str = None, model_hint: str = None):
    nc = clean(raw_title)
    brand = profile.brand_of(nc, brand_hint)
    attrs = profile.attributes_of(nc)
    model = model_of(nc, profile, model_hint)
    return {
        "name_clean": nc,
        "brand": brand,
        "model": model,
        "stem": model_stem(model),
        "attributes": attrs,
    }
