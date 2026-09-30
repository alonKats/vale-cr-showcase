/* THE GAP DISTRIBUTION, COMPUTED ONCE AT BUILD TIME (design-direction-v6.1 §4).
   ==========================================================================

   `/brechas` is the only page in this product whose subject is the CATALOGUE
   rather than a product, so it is the only one that needs the distribution as an
   object. Everything here is derived from `serverCatalog()` — the same `enrich()`
   the browser runs — so the leaderboard, the category table and every product
   page agree about the same product by construction, not by coincidence.

   FOUR RULES ARE ENCODED HERE RATHER THAN IN THE VIEW, because a view can
   forget them and a data function cannot:

   1. `parejo` NEVER REACHES A LEADERBOARD. A sub-5% spread is a near-tie, not a
      brecha (lib/catalog.ts `GAP_THRESHOLD`), and `solo` has no spread at all.
      The boards read from `brecha` only. The DENOMINATOR, by contrast, is the
      full comparable set — 502, not 383 — because "the median gap among products
      that can be compared" is the honest statistic and dropping the near-ties
      from it would inflate the median by excluding every product that agrees.
   2. NOTHING DISTRIBUTIONAL IS PUBLISHED BELOW 5 OBSERVATIONS (§4.6) — NOT THE
      MEDIAN AND NOT THE MAXIMUM. Same number and same instinct as `FacetBar`'s
      `MIN_RESULTS`: three observations produce an arithmetic result and not a fact
      about a category. §4.6 named only the median, which let `Consolas de
      videojuegos` ship `1 de 60 · mediana — · la más grande: PS5 Digital (7%)` — a
      superlative over ONE observation sitting beside a median the same row had
      just refused to compute. The designer closed the gap in her Tier-2 read: the
      superlative falls under the same floor and the same footnote. The row still
      renders — with dashes — because hiding the category would be the same
      overclaim in the other direction.
   3. THE HOMEPAGE'S RAILS ARE RANKED BY EVIDENCE, NOT BY GAP (v7.2 §6.1).
      `homeRails` is `comparable` descending, floored at
      MIN_COMPARABLE_FOR_RAIL — the same guard as rule 2, one step up, and for
      the same reason: a rail headed `Dónde hay más diferencia` over three
      comparable products is a superlative without a denominator. The floor and
      its argument sit on the constant.
   4. NO CHAIN IS RANKED, AGGREGATED OR SCORED (§4.5). There is deliberately no
      per-retailer structure in this file: a column that scored chains would be
      a different product with its own legal exposure. This page ranks PRODUCTS. */

import { serverCatalog } from './server-catalog';
import type { Enriched } from './types';

/** §4.1 — the distribution's own shoulder. `≥5%` is 383 of 502 (nearly
 *  everything comparable) and separates poorly; `≥20%` cuts to a third, which is
 *  where the number starts carrying information. */
export const STRONG_GAP_PCT = 20;

/** §4.6 — below this a category gets a dash, never a computed median. */
export const MIN_FOR_MEDIAN = 5;

/** v7.2 §6.1 — THE HOMEPAGE RAIL FLOOR, AND IT IS THE SAME GUARD AS
 *  `MIN_FOR_MEDIAN`, ONE STEP UP. It lives here, beside it, for that reason.
 *
 *  A rail's heading claims `Dónde hay más diferencia — <category>`. That claim
 *  needs a denominator: ranking the homepage by median gap promotes
 *  `Congeladores` (22,9% over SIX comparable products) and `Barras de sonido`
 *  (20,5% over FIVE) above `Lavadoras y secadoras` (103), which is the
 *  `Consolas de videojuegos` defect §4.6 already closed once — a superlative
 *  over a sample too small to compute a median from. So the homepage ranks by
 *  `comparable` DESCENDING and refuses to build a rail out of fewer than 20
 *  observations at all.
 *
 *  20 is not a tuned constant: `STRONG_GAP_PCT` is 20 for the same reason on the
 *  other axis — it is where the number starts carrying information. AND THE
 *  FLOOR IS ITSELF A READING: if it ever excludes more than nine of the fourteen
 *  categories, the homepage is telling you the catalogue has thinned, and that
 *  is worth knowing rather than papering over with a shorter page.
 *
 *  NO CRAWLABLE LINK IS LOST TO THIS CUT and that is a constraint, not a
 *  hope: every one of the fourteen categories keeps its link in the photo
 *  `CategoryRail` (demoted, not deleted — §5.2) and in `SiteMapBlock`. This
 *  constant may only ever shorten the PRODUCT-CARD surface. */
