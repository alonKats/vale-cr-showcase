/* NUMBERED, CRAWLABLE PAGE LINKS (§4.5-7). Page size 24.

   THIS IS NOT INFINITE SCROLL AND IT IS NOT A "SHOW MORE" BUTTON, and the reason is
   architectural rather than aesthetic: the 2.178-URL indexable architecture is the
   most valuable thing in the repo (§5.1), and it depends on every product being
   reachable from a category page by a REAL `<a href>` with JavaScript disabled. An
   infinite list is 24 crawlable products and 502 invisible ones.

   It is also what made `VirtualRows.tsx` deletable: 65 lines of windowing, made
   redundant by a requirement elsewhere. The best code is code never written; the
   second best is code deleted because something else made it unnecessary.

   PAGE SIZE 24 IS DERIVED, NOT CHOSEN: it is exactly 6 rows at 4-up, 8 at 3-up and
   12 at 2-up, so a full page never renders a row with three cards and a hole. §5.3
   mitigation 3 — grids always fill.

   `href` is optional. Given → real `<a>` (the static category pages, which must be
   crawlable). Omitted → `<button>` + `onGo` (the client search surface, which has no
   URL to crawl). One conditional, one component; two components would be two places
   to get the window arithmetic wrong. */

import Link from 'next/link';

import s from './Pagination.module.css';

export const PAGE_SIZE = 24;

/** The window of page numbers to show. Always the first, the last, and ±2 around
 *  the current one, with `…` for the elided runs — so a 22-page category never
 *  renders 22 links, and page 1 and the last page are always one click away. */
function window(page: number, pages: number): (number | 'gap')[] {
  const keep = new Set<number>([1, pages, page - 2, page - 1, page, page + 1, page + 2]);
  const out: (number | 'gap')[] = [];
  let gap = false;
  for (let i = 1; i <= pages; i += 1) {
    if (keep.has(i)) {
      out.push(i);
      gap = false;
    } else if (!gap) {
      out.push('gap');
      gap = true;
    }
  }
  return out;
}

export function Pagination({
  page, pages, href, onGo, label = 'Páginas',
}: {
  page: number;
  pages: number;
  href?: (n: number) => string;
  onGo?: (n: number) => void;
  label?: string;
}) {
  if (pages <= 1) return null;
  const items = window(page, pages);

  const cell = (n: number) => {
    const here = n === page;
    const cls = here ? `${s.pg} ${s.here}` : s.pg;
    if (here) {
      return (
        <span className={cls} aria-current="page" key={n}>
          {n}
        </span>
      );
    }
    return href ? (
      <Link className={cls} href={href(n)} key={n}>
        {n}
      </Link>
    ) : (
      <button type="button" className={cls} onClick={() => onGo?.(n)} key={n}>
        {n}
      </button>
    );
  };

  return (
    <nav className={s.pager} aria-label={label}>
      {page > 1 ? (
        href ? (
          <Link className={s.arrow} href={href(page - 1)} rel="prev">
            ← Anterior
          </Link>
        ) : (
          <button type="button" className={s.arrow} onClick={() => onGo?.(page - 1)}>
            ← Anterior
          </button>
        )
      ) : null}

      {/* the numbers are their own group so the 4px gap between page cells is
          independent of the 16px gap between them and the two arrows (18:366) */}
      <span className={s.numbers}>
        {items.map((it, i) =>
          it === 'gap' ? (
            // eslint-disable-next-line react/no-array-index-key -- a gap has no identity of its own; its position IS its key
            <span className={s.gap} key={`gap${i}`} aria-hidden="true">
              …
            </span>
          ) : (
            cell(it)
          ))}
      </span>

      {page < pages ? (
        href ? (
          <Link className={`${s.arrow} ${s.next}`} href={href(page + 1)} rel="next">
            Siguiente →
          </Link>
        ) : (
          <button type="button" className={`${s.arrow} ${s.next}`} onClick={() => onGo?.(page + 1)}>
            Siguiente →
          </button>
        )
      ) : null}
    </nav>
  );
}
