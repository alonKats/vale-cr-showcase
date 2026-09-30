/* T2, FIRST HEAD — `/categoria/[slug]` and `/categoria/[slug]/[page]`.

   ONE COMPONENT, SHARED BY BOTH ROUTES, for the same reason `Detail` is shared by the
   product page and the overlay: two copies of a composition drift, and here the thing
   that would drift is the crawlable link surface the whole SEO architecture rests on.

   These six pages carry the head terms ("refrigeradoras precios Costa Rica") that no
   individual product page can. Every product in the category is a real `<a href>` in
   the HTML with no JavaScript — now spread across numbered pages instead of one long
   list, which is what made `VirtualRows` deletable.

   ---- THE FACET REGION IS NOW HERE (2026-08-26) -------------------------
   This file used to carry an objection explaining why it could not be: reading
   `searchParams` would un-prerender all six head-term pages, and chips that
   navigate elsewhere are a control that lies about what it does. Both halves
   were correct, and neither was a reason to have NO filters — they were a reason
   not to filter on the SERVER.

   `CategoryRefine` is a client island that reads no `searchParams`, pushes no
   route and renders `children` UNCHANGED until something is actually selected.
   So this page is still prerendered, `dynamicParams = false` still holds, and a
   no-JS reader still gets every product as a real `<a href>`. The filtered view
   is deliberately not addressable — that reasoning is in the island's header,
   and it is a scaled-content decision rather than a missing feature.

   What went with it: `Filtrar y ordenar ›`, a link that sent a reader on a
   category page to `/buscar` and dropped their category on the way. */

import Link from 'next/link';

import { Breadcrumb, type Crumb } from './Breadcrumb';
import { CategoryRefine } from './CategoryRefine';
import pg from './Page.module.css';
import { PAGE_SIZE, Pagination } from './Pagination';
import { ProductCard } from './ProductCard';
import { mil } from '@/lib/format';
import { categoryPath } from '@/lib/seo';
import type { Category, Enriched } from '@/lib/types';

/** `/categoria/x` for page 1 and `/categoria/x/N` for the rest. Page 1 never gets a
 *  second address — a `/1` twin of a canonical page is duplicate content for free. */
export const categoryPagePath = (id: string, n: number) =>
  n <= 1 ? categoryPath(id) : `${categoryPath(id)}/${n}`;

export const pageCount = (n: number) => Math.max(1, Math.ceil(n / PAGE_SIZE));

/* ---- THE BRAND PAGES SHARE THIS COMPONENT (2026-08-31) ----------------
   `/marca/[brand]/[categoria]` renders through here too, which is why the four
   props below exist. They are ALL optional and every one defaults to exactly
   what the category route did before them, so `/categoria/[slug]` and
   `/categoria/[slug]/[page]` render byte-identically and needed no edit.

   That is deliberate: this component IS the crawlable link surface — every
   product a real `<a href>`, the pager real links, `dynamicParams = false` — and
   a second copy of it for brands would drift from the original. The thing that
   would drift is the SEO architecture. So the brand route is a thin wrapper that
   hands this one a filtered list and its own headings. */