export const MIN_COMPARABLE_FOR_RAIL = 20;

/** §6.1 — how many product rails the homepage carries. Fourteen rails put the
 *  page's biggest claim 600px above its weakest evidence (`Aires acondicionados`,
 *  three comparable products) and made the page 8.465px of fourteen identical
 *  507px blocks. */
export const HOME_RAILS = 5;

/** How many rows each leaderboard carries (§4.3). */
export const BOARD_SIZE = 10;

export interface CategoryGap {
  id: string;
  label: string;
  /** the whole category. It rides along so every row can print its OWN
   *  denominator — `88 de 408` — rather than making the reader carry the page's
   *  headline ratio down fourteen rows. The denominator is the difference
   *  between a table of findings and a table of cherries. */
  total: number;
  /** every product in the category sold by 2+ chains — near-ties included */
  comparable: number;
  /** null when `comparable` is below MIN_FOR_MEDIAN. The view renders a dash and
   *  the footnote; it never substitutes a number of its own. */
  medianPct: number | null;
  strong: number;
  /** the widest spread in the category — null if nothing clears the threshold, AND
   *  null below MIN_FOR_MEDIAN for the same reason the median is (§4.6, closed by
   *  The designer Tier-2 §3). A MAXIMUM OVER ONE OBSERVATION IS A WEAKER CLAIM THAN A
   *  MEDIAN OVER THREE, NOT A STRONGER ONE: `Consolas de videojuegos — 1 de 60 —
   *  mediana '—' — la más grande: PlayStation 5 Digital (7%)` published a
   *  superlative on a sample the very same row had just refused to compute a
   *  median from. Withholding one and publishing the other is not a floor. */
  top: Enriched | null;
}

export interface Gaps {
  total: number;
  comparable: number;
  solo: number;
  /** median of `gapPct` over the whole comparable set */
  medianPct: number;
  maxPct: number;
  /** §2.1 — the domain EVERY spread bar in the product is drawn on, `0 → this`.
   *  Equal to `maxPct` by assertion; it is a separate field because its SOURCE is
   *  the artifact, and the difference between "the number we published" and "the
   *  number we recomputed" is the whole point of the check above. */
  axisMaxPct: number;
  /** §2.3 — the six derived bins (bins[0] is the sub-5% near-tie floor). `null`
   *  on an export older than E0; the /brechas strip renders its caption without
   *  the histogram rather than binning in a component. */
  bins: { from: number; to: number | null; count: number }[] | null;
  strong: number;
  byPct: Enriched[];
  byCrc: Enriched[];
  cats: CategoryGap[];
  /** §6.1 — the categories the HOMEPAGE builds a product rail for: `comparable`
   *  descending, floored at MIN_COMPARABLE_FOR_RAIL, top HOME_RAILS. Derived
   *  here rather than in the view for the reason at the top of this file — a
   *  view can forget a floor and a data function cannot. */
  homeRails: CategoryGap[];
  /** any category whose median is withheld, for the footnote */
  sparse: CategoryGap[];
  /** THE ARTIFACT'S export stamp, never the clock (the loop's rule 2) */
  generatedAt: string;
}

/* ==========================================================================
   v7 §2.1 — THE SPREAD BAR'S AXIS, AND THE ONE ASSERTION THAT KEEPS IT HONEST.

   Every spread bar in the product — the verdict plate, the leaderboard row, the
   category table, the /brechas strip — is drawn on the domain `0 → the largest
   gap in the catalogue today`. Not on its own two prices: a bar that fills its
   track because its own prices are its endpoints makes an 8% gap and an 80% gap
   look identical, and §2.5 names it as the single most likely way this ships
   wrong.

   THE VALUE COMES FROM THE ARTIFACT (`meta.gap_distribution`), NOT FROM HERE,
   because the OG share card and any future non-Next consumer need the same axis
   and must not have to re-derive it. But this module already computes `maxPct`
   from the same catalogue with the canonical `enrich()` arithmetic — so the two
   are compared, and a disagreement FAILS THE BUILD rather than rendering a span
   that overflows its own track.

   THE ASSERTION IS THE POINT, NOT THE FALLBACK. `engine/export.py` and
   `lib/catalog.ts` are two implementations of one definition in two languages,
   and featured.py already ships a THIRD `gap_pct` that divides by the dearest
   price instead of the cheapest. Nothing but a machine check keeps them aligned:
   reconcile against the issuing system, not a second derived artifact.
   An export that predates E0 has no field to disagree with and falls back
   silently; one that HAS the field and is wrong stops the build.
   ========================================================================== */
