/* The artifact contract (spec-v2 §4.4). The engine owns web/public/data/;
   the app reads it and never writes it. Every nullable field here is nullable
   in the artifact too — missing data is null, never fabricated or defaulted. */

export interface Credit {
  monthly_crc: number;
  months: number;
  total_crc: number;
  type: string;
}

export interface Offer {
  retailer: string;
  price_crc: number;
  list_price_crc: number | null;
  in_stock: boolean;
  url: string;
  credit: Credit | null;
  scraped_at: string;
  /* Colour-variant collapse: where a retailer lists one SKU per colour, the
     engine folds them into a single offer. `price_crc` is then the CHEAPEST
     variant, and if `variant_price_max_crc` is higher the UI has to say "desde"
     rather than present one figure as if it were the only one. */
  variant_count: number;
  variant_price_max_crc: number | null;
}

export interface ReviewCR {
  average: number;
  count: number;
  source: string;
  distribution: Record<string, number> | null;
}

/** A US review record is NEVER this SKU. `us_title` names the product that was
 *  actually rated and `match_basis` says how it was reached — both are required
 *  by the artifact and both are rendered. */
export interface ReviewUS {
  average: number;
  count: number;
  source: string;
  distribution: Record<string, number> | null;
  us_title: string;
  match_basis: string;
}

export interface USReference {
  price_usd_min: number;
  price_usd_max: number;
  rating: number | null;
  review_count: number | null;
  source: string;
  url: string;
  candidate_count: number;
  match_basis: string;
}

/* ==========================================================================
   PRICE HISTORY — `public/data/history.json`, shipped by the engine 2026-08-03.

   A SEPARATE artifact rather than a field on Product, which is the right call:
   943 products × 6 retailers × 180 days inline in products.json would break the
   71KB-gzipped budget the whole client-side-catalogue architecture rests on.
   As a standalone file it is 12KB gzipped and is fetched alongside the rest.

   The observation window today is THREE distinct days and most products carry
   ONE. Everything the UI says about it is gated on `days`, never on
   `observations` — see components/PriceHistory.tsx. Counting observations
   instead is exactly how a two-point line gets drawn and called a trend.
   ========================================================================== */

/** One retailer's series. `points` are `[day, price_crc]` tuples — the tuple
 *  form is why the whole artifact is 12KB gzipped instead of 40KB.
 *  `observations` is how many times the price was READ; `days` is how many
 *  distinct calendar days those reads span. They are very different numbers
 *  (8 observations across 1 day is common) and only `days` may drive wording. */
export interface RetailerSeries {
  points: [string, number][];
  observations: number;
  days: number;
}

/** retailer → series, for one product */
export type ProductHistory = Record<string, RetailerSeries>;

export interface HistoryArtifact {
  generated_at: string;
  observation_window: { first_day: string; last_day: string; distinct_days: number };
  products_with_history: number;
  basis: string;
  products: Record<string, ProductHistory>;
}

export interface Product {
  id: string;
  /** v7.1 §9-1 — the gap's band index 0–4 against `meta.gap_distribution.edges`,
   *  emitted per product so NO SURFACE EVER BINS IN THE BROWSER. Band 0 is the
   *  sub-5% near-tie and takes no amber at any scale; 1–4 are the ramp's steps.
   *  `null` on a single-offer product: no second price means no gap, which is not
   *  the same thing as band 0. Optional — an export older than E0 has no bands,
   *  and the one consumer must treat that as "no ramp", never as band 0. */
  gap_band?: number | null;
  category: string;
  brand: string | null;
  model: string | null;
  name: string;
  image: string | null;
  image_srcset: { w: number; src: string }[] | null;
  attributes: Record<string, string | number | null>;
  offers: Offer[];
  retailer_count: number;
  reviews: { cr: ReviewCR | null; us: ReviewUS | null };
  us_reference: USReference | null;
  markup_pct: number | null;
  markup_basis: string;
  scraped_at: string;
}

export interface CategoryAttribute {
  key: string;
  label: string;
  unit: string | null;
  facet: 'enum' | 'range';
  /** How this attribute reads in a sentence — "{value} GB de RAM". Closed enums
   *  ship as matcher-internal keys, so `value_labels` is what turns TOP_LOAD
   *  into "Carga superior". The app composes from these two and nothing else:
   *  there is no category-specific code anywhere in the UI. */
  display: string;
  values: string[] | null;
  value_labels: Record<string, string> | null;
  collapsible: boolean;
}

export interface Category {
  id: string;
  label: string;
  attributes: CategoryAttribute[];
  card_title: string;
  match_keys: string[];
  retailers: string[];
}

