import { canMultiply } from './blend';
import { freshnessCopy } from './freshness';
import { diaLargo } from './format';
import { serverCatalog } from './server-catalog';
import { retailerNames } from './types';

/* Read at build time, not at runtime. The trust band, the category chips, the
   freshness stamps and the footer are therefore REAL in the first paint, with
   zero JavaScript — which is what makes the cold load a skeleton over a
   finished frame instead of a white page (design §4.3).

   Bands are NOT recomputed here any more: `serverCatalog()` runs the same
   `enrich()` the browser runs, so the trust band's numbers and the list's
   numbers come from one implementation. */

/** THE RAIL'S PHOTOGRAPH, DERIVED — never curated (v4.1 §2.1).
 *
 *  v4 replaced v3's per-category photo plate with a `Mark` glyph, and the reasoning
 *  was sound: a curated per-category asset has no owner, so it rots. THE PREMISE NO
 *  LONGER HOLDS. Image coverage is 2.170/2.170, and every category has hundreds of
 *  real product photographs already sitting in public/img/ at three widths. So the
 *  rail's picture is composed from the artifact exactly like every number on the
 *  page: it is THE HIGHEST-GAP COMPARABLE PRODUCT IN THE CATEGORY — the same product
 *  the first card of that category's rail shows.
 *
 *  That makes the image EARNED rather than decorative: it is the artifact's own
 *  answer for that category. It is deterministic, it regenerates with every export,
 *  and no human is in the loop. If a category has no comparable product it falls back
 *  to the highest-priced single-offer one; if a product has no photo at all, `Thumb`
 *  renders the designed brand-initial tile and `Mark` survives as the final
 *  typographic fallback. Nothing here is ever a hole. */
export interface CatRef {
  id: string;
  label: string;
  count: number;
  /** the derived hero: src + srcset + alt + the multiply verdict, or null if the
   *  category has no product with a photograph. `blend` is precomputed here rather
   *  than in the rail because lib/blend.ts carries the reason: 102 of the 2.108
   *  distinct photos ship on a saturated or black studio card, and multiplying one
   *  onto the plate produces a mud rectangle — and "the first product with a photo"
   *  for the category rail HAS ALREADY PICKED THREE OF THEM ONCE. */
  pic: { src: string; srcset: string; alt: string; blend: boolean } | null;
}

export interface BuildStats {
  total: number;
  comparable: number;
  gap: number;
  parejo: number;
  solo: number;
  cats: CatRef[];
  retailers: string[];
  /** freshness is a DISTRIBUTION, never one timestamp — see lib/freshness.ts */
  freshShort: string;
  freshHeadN: string;
  freshHeadT: string;
  freshLong: string;
  freshBasis: string;
  /** the raw distribution, for the TrustBand's proportional bars. The BARS are
   *  gated against THESE NUMBERS (data-pct, §2.4) rather than against a second
   *  rendering — a bar drawn correctly from the wrong number is still a false claim,
   *  and two derived artifacts agreeing proves nothing. */
  freshDist: { offers: number; over24: number; over48: number } | null;
  exportedDay: string;
  generatedAt: string;
  fx: string;
  /** the engine re-reads every featured candidate's live price at export time
   *  and drops the ones that moved — a fact worth stating, not hiding */
  featuredChecked: number;
  featuredDropped: number;
  /** DISTINCT DAYS of readings in the artifact, across all chains — never the
   *  observation count (lib/history.ts: two chains read on the same day are ONE
   *  day). /metodologia's claims table publishes it beside MIN_CURVE_DAYS so the
   *  row reads "3 días — todavía no se publica" rather than a dash. A methodology
   *  page that lists a capability it is not yet exercising, and says so, is worth
   *  more than one that lists only what it can do today. */
  historyDays: number;
}

let cached: BuildStats | null = null;

export function buildStats(): BuildStats {
  if (cached) return cached;

  const { products, cats, meta, byCategory } = serverCatalog();
  const fresh = freshnessCopy(meta);

  const gap = products.filter((p) => p.band === 'brecha').length;
  const parejo = products.filter((p) => p.band === 'parejo').length;
  const solo = products.filter((p) => p.band === 'solo').length;

  cached = {
    total: products.length,
    comparable: gap + parejo,
    gap,
    parejo,
    solo,
    cats: cats.map((c) => {
      /* `byCategory` is ALREADY sorted brecha-first, then by gap %, then by price —
         the same ranking serverCatalog() gives the category pages and Featured gives
         the home rails. So `[0]` IS "the highest-gap comparable product, or the
         dearest single-offer one if the category has no comparable" without a second
         sort here. A second sort would be a second answer to one question. */
      const hero = byCategory.get(c.id)?.[0] ?? null;
      return {
        id: c.id,
        label: c.label,
        // composed from meta.category_counts, never typed. Still rendered twice (the
        // sitemap block and T2's ResultCount) — it just stops competing with the
        // label in the wayfinding layer (§2.2).
        count: meta.category_counts[c.id] ?? 0,
        pic: hero?.image
          ? {
            src: hero.image,
            srcset: (hero.image_srcset ?? []).map((s) => `${s.src} ${s.w}w`).join(', '),
            alt: `${hero.brandD} ${hero.modelD}`,
            blend: canMultiply(hero.image),
          }
          : null,
      };
    }),
    // BuildStats.retailers is string[] and every consumer joins it into a
    // sentence, so the names are flattened HERE, once, at the boundary.
    retailers: retailerNames(meta.retailers),
    freshShort: fresh.short,
    freshHeadN: fresh.headN,
    freshHeadT: fresh.headT,
    freshLong: fresh.long,
    freshBasis: fresh.basis,
    freshDist: meta.price_freshness
      ? {
        offers: meta.price_freshness.offers,
        over24: meta.price_freshness.over_24h,
        over48: meta.price_freshness.over_48h,
      }
      : null,
    exportedDay: diaLargo(meta.generated_at),
    generatedAt: meta.generated_at,
    featuredChecked: meta.featured_policy?.candidates_considered ?? 0,
    featuredDropped: meta.featured_policy?.dropped_count ?? 0,
    historyDays: meta.price_history?.observation_window?.distinct_days ?? 0,
    // NBSP-glued separator: same footer grid, same reason as freshness.long
    fx: `₡${meta.fx_rate_crc_usd.toFixed(2).replace('.', ',')} / US$1 · BCCR, ${diaLargo(
      `${meta.fx_rate_date}T12:00:00Z`,
    )}`,
  };
  return cached;
}
