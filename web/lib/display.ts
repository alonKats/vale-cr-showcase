/* Identity is COMPOSED from fields — brand + generated spec + model — and the
   raw `name` string is never rendered. The model number is its own node so it
   can sit on a line that never clamps.

   The spec line is generated from the CategoryProfile's own declarations and
   NOTHING else: `display` gives the template ("{value} GB de RAM") and
   `value_labels` turns matcher-internal enum keys into es-CR ("TOP_LOAD" →
   "Carga superior"). There is no category-specific branch, map or string
   anywhere in this app — adding a category is a data change. */

import type { Branch, Category, CategoryAttribute, NearestBranch, Product } from './types';

const BRAND_FIX: Record<string, string> = {
  'GENERAL ELECTRIC': 'GE', GE: 'GE', LG: 'LG', TCL: 'TCL', HP: 'HP',
  JVC: 'JVC', RCA: 'RCA', TV: 'TV',
};

export const brandDisplay = (b: string | null): string =>
  !b ? 'Sin marca' : (BRAND_FIX[b] ?? b.charAt(0) + b.slice(1).toLowerCase());

/** Spanish decimal comma. 15.6 → "15,6"; 512 → "512". */
const numES = (v: number) => String(v).replace('.', ',');

/** One attribute, rendered. The only place a value becomes words. */
export function attrText(a: CategoryAttribute, raw: string | number): string {
  if (typeof raw === 'number') return a.display.replace('{value}', numES(raw));
  const label = a.value_labels?.[raw] ?? raw;
  return a.display.replace('{value}', label);
}

/** The label alone, for a facet chip. */
export const facetLabel = (a: CategoryAttribute, raw: string): string => {
  if (a.value_labels?.[raw]) return a.value_labels[raw];
  const n = Number(raw);
  return Number.isFinite(n) ? `${numES(n)}${a.unit ? ` ${a.unit}` : ''}` : raw;
};

/** The category profile's OWN naming template — `{brand} {door_config}
 *  {capacity_ft3}` — resolved against this product. It is what the engine says
 *  this product should be called, so it is what the indexable page's title and
 *  <h1> are built from; the app still never renders the raw `name` string and
 *  still writes no name of its own. A placeholder with no value is dropped
 *  rather than left as a hole. */
export function cardTitle(p: Product, cats: Map<string, Category>): string {
  const prof = cats.get(p.category);
  const brand = brandDisplay(p.brand);
  if (!prof?.card_title) return brand;
  const attrs = new Map(prof.attributes.map((a) => [a.key, a]));
  const out = prof.card_title.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (key === 'brand') return brand;
    const a = attrs.get(key);
    const v = p.attributes?.[key];
    if (!a || v === null || v === undefined || v === '') return '';
    return attrText(a, v);
  });
  const composed = out.replace(/\s+/g, ' ').trim();

  /* THE DEGENERATE CASE: the template resolved to nothing but the brand.
     Every placeholder was null, so this product published no spec the profile
     knows how to name it by — and the string that comes back carries no
     information at all. It is not merely terse: EVERY such product in the
     category collapses onto the identical title, so a 24-card grid renders as
     "Samsung / Samsung / Samsung" and a category reads as broken.

     Measured on the 2026-08-06 catalogue: 2.659 of 3.337 products (80%) share a
     card title with at least one sibling, and the worst offenders are exactly
     this shape — 92 laptops titled just "HP", 23 phones just "MOTOROLA".

     The model number is the fix and it is the ONLY honest one available: it is a
     field the engine composed, not the retailer's raw `name` string, which this
     module still never renders. `productName()` in seo.ts already prefers
     brand + model for the <title> tag, so this makes the visible identity agree
     with the indexed one rather than inventing a third convention.

     Deliberately NOT applied when the template resolved to anything real. The
     h1 drops the model on purpose (Detail.tsx, v4.1-FIX N8: `cardT + modelD`
     measured 78px over two lines at 1440 and stranded a bare SKU on line two at
     390), and ProductCard shows `cardT` alone on purpose too. This narrow case
     is the one N8 did not cover, because a heading that says only "Samsung" is
     worse than a heading with a part number in it. */
  if ((!composed || composed === brand) && p.model) return `${brand} ${p.model}`;
  return composed || brand;
}

