"""SQLite schema. Postgres-compatible types."""
import os
import sqlite3
from pathlib import Path

# One writer at a time. A scheduled collector run and an interactive measurement
# run are two producers over one file, and SQLite answers that with
# `database is locked` after the second one has already done its fetching.
# `CRPC_DB` lets a measurement run take its own file so the two never queue
# behind each other; the fetch cache is still shared, so the second run costs
# no extra requests to any retailer.
DB_PATH = Path(os.environ.get("CRPC_DB") or (Path(__file__).parent / "data.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS retailer (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, parent_company TEXT,
  base_url TEXT, extractor_rung INTEGER);
CREATE TABLE IF NOT EXISTS product (
  id INTEGER PRIMARY KEY, brand TEXT, model_number TEXT,
  normalized_name TEXT, category TEXT, specs_json TEXT);
CREATE TABLE IF NOT EXISTS offer (
  id INTEGER PRIMARY KEY, retailer_id INTEGER NOT NULL REFERENCES retailer(id),
  product_id INTEGER REFERENCES product(id),          -- NULLABLE: offers land unmatched
  raw_title TEXT, raw_model TEXT, ean TEXT, url TEXT UNIQUE,
  cash_price_crc REAL, list_price_crc REAL, in_stock INTEGER,
  credit_json TEXT, content_hash TEXT, scraped_at TEXT,
  sku TEXT, category TEXT);
CREATE TABLE IF NOT EXISTS price_point (                -- append-only, never UPDATE
  offer_id INTEGER REFERENCES offer(id),
  cash_price_crc REAL, observed_at TEXT);
CREATE TABLE IF NOT EXISTS match_decision (             -- audit trail: WHY each match
  offer_id INTEGER REFERENCES offer(id),
  product_id INTEGER REFERENCES product(id),
  method TEXT, score REAL, decided_by TEXT, decided_at TEXT);
"""

# parent_company is load-bearing, not metadata: two brands of one group are not
# competitors, and a comparison that treats them as such sells one retailer's
# price discrimination as a shopping choice. Every retailer here must belong to
# a DIFFERENT group; run.py asserts it before publishing.
#
# (id, name, parent_company, base_url, extractor_rung). The base_url is also
# the offer-URL allowlist the artifact contract enforces (export.py).
RETAILERS = [
    (1, "Tienda Norte", "Grupo Norte (ejemplo)", "https://norte.example", 2),
    (2, "Tienda Sur", "Comercial Sur (ejemplo)", "https://sur.example", 2),
]


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    con.executemany(
        "INSERT OR IGNORE INTO retailer(id,name,parent_company,base_url,extractor_rung) VALUES (?,?,?,?,?)",
        RETAILERS)
    con.commit()
    return con