export interface Branch {
  retailer: string;
  name: string;
  canton: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

/* The featured slot is the engine's call, not the app's. Every candidate is
   re-fetched live at export time and dropped if its verdict flips or its gap
   collapses — the drop rate on this run was 30%. Recomputing "top gap" in the
   app would put all three dropped products back on the home page under a 44px
   headline recommending the WRONG store. So: render this array, in this order. */
export interface FeaturedRef {
  id: string;
  category: string;
  cheapest_retailer: string;
  price_crc: number;
  dearest_retailer: string;
  price_max_crc: number;
  gap_crc: number;
  /** the engine's gap as a share of the DEARER price — a different metric from
   *  the app's "how much more one chain charges", so it is not rendered as a % */
  gap_pct: number;
  verified_at: string;
}

export interface FeaturedPolicy {
  candidates_considered: number;
  slots: number;
  min_gap_pct: number;
  min_gap_crc: number;
  reverify_window_s: number;
  products_with_price_change: number;
  dropped_count: number;
  drop_rate_pct: number;
  drop_reasons: string[];
  note: string;
}

/** The freshness DISTRIBUTION, not a single timestamp. `generated_at` is when
 *  the export ran; saying "verificados hoy, 5:01 p. m." off it claims a
 *  freshness that 121 of 791 offers do not have. Every freshness sentence in
 *  the app composes from this object — see lib/freshness.ts. Optional because
 *  the engine owns the artifact and an older export may not carry it; the
 *  helper degrades to a claim it can prove. */
export interface PriceFreshness {
  offers: number;
  newest_age_h: number;
  median_age_h: number;
  oldest_age_h: number;
  over_24h: number;
  over_48h: number;
  basis: string;
}

/** `meta.retailers` is an OBJECT per chain, not a name. It was `string[]` until
 *  2026-08-04, and the engine had already changed shape — so every `.join()` on
 *  it printed "[object Object]" into the hero copy, the trust band and the
 *  `<meta name="description">` of 8,701 built pages. `tsc` stayed green the
 *  whole time, because the artifact is cast to this interface at the boundary:
 *  a type that disagrees with the JSON is not a check, it is a false negative.
 *  Read names through `retailerNames()` — never `.join()` this array. */
export interface RetailerRef {
  name: string;
  parent_company: string;
  products: number;
}

/** The only sanctioned way to get chain names out of `meta.retailers`. Exists so
 *  that a shape change in the artifact breaks ONE line instead of six, and so
 *  that `.join()` on the raw array — which TypeScript will never flag, because
 *  `.join()` is legal on every array — has no reason to be written again. */
export const retailerNames = (retailers: RetailerRef[]): string[] =>
  retailers.map((r) => r.name);

export interface Meta {
  fx_rate_crc_usd: number;
  fx_rate_date: string;
  fx_source: string;
  generated_at: string;
  retailers: RetailerRef[];
  product_count: number;
  category_counts: Record<string, number>;
  featured: FeaturedRef[];
  featured_policy: FeaturedPolicy;
  price_freshness?: PriceFreshness;
  featured_dropped: { id: string; reason: string; gap_before_crc: number; gap_after_crc: number }[];
  branch_coverage: Record<string, { branches: number; note?: string }>;
  artifact_gzip_bytes: Record<string, number>;
  /** the observation window behind the price curve. DISTINCT DAYS, never the
   *  observation count — two chains read on the same day are ONE day of history
   *  (lib/history.ts). /metodologia publishes it against MIN_CURVE_DAYS. */
  price_history?: {
    observation_window?: { first_day: string; last_day: string; distinct_days: number };
  };
  /** v7 E0 (§2.1) — the spread bar's axis domain and the /brechas distribution,
   *  derived at export by `engine/export.py gap_distribution()` with `enrich()`'s
   *  arithmetic. OPTIONAL because an export older than 2026-08-11 does not carry
   *  it, and the one consumer (`lib/gaps.server.ts`) falls back to computing it —
   *  a missing field must never be a build failure, but a field that DISAGREES
   *  with the catalogue must be, and that is asserted there. */
  gap_distribution?: {
    comparable: number;
    max_gap_pct: number;
    median_gap_pct: number;
    /** `[0, 5, 10, 20, 50]` — FIVE bins (v7.1 §0.1). They ship as data because the
     *  edges ARE the amber ramp's bands, and a bin edge typed into a component is
     *  the `las 8` defect. Nothing in the app may declare its own. */
    edges: number[];
    bins: { from: number; to: number | null; count: number }[];
    basis: string;
  };
}

/** Three states, one geometry (design §3.3). `solo` = one chain, nothing to
 *  compare against. `parejo` = the chains charge the same and the only real
 *  question left is which branch is closer. `brecha` = a gap worth crossing
 *  town for. */
export type Band = 'brecha' | 'parejo' | 'solo';

export interface Enriched extends Product {
  brandD: string;
  /** the compact three-bit line a fixed-height row can hold */
  spec: string;
  /** every declared attribute, for the sheet and the comparison */
  specFull: string;
  modelD: string;
  hasModel: boolean;
  /** the CategoryProfile's own `card_title` template, resolved — the product's
   *  name as the engine declares it, used by the indexable page's title/h1 */
  cardT: string;
  catLabel: string;
  sorted: Offer[];
  lo: Offer;
  hi: Offer;
  gapCrc: number;
  gapPct: number;
  nChains: number;
  band: Band;
}

/** The search payload — thin by design so the worker's fetch is small. */
export interface IndexItem {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string;
  price_min: number;
  price_max: number;
  retailer_count: number;
  image: string | null;
}

export interface NearestBranch {
  name: string;
  km: number;
  retailer: string;
}
