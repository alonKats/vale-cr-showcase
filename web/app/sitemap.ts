/* Generated from the real product list — 4.346 products, 14 category pages, 174 category
   PAGINATION pages and the two app routes.

   `lastModified` IS THE DAY THE PAGE LAST CHANGED IN SUBSTANCE, which for this site
   means the day a chain moved the price. v1–v5 used `scraped_at` and said in this
   very comment that doing so avoided "the same class of false freshness claim the top
   bar used to make". It did not: the collector reads every product every day, so
   `scraped_at` is the run stamp wearing a per-product costume. Measured against the
   published sitemap on 2026-08-09 — 4.543 URLs, ONE distinct lastmod. See
   `lib/history.ts: lastPriceChange` for why that is worse than omitting the field.

   v4 ADDS THE PAGINATION PAGES, and it has to. T2 paginates at 24, so a category's
   products are now spread over up to 22 crawlable pages; a sitemap that lists only
   `/categoria/refrigeradoras` while 12 of its 13 pages exist would leave those pages
   discoverable only by following the pager. They are real, indexable, self-canonical
   URLs and they belong here. Page 1 has no `/1` twin — that address does not exist.

   Next's MetadataRoute.Sitemap writes /sitemap.xml at build. No dependency, no
   generator script. */

import type { MetadataRoute } from 'next';

