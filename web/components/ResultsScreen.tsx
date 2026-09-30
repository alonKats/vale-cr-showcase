'use client';

/* T2, SECOND HEAD — `/buscar` (§4.3).

   ONE TEMPLATE, TWO HEADS. `/categoria/[slug]` is the same composition rendered
   statically on the server with the category label as its `<h1>`; this is the same
   composition rendered from the client-side catalogue with the query as its `<h1>`.
   §1.0 is explicit that search is NOT a fifth template — it is T2 with a different
   heading and a different empty state — and giving it a slot would have cost the one
   T4 needed.

     crumb → head → facets + sort → count → grid → pager

   WHAT WENT, and each deletion is the pivot made concrete:
     three disjoint band sections separated by 96px  → one grid
     `VirtualRows` (65 lines of windowing)           → `Pagination`; page size 24
                                                       means nothing is ever long
                                                       enough to virtualize
     `Quiet` (a whole card component for one state)  → a `parejo` state of the card
                                                       and of `OfferTable`
     `IndexList` / the third density tier            → one card, three widths
     the featured slot                               → T1 only, where it belongs */

import { useEffect, useMemo, useState } from 'react';

import { useApp } from '@/lib/app-store';
import { mil } from '@/lib/format';
import type { BuildStats } from '@/lib/stats.server';
import { Breadcrumb } from './Breadcrumb';
import { FacetBar } from './FacetBar';
import pg from './Page.module.css';
import { PAGE_SIZE, Pagination } from './Pagination';
import { ProductCard } from './ProductCard';
import { ResultCount } from './ResultCount';
import { CatalogSkeleton } from './Skeleton';
import { LoadError, NoMatch, NoneInFilter, Offline, Searching } from './States';
import { Recent } from './TopBar';

export function ResultsScreen({ stats }: { stats: BuildStats }) {
  const { catalog, results, q, error, online, query, searching } = useApp();
  const [page, setPage] = useState(1);

  /* A new query is a new result set, so the window resets. Without this a user who
     was on page 7 of `todos` and then types three letters lands on an empty page 7
     and concludes the search is broken. */
  const key = `${q}|${query.state}|${query.category}|${query.sort}|${JSON.stringify(query.facets)}`;
  useEffect(() => setPage(1), [key]);

  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const clamped = Math.min(page, pages);
  const slice = useMemo(
    () => results.slice((clamped - 1) * PAGE_SIZE, clamped * PAGE_SIZE),
    [results, clamped],
  );

  const typed = q.trim();
  /* `searching` and not `!searchReady`: a keystroke is outstanding both while the
     index loads AND between any later keystroke and its answer. Previous results
     are kept on screen while a new query resolves — replacing them with a
     skeleton on every letter makes a fast search look slower than it is. */
  const waiting = searching && !results.length;
  /* `&& !searching` IS THE FIX. Without it an empty array means "the catalogue
     does not have this", which is only one of the two things an empty array can
     mean. The other is "nobody has looked yet". */
  const nothing = Boolean(catalog) && !results.length && !searching;
  const from = (clamped - 1) * PAGE_SIZE + 1;
  const to = Math.min(clamped * PAGE_SIZE, results.length);

  return (
    <div className={pg.shell}>
      <Breadcrumb trail={[{ name: 'Inicio', path: '/' }, { name: 'Buscar' }]} />

      <div className={pg.head}>
        <h1 className={pg.h1}>{typed ? `«${typed}»` : 'Buscar en todo el catálogo'}</h1>
      </div>

      <FacetBar stats={stats} />
      <Recent />

      {!online ? <Offline stamp={stats.freshLong} /> : null}

      {/* THE COUNT IS COMPOSED from the array actually rendered — never a rounded
          marketing number, never a figure typed into a string. Two live bugs today
          were exactly that: "las tres cadenas" against an artifact of eight, and
          `.join()` on an array of objects printing "[object Object]" into 8.701 meta
          descriptions with tsc green throughout. */}
      {results.length ? (
        <ResultCount
          n={results.length}
          noun={results.length === 1 ? 'producto' : 'productos'}
          of={catalog?.counts.total}
          extra={pages > 1 ? `mostrando ${mil(from)}–${mil(to)}` : undefined}
        />
      ) : null}

      {error ? <LoadError message={error} /> : null}
      {!catalog && !error ? <CatalogSkeleton /> : null}
      {catalog && waiting ? <Searching q={typed} /> : null}
      {nothing ? typed ? <NoMatch q={typed} /> : <NoneInFilter /> : null}

      {/* was `catalog && !nothing`, which was EQUIVALENT to this only while
          `nothing` meant "empty". Now that a pending search is neither, an
          explicit length test is the honest condition. */}
      {catalog && results.length ? (
        <>
          {/* `data-rowlist` is the stable hook seo-check.mjs gate 4 scrolls to before
              clicking a product — the intercept proof. It stays on the grid even
              though the grid is no longer a row list, because the gate's claim
              ("clicking a product opens the overlay at the canonical URL with no
              document navigation") is about the intercept, not about the geometry. */}
          <ul className={pg.grid} data-rowlist>
            {slice.map((x, i) => (
              <ProductCard key={x.id} product={x} eager={i < 4} />
            ))}
          </ul>
          {/* Buttons, not links: this surface has no crawlable URL per page, and
              inventing `?p=` params for a client list would publish ~90 indexable
              near-duplicates of content the category pages already own. The static
              category pages get the real `<a href>` version of the same component. */}
          <Pagination page={clamped} pages={pages} onGo={setPage} />
        </>
      ) : null}
    </div>
  );
}