export function CategoryScreen({
  profile, items, page, chains, heading, trail, paginate = true, alsoSee, brandLinks,
}: {
  profile: Category;
  /** the whole category, already ranked by serverCatalog() */
  items: Enriched[];
  page: number;
  /** chain names, ALWAYS via retailerNames() — never `.join()` on meta.retailers,
   *  which is an array of objects and printed "[object Object]" into 8.701 pages */
  chains: string;
  /** still accepted so the routes need no edit, no longer rendered — the
   *  denominator now lives on the cards. See the lede comment. */
  comparable?: number;
  /** the h1. Defaults to the category's own. */
  heading?: string;
  /** the breadcrumb trail. Defaults to Inicio › Categorías › <category>. */
  trail?: Crumb[];
  /** brand slices do NOT paginate — pages 2..N of one are a thin, near-duplicate
   *  crawl path. The full set stays reachable through the category page. */
  paginate?: boolean;
  /** the one link out of a filtered slice, back to the unfiltered listing */
  alsoSee?: { label: string; path: string };
  /** THE CRAWL PATH TO THE BRAND PAGES. A page nothing links to is a page
   *  Google will not spend crawl budget on, and a sitemap entry is a hint rather
   *  than a path — so the 57 brand×category pages are linked from the category
   *  each one is a slice of. It is also the most useful strip on the page for a
   *  reader who arrived knowing the brand they want. Absent on a brand page
   *  itself, where it would link a page to its own siblings and to itself. */
  brandLinks?: { label: string; path: string; count: number }[];
}) {
  const pages = paginate ? pageCount(items.length) : 1;
  const slice = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, items.length);

  return (
    <>
      <div className={pg.shell}>
      {/* THREE LEVELS, AND THE MIDDLE ONE IS A REAL PAGE (2026-08-26). It was
          `Inicio › Refrigeradoras`. The owner wanted the deeper trail he saw in the
          Stitch comp — but that comp's middle tier was `Electrodomésticos`,
          which I invented and which is plainly false for laptops, celulares,
          tablets and smartwatches. `/categorias` was built instead, so this
          segment resolves to a page that exists and is worth landing on.
          A `BreadcrumbList` item that 404s is a structured-data error aimed at
          Google, which is the cost of faking a tier rather than adding one. */}
      <Breadcrumb
        trail={trail ?? [
          { name: 'Inicio', path: '/' },
          { name: 'Categorías', path: '/categorias' },
          ...(page > 1
            ? [{ name: profile.label, path: categoryPath(profile.id) }, { name: `Página ${page}` }]
            : [{ name: profile.label }]),
        ]}
      />

      </div>

      {/* FULL-BLEED (18:53). The band is the page's backdrop, so it leaves the
          shell; its contents come straight back into one. */}
      <div className={pg.band}>
        <div className={`${pg.shell} ${pg.head}`}>
        {/* 28px. zap's is 40px and alone on its line; ours is alone on its line and
            capped at 28, because the scale stops at 34 and 34 belongs to a price. */}
        <h1 className={pg.h1}>
          {heading ?? `${profile.label} en Costa Rica`}
          {page > 1 ? ` — página ${page}` : ''}
        </h1>
        {/* THE TWO COUNTS ARE GONE. It read "308 modelos
            leídos en … 68 aparecen en más de una cadena". "No professional
            website says look at us, we have so many products."

            WHAT SURVIVES IS EVERY LOAD-BEARING PART OF IT, and the distinction
            matters: the counts were a BOAST, the rest are GUARDS.
              · the chain list — the credibility of the whole page, and under
                the index thesis it is the answer to "where do I even look";
              · `por número de modelo` — the comparison basis, without which a
                price comparison is an unsupported claim;
              · IVA and contado — a price without its tax basis is a wrong price.

            The comparable/total denominator moved from a sentence nobody read to
            the CARDS THEMSELVES, which now say `solo en Monge` on a single-store
            product and list the rival stores on every other. Per-product and
            unmissable beats a page-level aside. */}
        <p className={pg.lede}>
          Precios de contado con IVA incluido, leídos a diario en {chains}. Comparamos por número
          de modelo.
        </p>
        </div>
      </div>

      {/* BACK INSIDE THE SHELL. The band above is full-bleed by design; the
          filter bar and the grid are not, and closing the band after them left
          both flush to the viewport AND put the hero's dot field behind the
          whole page. The owner caught it in QA — the two symptoms were one bug. */}
      <div className={`${pg.shell} ${pg.pageEnd}`}>
        {brandLinks?.length ? (
          <nav className={pg.brandStrip} aria-label={`Marcas de ${profile.label}`}>
            <span className={pg.brandStripH}>Marcas:</span>
            {brandLinks.map((b) => (
              <Link key={b.path} href={b.path}>
                {b.label} <span>{b.count}</span>
              </Link>
            ))}
          </nav>
        ) : null}

        <CategoryRefine categoryId={profile.id} total={items.length}>
        {/* PAGE POSITION, NOT INVENTORY. It said `308 refrigeradoras — mostrando
            1–24`; the 308 was the boast and it is gone, the position is
            navigation and it stays. It renders ONLY when there is more than one
            page — on a short category the sentence would be answering a
            question nobody asked.

            The filtered count still appears, in the refine bar, because there it
            is FEEDBACK: it is how a reader knows the filter they just set did
            something. */}
        {pages > 1 ? (
          <div className={pg.secHead}>
            <p className={pg.secN}>
              Mostrando {mil(from)}–{mil(to)} de {mil(items.length)}
            </p>
          </div>
        ) : null}
        {/* GRIDS ALWAYS FILL (§5.3 mitigation 3). Page size 24 is exactly 6 rows at
            4-up, 8 at 3-up and 12 at 2-up, so a full page never shows a row with three
            cards and a hole. The LAST page shows what it has and the count says what it
            has — never a padded row. */}
        <ul className={pg.grid}>
          {slice.map((x, i) => (
            <ProductCard key={x.id} product={x} eager={page === 1 && i < 4} />
          ))}
        </ul>

        {/* REAL `<a href>` PER PAGE. The 2.178-URL indexable architecture depends on
            every product being reachable from here with JavaScript disabled, which is
            exactly why this is not infinite scroll. */}
        {paginate ? (
          <Pagination
            page={page}
            pages={pages}
            href={(n) => categoryPagePath(profile.id, n)}
            label={`Páginas de ${profile.label}`}
          />
        ) : null}
        {alsoSee ? (
          <p className={pg.alsoSee}>
            <Link href={alsoSee.path}>{alsoSee.label} ›</Link>
          </p>
        ) : null}
      </CategoryRefine>
      </div>
    </>
  );
}