/** CARD identity: the profile's composed title, plus the model number.
 *
 *  A grid is the one place the title has to be UNIQUE, because it is the only
 *  thing distinguishing two adjacent cards that share a category, a brand and a
 *  near-identical product photo. `cardT` alone is not: measured on the
 *  2026-08-06 catalogue, five different Sony soundbars all resolve to
 *  "Sony 5.1", five Klip Xtreme to "Klip xtreme", four Samsung to
 *  "Samsung 3.1.2" — and 20 of the 35 colliding products in that category carry
 *  a model number that would separate them. A row of four cards reading
 *  "Sony 5.1 / Sony 5.1 / Sony / Sony 2.1" is how this was reported as a broken
 *  page, and it is a fair reading: the page looks like it rendered the same
 *  product four times.
 *
 *  Deliberately NOT used for the <h1>. `Detail.tsx` (v4.1-FIX N8) drops the
 *  model from the heading on measured grounds — `cardT + modelD` ran 78px over
 *  two lines at 1440 and stranded a bare SKU on line two at 390 — and the
 *  detail page prints the model on its own meta line anyway, so there it would
 *  be a duplicate. A card has neither problem: it clamps at two lines, and it
 *  has no other place to say which unit this is.
 *
 *  The `includes` guard is not belt-and-braces: `cardTitle` ALREADY appends the
 *  model in the degenerate bare-brand case, so without it a product with no
 *  specs would read "Samsung DW80CG4021SRAA DW80CG4021SRAA". */
export const cardIdentity = (p: { cardT: string; model: string | null }): string =>
  p.model && !p.cardT.includes(p.model) ? `${p.cardT} ${p.model}` : p.cardT;

/** `limit` bounds the line for a fixed-height row; unbounded for the sheet. */
export function specLine(p: Product, cats: Map<string, Category>, limit = Infinity): string {
  const prof = cats.get(p.category);
  if (!prof) return 'Sin ficha publicada';
  const bits: string[] = [];
  for (const a of prof.attributes) {
    const v = p.attributes?.[a.key];
    if (v === null || v === undefined || v === '') continue;
    bits.push(attrText(a, v));
    if (bits.length === limit) break;
  }
  return bits.length ? bits.join(' · ') : 'Sin ficha publicada';
}

/** Real branch names carry internal inventory codes and asides —
 *  "San José (frente Hotel Talamanca) - PDV 77". The UI shows the place, not
 *  the retailer's stock-keeping. Required, not cosmetic: the raw string
 *  overflows a row at 390. */
export const cleanBranch = (name: string): string =>
  name.replace(/\s*-\s*PDV\s*\d+\s*$/i, '').replace(/\s*\([^)]*\)/g, '').trim();

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The shopper's location is an ASSUMPTION, not a measurement, and the UI
 *  prints it rather than hiding it. Browser geolocation on consent is
 *  spec-v2 §7 and has no design yet — flagged, not improvised. */
export const HOME: [number, number] = [9.9366, -84.0906];
export const LUGAR = 'La Sabana, San José';

/** Costa Rica's IVA, as a constant rather than a literal typed into a route.
 *  It is a statutory rate, not an artifact figure — but /metodologia's honesty
 *  grep ("no two-digit number is typed into that page's JSX") cannot tell the
 *  difference, and the right answer to a grep that cannot tell is to stop typing
 *  the digit rather than to loosen the grep. */
export const IVA_PCT = 13;

/** The nearest branch of a chain, or THE HONEST REASON THERE ISN'T ONE.
 *
 *  Moved here from `Detail.tsx` in v4. It was a component exporting a data helper that
 *  a second component imported, which is a dependency between two views for no reason;
 *  it belongs beside `nearestByRetailer` and `cleanBranch`, which it is built out of.
 *
 *  `missing` is not an error state. Walmart publishes NO branch directory at all
 *  (meta.branch_coverage: 0 branches, with the reason recorded), so the answer is to
 *  say so rather than to hide the row. */
export interface Near {
  line: string | null;
  missing: string | null;
  /** the branch alone, no chain prefix — whether the chain needs naming depends on the
   *  surface, and only the surface knows. In a table whose row heading is already
   *  `Monge`, prefixing it cost 73px of a 136px string to the ellipsis at 390. */
  place: string | null;
}

export function nearText(retailer: string, nearest: Map<string, NearestBranch>): Near {
  const b = nearest.get(retailer);
  if (!b) {
    return { line: null, missing: `${retailer} no publica un directorio de sucursales.`, place: null };
  }
  return { line: `${retailer} ${b.name}`, missing: null, place: b.name };
}

/** Nearest branch per retailer. Walmart publishes no branch directory at all
 *  (meta.json branch_coverage), so this returns nothing for it — an honest
 *  empty state in the UI, never a hole papered over. */
export function nearestByRetailer(branches: Branch[]): Map<string, NearestBranch> {
  const out = new Map<string, NearestBranch>();
  for (const b of branches) {
    if (b.lat == null || b.lng == null) continue;
    const km = haversine(HOME, [b.lat, b.lng]);
    const cur = out.get(b.retailer);
    if (!cur || km < cur.km) {
      out.set(b.retailer, { name: cleanBranch(b.name), km, retailer: b.retailer });
    }
  }
  return out;
}