import { buildBrands } from '@/lib/brands.server';
import { categoryPagePath, pageCount } from '@/components/CategoryScreen';
import { PAGE_SIZE } from '@/components/Pagination';
import { historyState, lastPriceChange, parseDay } from '@/lib/history';
import { brandCategoryPath, brandPath, categoryPath, productPath, SITE_URL } from '@/lib/seo';
import { serverCatalog } from '@/lib/server-catalog';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const cat = serverCatalog();
  const exported = new Date(cat.meta.generated_at);

  /* WHEN THIS PRODUCT PAGE LAST CHANGED IN SUBSTANCE.
     v6 — the header above has claimed since v1 that `lastModified` is "each
     product's own scraped_at, not the build time", and that it avoids "the same
     class of false freshness claim the top bar used to make". The claim was
     wrong, and the fix it describes never worked: `scraped_at` IS a build-time
     constant in disguise, because the collector reads every product every day and
     stamps them all with that run. Measured 2026-08-09 against the published
     sitemap: 4.543 URLs, ONE distinct lastmod value. The comment was right about
     the principle and wrong about the field.

     Order of preference, most to least specific:
       1. the last day a chain actually moved the price  (the real answer)
       2. the first day we ever observed the product     (published, never moved)
       3. the export stamp                               (no history at all)
     Falling back to the FIRST observed day rather than today is the whole point:
     a page nobody's price moved on has not changed, and saying so is what makes
     the days on which it does move worth acting on. */
  const changedAt = (id: string): Date => {
    const h = cat.history[id];
    const moved = lastPriceChange(h);
    if (moved) return parseDay(moved);
    const first = historyState(h).sortedDays[0];
    return first ? parseDay(first) : exported;
  };

  /* A LISTING PAGE IS AS FRESH AS THE NEWEST THING ON IT — and only the things
     actually on it. `byCategory` is sorted by server-catalog with the same
     comparator CategoryScreen paginates, so slicing by PAGE_SIZE here reproduces
     exactly the products page N renders. Dating page 7 of microondas from the
     whole category would claim it changed because a product on page 1 moved,
     which is the same over-claim at a smaller scale. */
  const newestOf = (items: { id: string }[]): Date =>
    items.reduce<Date>((max, p) => {
      const d = changedAt(p.id);
      return d > max ? d : max;
    }, new Date(0));

  const paginated = cat.cats.flatMap((c) => {
    const items = cat.byCategory.get(c.id) ?? [];
    const n = pageCount(items.length);
    return Array.from({ length: Math.max(0, n - 1) }, (_, i) => ({
      url: `${SITE_URL}${categoryPagePath(c.id, i + 2)}`,
      lastModified: newestOf(items.slice((i + 1) * PAGE_SIZE, (i + 2) * PAGE_SIZE)),
      changeFrequency: 'daily' as const,
      // deeper pages hold the lower-gap tail, so they are crawled after page 1
      priority: 0.5,
    }));
  });

  /* v5 — THE SIX TRUST ROUTES. They are static, they change with the policy and
     not with the catalogue, and `monthly` says so rather than claiming a daily
     change the artifact does not produce. They are also E-E-A-T signals, which is
     why they sit above the product tail in priority rather than at the bottom:
     a commerce-adjacent site with no About or Contact page is a documented
     quality-rating negative. /metodologia is the differentiator page and gets 0.7. */
  /* The category hub (2026-08-26). Daily, like the category pages it indexes —
     its counts move whenever the catalogue does. */
  const hub = [
    {
      url: `${SITE_URL}/categorias`,
      lastModified: newestOf(cat.products),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    },
  ];

  const trust = [
    { path: '/metodologia', priority: 0.7 },
    { path: '/acerca', priority: 0.5 },
    { path: '/contacto', priority: 0.5 },
    // 0.6: above the policy pages, below /metodologia. It is the only page on
    // the site addressed to a BUSINESS reader, and the one whose conversion
    // (a retailer data feed) resolves both the monetization question and the
    // self-hosted-images legal question.
    { path: '/comercios', priority: 0.6 },
    { path: '/privacidad', priority: 0.4 },
    { path: '/cookies', priority: 0.4 },
    { path: '/terminos', priority: 0.4 },
  ].map((t) => ({
    url: `${SITE_URL}${t.path}`,
    lastModified: exported,
    changeFrequency: 'monthly' as const,
    priority: t.priority,
  }));

  const brands = buildBrands(cat);

  return [
    { url: `${SITE_URL}/`, lastModified: exported, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/buscar`, lastModified: exported, changeFrequency: 'daily', priority: 0.8 },
    /* `/brechas` — 0.9, level with the category heads and above every trust
       route. It is not a policy page and it is not a product: it is the one
       measurement of Costa Rican retail this site publishes that exists nowhere
       else, it regenerates with the export every day (hence `daily`), and it is
       the only route here that could earn an inbound link on its own merits.
       Dated from the export like the other listing surfaces. */
    { url: `${SITE_URL}/brechas`, lastModified: exported, changeFrequency: 'daily', priority: 0.9 },
    ...hub,
    ...trust,
    ...cat.cats.map((c) => ({
      url: `${SITE_URL}${categoryPath(c.id)}`,
      lastModified: newestOf((cat.byCategory.get(c.id) ?? []).slice(0, PAGE_SIZE)),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
    ...paginated,
    /* THE BRAND SURFACES. `/marcas` sits with the hubs at 0.7; a brand hub is a
       navigational page and gets 0.7; a brand×CATEGORY page is a head-term
       landing page and gets 0.8 — level with `/buscar` and just under the
       category heads it is a slice of. They regenerate with the export, so they
       carry the export stamp like everything else derived from it. */
    { url: `${SITE_URL}/marcas`, lastModified: exported, changeFrequency: 'weekly' as const, priority: 0.7 },
    ...brands.map((b) => ({
      url: `${SITE_URL}${brandPath(b.slug)}`,
      lastModified: exported,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...brands.flatMap((b) => b.pairs.map((pr) => ({
      url: `${SITE_URL}${brandCategoryPath(b.slug, pr.id)}`,
      lastModified: exported,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))),
    ...cat.products.map((p) => ({
      url: `${SITE_URL}${productPath(p.id)}`,
      lastModified: changedAt(p.id),
      changeFrequency: 'daily' as const,
      // A product two chains disagree about is the one worth crawling first.
      priority: p.band === 'brecha' ? 0.8 : p.band === 'parejo' ? 0.6 : 0.5,
    })),
  ];
}
