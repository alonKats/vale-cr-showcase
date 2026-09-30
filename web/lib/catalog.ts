/* The whole catalogue lives on the client. That is the point: once these four
   files land, filtering, sorting, opening a product and going back have no
   network step and therefore no loading state at all (spec-v2 §8).

   products.json is 72KB gzipped and is fetched in parallel with the worker's
   index.json, so search comes up first and the rows fill in behind it. */

import { brandDisplay, cardTitle, facetLabel, nearestByRetailer, specLine } from './display';
import type {
  Band, Branch, Category, Enriched, FeaturedPolicy, HistoryArtifact, Meta, NearestBranch,
  ProductHistory, Product,
} from './types';

export interface Counts {
  total: number;
  comparable: number;
  gap: number;
  parejo: number;
  solo: number;
  cats: number;
}

export interface Catalog {
  products: Enriched[];
  byId: Map<string, Enriched>;
  cats: Category[];
  catMap: Map<string, Category>;
  nearest: Map<string, NearestBranch>;
  /** the RAW branch records. v4's `BranchPanel` groups them by cantón, which
   *  `nearest` (one branch per chain) cannot do — and the overlay has to be able to
   *  render the same panel as the statically generated page, or the two renderings
   *  of one URL would disagree. */
  branches: Branch[];
  meta: Meta;
  counts: Counts;
  /** ranked by GAP PERCENTAGE, not colones — the app's job is outlier
   *  detection, and a big ₡ delta on an expensive product is a different
   *  claim (design §3.2). */
  gap: Enriched[];
  parejo: Enriched[];
  solo: Enriched[];
  /** the featured slot, exactly as the engine published it (see loadCatalog) */
  featured: Enriched[];
  featuredPolicy: FeaturedPolicy;
  /** price history, product id → retailer → series. 12KB gzipped, so it rides
   *  along with the catalogue rather than becoming a fetch-on-open: the overlay
   *  and the statically rendered page then say the SAME thing about the same
   *  product, which a lazily-loaded history could not guarantee. */
  history: Record<string, ProductHistory>;
  historyWindow: HistoryArtifact['observation_window'] | null;
  /** §2.1 — `0 → this` is the domain every spread bar is drawn on. */
  axisMaxPct: number;
}

/** A gap of 5% or more is the threshold at which crossing town pays. Below it
 *  the chains are charging the same and the app says so instead of inventing a
 *  winner. */
export const GAP_THRESHOLD = 5;

function band(gapPct: number, nChains: number): Band {
  if (nChains < 2) return 'solo';
  return gapPct >= GAP_THRESHOLD ? 'brecha' : 'parejo';
}

/* ==========================================================================
   v7.1 §1.2 — THE AMBER RAMP'S ONLY ENTRY POINT INTO THE DOM.

   Every gap object that takes a ramp step — the browse chip, the leaderboard
   chip, the category table's superlative, the histogram bin — writes these two
   attributes and reads its colour back out of the `[data-gap-band]` table in
   tokens.css. One helper rather than four call sites, for the same reason
   `retailerNames()` exists: a shape change breaks one line instead of four.

   `data-gap-band` IS THE ENGINE'S NUMBER, NOT OURS. It arrives on the product
   record (`gap_band`), binned at export against `meta.gap_distribution.edges`.
   Nothing here recomputes it and nothing in the browser bins a gap — a bin edge
   typed into a component is the `las 8` defect (v6.1 §5.2) wearing a palette.

   `data-gap-pct` IS WHAT MAKES THE RAMP CHECKABLE rather than merely applied.
   measure.mjs assertion 27 reads both, re-bins the percentage against the
   artifact's own edges, and fails if a node's fill is not the band its own
   number falls in — v7.1 §8.3's first assertion, and the one that separates a
   sequential register from four ambers chosen by hand.

   An export older than E0 carries no band. It returns NO ATTRIBUTES, and every
   consumer's CSS falls back to `var(--band-fill, var(--loud))` — the shipped
   single-amber chip. A missing band must degrade to "no ramp"; it must never
   degrade to band 0, which is a claim that the prices are nearly equal.
   ========================================================================== */
export function bandAttrs(p: Enriched): Record<string, string | number> {
  if (p.gap_band === null || p.gap_band === undefined) return {};
  return { 'data-gap-band': p.gap_band, 'data-gap-pct': p.gapPct.toFixed(4) };
}

