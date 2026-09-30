/* BRAND SURFACES — the head terms the site did not have.

   `Lavadoras Samsung Costa Rica`, `Celulares Xiaomi precios` are commercial-intent
   searches with real volume and, until now, no page on this site. The category
   pages carry `refrigeradoras precios Costa Rica`; the product pages carry a
   model number. Between them sits the term a shopper who has decided on a BRAND
   but not a model actually types, and nothing answered it.

   Measured on the 2026-08-31 catalogue: 57 brand×category pairs clear 15
   products, and together they cover 2.749 of 3.693 products — 74% of the
   catalogue reachable through a page that did not exist.

   ---- EVERY THRESHOLD HERE IS A REFUSAL, NOT A TUNING KNOB ----------------
   A brand page over four products is a thin page, and a few thousand of them is
   how a site teaches Google that its templates are not worth crawling. So the
   floors below decide what gets a URL at all, and they live here — beside each
   other, in the function that builds the list — rather than in the routes, which
   render a list they are handed and decide nothing. That is the same split
   `gaps.server.ts` uses for the home rails, and for the same reason: a view can
   forget a floor and a data function cannot. */

import { brandDisplay } from './display';
import type { Enriched } from './types';
import type { ServerCatalog } from './server-catalog';

/** A brand needs this many products IN A CATEGORY before that pair gets a page.
 *  Below it the page would be a handful of cards under a heading that promises a
 *  selection, which is worse for a reader than the category page they came from. */
export const MIN_PER_PAIR = 15;

/** A brand needs this many products overall before it gets a hub. */
export const MIN_PER_BRAND = 20;

/** Brand slugs are lowercase-ascii and must round-trip: `brandSlug(raw)` is the
 *  URL and the lookup key, so a brand is never resolved by scanning display
 *  strings. Accents are folded because a URL with `%C3%A9` in it is a URL people
 *  cannot type or read aloud. */
export const brandSlug = (raw: string): string =>
  raw
    .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export interface BrandPair {
  /** the category id */
  id: string;
  label: string;
  count: number;
}

export interface Brand {
  /** the RAW brand string as the engine stores it — the join key */
  raw: string;
  slug: string;
  /** `brandDisplay()`, so "SAMSUNG" reads as "Samsung" exactly as it does on a card */
  label: string;
  total: number;
  /** the categories this brand appears in that clear MIN_PER_PAIR, biggest first */
  pairs: BrandPair[];
}

let memo: Brand[] | null = null;

/** Every brand that earns a page, ranked by catalogue size. Memoised per build —
 *  the sitemap, three routes and the category strip all read it. */
export function buildBrands(cat: ServerCatalog): Brand[] {
  if (memo) return memo;

  const byRaw = new Map<string, Enriched[]>();
  for (const p of cat.products) {
    /* NO `Sin marca` PAGE. 260 products carry no brand at all, and grouping them
       under a heading would invent a manufacturer called "Sin marca" and give it
       a URL. They stay reachable through their categories. */
    if (!p.brand) continue;
    const list = byRaw.get(p.brand);
    if (list) list.push(p);
    else byRaw.set(p.brand, [p]);
  }

  const out: Brand[] = [];
  for (const [raw, items] of byRaw) {
    if (items.length < MIN_PER_BRAND) continue;

    const perCat = new Map<string, number>();
    for (const p of items) perCat.set(p.category, (perCat.get(p.category) ?? 0) + 1);

    const pairs: BrandPair[] = [...perCat]
      .filter(([, n]) => n >= MIN_PER_PAIR)
      .map(([id, count]) => ({ id, label: cat.catMap.get(id)?.label ?? id, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));

    /* A brand whose products are spread thin across many categories, clearing the
       floor in none of them, gets no hub either: the hub's whole job is to link
       to its pairs, and a hub with nothing to link to is a dead end with a
       heading. */
    if (!pairs.length) continue;

    out.push({
      raw, slug: brandSlug(raw), label: brandDisplay(raw), total: items.length, pairs,
    });
  }

  memo = out.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es'));
  return memo;
}

/** The products of one brand in one category, in the catalogue's own order —
 *  `byCategory` is already sorted by `serverCatalog()`, so filtering it preserves
 *  that ranking rather than imposing a second one. A brand page and the category
 *  page it sits under therefore agree about which product comes first. */
export const brandCategoryItems = (cat: ServerCatalog, raw: string, categoryId: string): Enriched[] =>
  (cat.byCategory.get(categoryId) ?? []).filter((p) => p.brand === raw);

export const findBrand = (cat: ServerCatalog, slug: string): Brand | undefined =>
  buildBrands(cat).find((b) => b.slug === slug);
