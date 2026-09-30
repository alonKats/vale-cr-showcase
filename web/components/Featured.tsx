/* THE HOME PAGE'S PRODUCT RAILS — v8. Figma 6:115 (a section) / 6:116 (its
   heading row) / 6:122 (its four cards).

   Five rails of four cards, with the "otras categorías" grid dropped in after
   the first — which is the frame's own order: product-section, then
   browsing-grid-section, then the next product-section.

   ---- THIS IS A SERVER COMPONENT AND THE RAILS ARE IN THE HTML -------------
   Carried over from v7.2 H1 and NOT relaxed by the repaint. It was `'use
   client'` once and read the catalogue out of `useApp()`, so the entire price
   surface of the most-linked page arrived by a 5.38 MB client fetch: `curl
   https://vale.cr/` returned FOUR `₡` characters, none of them a product price.
   A crawler with JS off read a skeleton, and so did anyone on a cold load.

   The ranking is `serverCatalog().byCategory` — the SAME sorted array
   `/categoria/[slug]` renders — rather than a second sort over a client copy, so
   a rail and the page it links to cannot disagree even in principle.

   ---- THE RAILS ARE RANKED BY PRICE GAP, NOT BY POPULARITY ----------------
   Not a fallback: it is the only claim our data supports. We cannot measure
   popularity. So the page's implicit claim is "here is where the chains
   disagree most", which is true and checkable.

   AND THE HEADINGS NO LONGER SAY SO. `Dónde hay más diferencia — {category}`
   and `hasta 45% de diferencia` were cut on 2026-08-27 when the difference
   framing was demoted site-wide; the redesign confirms the cut by drawing a
   heading that is just the category name and a `Ver todas ›`. The RANKING is
   untouched — these are still the widest-spread products in each category,
   because that is genuinely the most useful thing to show first. What changed is
   that the heading no longer makes the spread the reason to look. */

import Link from 'next/link';
import { Fragment } from 'react';

import type { Gaps } from '@/lib/gaps.server';
import { categoryPath } from '@/lib/seo';
import type { ServerCatalog } from '@/lib/server-catalog';
import type { CatRef } from '@/lib/stats.server';
import { BrowseGrid } from './BrowseGrid';
import { Icon } from './Icon';
import pg from './Page.module.css';
import { RailCard } from './ProductCard';

const PER_RAIL = 4;

export function Featured({
  cat, gaps, cats,
}: {
  cat: ServerCatalog;
  gaps: Gaps;
  /** the ranked category list, for the browsing grid's "otras" slice */
  cats: CatRef[];
}) {
  return (
    <>
      {gaps.homeRails.map((c, ci) => {
        /* `byCategory` is pre-sorted by `serverCatalog()` — outliers first, then
           by gap %, then by the cheaper price — and it hands the very same array
           to `/categoria/[slug]`. So these four cards are, by construction and
           not by a matching comparator, the four at the top of the category page
           this rail links to. */
        const ranked = (cat.byCategory.get(c.id) ?? []).slice(0, PER_RAIL);
        if (!ranked.length) return null;

        return (
          <Fragment key={c.id}>
            <section className={pg.sec} aria-labelledby={`rail-${c.id}`}>
              <div className={pg.shell}>
                <div className={pg.secHead}>
                  <h2 className={pg.secH} id={`rail-${c.id}`}>
                    {c.label}
                  </h2>
                  <Link href={categoryPath(c.id)} className={pg.secAct}>
                    Ver todas
                    <Icon name="chevron-right" size={16} />
                  </Link>
                </div>
                <ul className={pg.grid}>
                  {ranked.map((x, i) => (
                    /* eager only on the FIRST rail: those four are the only
                       cards that can be above the fold, and marking twenty
                       images high-priority is the same as marking none. */
                    <RailCard key={x.id} product={x} eager={ci === 0 && i < PER_RAIL} />
                  ))}
                </ul>
              </div>
            </section>

            {/* the frame's own order — the browsing grid sits between the first
                and second product sections, not at the end of the page */}
            {ci === 0 ? <BrowseGrid cats={cats} /> : null}
          </Fragment>
        );
      })}
    </>
  );
}