export function enrich(p: Product, catMap: Map<string, Category>): Enriched {
  const sorted = [...p.offers].sort((a, b) => a.price_crc - b.price_crc);
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];
  const gapCrc = hi.price_crc - lo.price_crc;
  const gapPct = lo.price_crc ? (gapCrc / lo.price_crc) * 100 : 0;
  return {
    ...p,
    brandD: brandDisplay(p.brand),
    spec: specLine(p, catMap, 3),
    specFull: specLine(p, catMap),
    // "Modelo no publicado", not "Sin modelo" (spec §6.1). 568 of 2.170 products
    // publish no model, and this is the string the design names — it WRAPS TO TWO
    // LINES at 390, and that wrap is the worst real case that sized
    // --row-h-sm: 120px. Shortening it to fit would have quietly removed the
    // thing the token was measured against, and the v3 row spec is explicit that
    // the model number is never clamped at any breakpoint.
    modelD: p.model ?? 'Modelo no publicado',
    hasModel: Boolean(p.model),
    cardT: cardTitle(p, catMap),
    catLabel: catMap.get(p.category)?.label ?? p.category,
    sorted,
    lo,
    hi,
    gapCrc,
    gapPct,
    nChains: sorted.length,
    band: band(gapPct, sorted.length),
  };
}

const j = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url, { cache: 'force-cache' });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return (await r.json()) as T;
};

let pending: Promise<Catalog> | null = null;

export function loadCatalog(): Promise<Catalog> {
  pending ??= (async () => {
    const [products, cats, branches, meta, history] = await Promise.all([
      j<Product[]>('/data/products.json'),
      j<Category[]>('/data/categories.json'),
      j<Branch[]>('/data/branches.json'),
      j<Meta>('/data/meta.json'),
      // the engine added this artifact mid-build; an older export will not have
      // it, and the history block already renders an honest absence
      j<HistoryArtifact>('/data/history.json').catch(() => null),
    ]);

    const catMap = new Map(cats.map((c) => [c.id, c]));
    const enriched = products.map((p) => enrich(p, catMap));

    const gap = enriched.filter((p) => p.band === 'brecha').sort((a, b) => b.gapPct - a.gapPct);
    const parejo = enriched
      .filter((p) => p.band === 'parejo')
      .sort((a, b) => b.lo.price_crc - a.lo.price_crc);
    const solo = enriched
      .filter((p) => p.band === 'solo')
      .sort((a, b) => b.lo.price_crc - a.lo.price_crc);

    const byId = new Map(enriched.map((p) => [p.id, p]));

    return {
      products: enriched,
      byId,
      cats,
      catMap,
      nearest: nearestByRetailer(branches),
      branches,
      meta,
      counts: {
        total: enriched.length,
        comparable: gap.length + parejo.length,
        gap: gap.length,
        parejo: parejo.length,
        solo: solo.length,
        cats: cats.length,
      },
      gap,
      parejo,
      solo,
      // NOT recomputed here. The engine re-fetches every featured candidate's
      // live price at export time and drops any whose verdict flips or whose
      // gap collapses — 3 of 10 were dropped on this run, and computing "top
      // gap" in the app would put all three back under a 44px headline naming
      // the wrong store. meta.featured is the contract: render it, in order.
      featured: meta.featured
        .map((f) => byId.get(f.id))
        .filter((p): p is Enriched => Boolean(p)),
      featuredPolicy: meta.featured_policy,
      history: history?.products ?? {},
      historyWindow: history?.observation_window ?? null,
      /* §2.1 — the spread bar's catalogue-wide axis, for the CLIENT frame. The
         build-time path (lib/gaps.server.ts) additionally ASSERTS this against a
         recomputed maximum and fails the build on a disagreement; that assertion
         cannot run here, so the fallback recomputes rather than guessing. Both
         paths read one field and one definition, so the overlay and the static
         page cannot draw the same product on two different axes. */
      axisMaxPct: meta.gap_distribution?.max_gap_pct
        ?? Math.max(...enriched.filter((p) => p.band !== 'solo').map((p) => p.gapPct)),
    };
  })();
  return pending;
}