const AXIS_TOLERANCE = 1e-6;

/** Lower median of an even-length sample. One implementation, used for the
 *  headline and for every category row, so the two can never disagree about what
 *  "median" means. */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

let cached: Gaps | null = null;

export function buildGaps(): Gaps {
  if (cached) return cached;

  const { products, cats, meta, byCategory } = serverCatalog();

  const comparable = products.filter((p) => p.band !== 'solo');
  const brecha = products.filter((p) => p.band === 'brecha');

  /* The two orderings, and the ONLY thing that differs between the two boards.
     Both carry both figures on every row (§4.3) — an 80% gap on a ₡155k stove
     and a ₡975.000 gap on an 8K TV are both true and neither is "the biggest",
     so presenting the same facts twice, ordered two ways, is the honest form of
     a ranking whose axis is contested. The tie-breaks are `lib/catalog.ts`'s
     `brecha` / `ahorro` comparators verbatim rather than a second opinion. */
  const byPct = [...brecha]
    .sort((a, b) => b.gapPct - a.gapPct || b.gapCrc - a.gapCrc || b.lo.price_crc - a.lo.price_crc)
    .slice(0, BOARD_SIZE);
  const byCrc = [...brecha]
    .sort((a, b) => b.gapCrc - a.gapCrc || b.gapPct - a.gapPct || b.lo.price_crc - a.lo.price_crc)
    .slice(0, BOARD_SIZE);

  const catRows: CategoryGap[] = cats.map((c) => {
    const inCat = byCategory.get(c.id) ?? [];
    const comp = inCat.filter((p) => p.band !== 'solo');
    /* `byCategory` is already sorted brecha-first then by gap %, so `[0]` is the
       widest spread when the category has one — the same `[0]` the home rail and
       `buildStats()`'s hero use. A second sort here would be a second answer to
       one question. */
    const lead = inCat[0];
    /* ONE GATE, TWO WITHHELD FACTS. Both the median and the superlative hang off
       the same sample-size test, computed once, so a future edit cannot move one
       floor without the other — which is exactly how the two drifted apart the
       first time. The count and the denominator still render: they are facts at
       any sample size, and dropping the row would be the same overclaim inverted. */
    const enough = comp.length >= MIN_FOR_MEDIAN;
    return {
      id: c.id,
      label: c.label,
      total: inCat.length,
      comparable: comp.length,
      medianPct: enough ? median(comp.map((p) => p.gapPct)) : null,
      strong: comp.filter((p) => p.gapPct >= STRONG_GAP_PCT).length,
      top: enough && lead && lead.band === 'brecha' ? lead : null,
    };
  });

  const maxPct = Math.max(...comparable.map((p) => p.gapPct));
  const emitted = meta.gap_distribution;
  if (emitted && Math.abs(emitted.max_gap_pct - maxPct) > AXIS_TOLERANCE) {
    throw new Error(
      `meta.gap_distribution.max_gap_pct (${emitted.max_gap_pct}) disagrees with the `
      + `catalogue (${maxPct}). The spread bar's axis and the products drawn on it are `
      + 'computed from two different definitions of "gap" — fix export.py gap_distribution() '
      + 'to mirror lib/catalog.ts enrich() rather than relaxing this check.',
    );
  }

  cached = {
    total: products.length,
    comparable: comparable.length,
    solo: products.length - comparable.length,
    medianPct: median(comparable.map((p) => p.gapPct)),
    maxPct,
    /* THE AXIS. Falls back to the computed maximum when the export predates E0,
       so an old artifact renders a correct bar rather than no bar. */
    axisMaxPct: emitted?.max_gap_pct ?? maxPct,
    bins: emitted?.bins ?? null,
    strong: comparable.filter((p) => p.gapPct >= STRONG_GAP_PCT).length,
    byPct,
    byCrc,
    cats: catRows,
    /* the tie-break is the label, not the median: two categories with the same
       comparable count is a coin toss, and a coin toss that reorders the
       homepage between builds is worse than an arbitrary but stable order. */
    homeRails: catRows
      .filter((r) => r.comparable >= MIN_COMPARABLE_FOR_RAIL)
      .sort((a, b) => b.comparable - a.comparable || a.label.localeCompare(b.label, 'es'))
      .slice(0, HOME_RAILS),
    sparse: catRows.filter((r) => r.medianPct === null),
    generatedAt: meta.generated_at,
  };
  return cached;
}