/* ---------- similar products (T4's promoted primary region) ----------

   ONE implementation, called by the statically generated product page AND by the
   in-app overlay, so the two renderings of the same URL rank identically. A second
   ranking in the client would be a second answer at the same address.

   The ranking the spec asks for: same category, SAME BRAND FIRST, then same
   category any brand, ordered by price proximity. Brand is the primary key because
   "the next Samsung fridge up" is the comparison a shopper is actually making;
   price proximity is the tie-break because it is the only other axis our artifact
   can rank on honestly. There is no popularity signal — we cannot measure it — and
   inventing one is how a home page starts recommending the wrong store. */
export function similarTo(p: Enriched, pool: Enriched[], limit = 4): Enriched[] {
  const price = p.lo.price_crc;
  return pool
    .filter((x) => x.id !== p.id && x.category === p.category)
    .map((x) => ({
      x,
      // same brand sorts ahead of every different-brand candidate, whatever the
      // price distance — hence the offset rather than a weighted sum, which would
      // let a huge price gap outrank the brand match.
      rank: (x.brandD === p.brandD ? 0 : Number.MAX_SAFE_INTEGER / 4)
        + Math.abs(x.lo.price_crc - price),
    }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((r) => r.x);
}

/* ---------- filtering + sorting, all client-side, all synchronous ---------- */

export type StateFilter = 'brecha' | 'comparable' | 'todos';
/* v4 §T2 `sort`: price ↑, price ↓, brecha %, nombre. zap's dropdown also offers
   popularity, rating and review count — WE CANNOT MEASURE ANY OF THE THREE, and a
   sort control whose option does nothing is worse than a missing option. `ahorro`
   (gap in colones) survives from v3 because the engine ranks on it and open decision
   #2 in PLAN-forward.md has not been answered; `nombre` is new and is the only
   option here that is not a claim about the data. */
export type Sort = 'brecha' | 'ahorro' | 'precio-asc' | 'precio-desc' | 'nombre';

export interface Facets {
  /** attribute key → the set of selected values (enum) or displayed buckets */
  [key: string]: string[];
}

export interface Query {
  state: StateFilter;
  category: string | null;
  facets: Facets;
  sort: Sort;
  /** ids from the worker, in relevance order; null when nothing is typed */
  ids: string[] | null;
}

export const EMPTY_QUERY: Query = {
  /* v4: THE DEFAULT IS `todos`, not `comparable`.
     v3 defaulted to `comparable` so the amber keyline stayed scarce and meaningful.
     That reasoning was sound while the single-offer product was a DEGRADED STATE —
     but v4 gives it its own template (T4, 1.913 of 2.170 products), so defaulting to
     `comparable` would hide 88.2% of the catalogue behind a filter the user never
     set. The scarcity is now STATED by the TrustBand ("257 de 2.170 productos se
     venden en más de una cadena") instead of being hidden by a default and
     discovered later. */
  state: 'todos',
  category: null,
  facets: {},
  /* ---- `precio-asc`, NOT `brecha` ---------------------
     The default sort was the SIZE OF THE GAP, which put the most dispersed
     products first and quietly made the whole catalogue an argument about
     dispersion. The owner: "people don't buy stuff because there is a big difference.
     They just want to know where is the cheapest."

     A default is not a neutral choice — it is the answer given to every visitor
     who never opens the control, which on a listing page is nearly all of them.
     `brecha` answered a question about the market; `precio-asc` answers the
     question the shopper actually arrived with. See
     DECISION-cheapest-not-difference-2026-08-26.md. */
  sort: 'precio-asc',
  ids: null,
};

export const attrText = (p: Enriched, key: string): string | null => {
  const v = p.attributes?.[key];
  return v === null || v === undefined || v === '' ? null : String(v);
};

export function applyQuery(cat: Catalog, q: Query): Enriched[] {
  let pool: Enriched[];

  if (q.ids) {
    // relevance order from the worker, resolved against the full records
    pool = q.ids.map((id) => cat.byId.get(id)).filter((p): p is Enriched => Boolean(p));
  } else {
    pool = cat.products;
  }

  if (q.state === 'brecha') pool = pool.filter((p) => p.band === 'brecha');
  else if (q.state === 'comparable') pool = pool.filter((p) => p.band !== 'solo');

  if (q.category) pool = pool.filter((p) => p.category === q.category);

  for (const [key, values] of Object.entries(q.facets)) {
    if (!values.length) continue;
    pool = pool.filter((p) => {
      const v = attrText(p, key);
      return v !== null && values.includes(v);
    });
  }

  // A typed query is already in relevance order; re-sorting it would throw away
  // the only ranking the user asked for.
  if (q.ids) return pool;

  return [...pool].sort(SORTERS[q.sort]);
}

/** THE COMPARATORS, HOISTED OUT OF `applyQuery` so the category page's refine
 *  island sorts by the identical rule rather than by a second opinion about the
 *  same words. Two implementations of "precio-asc" is how a listing and its
 *  filtered view quietly disagree about what "cheapest first" means. */
export const SORTERS: Record<Sort, (a: Enriched, b: Enriched) => number> = {
  /* THE THIRD TERM IS NOT DEFENSIVE, IT DECIDES MOST OF THE PAGE.
   *
   * `gapPct` and `gapCrc` are both 0 for every single-offer product — and
   * single-offer is ~88% of the catalogue. On /categoria/cocinas that is ~40
   * products sorting by a real comparison followed by ~368 that all tie, fall
   * through to array order, and land in whatever sequence the export happened
   * to emit. Pages 2 through 17 of all 14 categories were therefore in an
   * order nobody chose — the same failure as an arbitrary sort option,
   * arrived at by omission rather than by decision.
   *
   * `price DESC` is not invented for this. It is the rule `stats.server.ts`
   * already applies when picking a category's hero: the highest-gap
   * comparable product, or the DEAREST single-offer one when the category has
   * no comparable. Reusing it means the tail of a category page and the rail
   * that points at it order by the same stated rule. */
  brecha: (a, b) =>
    b.gapPct - a.gapPct || b.gapCrc - a.gapCrc || b.lo.price_crc - a.lo.price_crc,
  ahorro: (a, b) =>
    b.gapCrc - a.gapCrc || b.gapPct - a.gapPct || b.lo.price_crc - a.lo.price_crc,
  'precio-asc': (a, b) => a.lo.price_crc - b.lo.price_crc,
  'precio-desc': (a, b) => b.lo.price_crc - a.lo.price_crc,
  // `es` collation, so "Ámbar" sorts with A and not after Z
  nombre: (a, b) => a.cardT.localeCompare(b.cardT, 'es'),
};



/** Facet declarations come from categories.json — the UI never names an
 *  attribute and never writes a value label. Both come off the profile. */
export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface FacetGroup {
  key: string;
  label: string;
  options: FacetOption[];
}

export function buildFacets(cat: Catalog, categoryId: string, pool: Enriched[]): FacetGroup[] {
  const profile = cat.catMap.get(categoryId);
  if (!profile) return [];
  const scoped = pool.filter((p) => p.category === categoryId);

  return profile.attributes
    .map((a) => {
      const counts = new Map<string, number>();
      for (const p of scoped) {
        const v = attrText(p, a.key);
        if (v === null) continue;
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      const numeric = a.facet === 'range';
      const options = [...counts.entries()]
        .sort((x, y) => (numeric ? Number(x[0]) - Number(y[0]) : y[1] - x[1]))
        .map(([value, count]) => ({ value, count, label: facetLabel(a, value) }));
      return { key: a.key, label: a.label, options: options.slice(0, 14) };
    })
    .filter((g) => g.options.length > 1);
}

/* ---- PREDICATES THE CATEGORY REFINE ISLAND SHARES WITH THIS FILE -----------
   Exported rather than reimplemented in the island for the same reason SORTERS
   is: a retailer test written twice diverges the first time somebody handles a
   casing or a whitespace edge in one of them. */

/** Every chain that publishes this product, from the offers themselves. NOT an
 *  attribute — `attrText()` cannot reach it, which is why facets alone could
 *  never have filtered by store. */
export const retailersOf = (p: Enriched): string[] => p.sorted.map((o) => o.retailer);

/** Matches on the CHEAPEST offer, which is the price the card shows and
 *  therefore the only price a shopper is filtering against. Bounds are
 *  inclusive; a null bound is "no bound", never 0. */
export const inPriceRange = (p: Enriched, min: number | null, max: number | null): boolean =>
  (min === null || p.lo.price_crc >= min) && (max === null || p.lo.price_crc <= max);

/** In stock ANYWHERE. A product whose cheapest chain is out of stock but whose
 *  second is not is still buyable today, and hiding it would be a wrong answer
 *  to "solo disponibles". */
export const anyInStock = (p: Enriched): boolean => p.sorted.some((o) => o.in_stock);
