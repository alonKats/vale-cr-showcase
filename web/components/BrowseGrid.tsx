/* "BUSCAR OTRAS CATEGORÍAS POPULARES" — v8. Figma 6:245 / 6:247.

   ---- THE HEADING DECIDES WHAT GOES IN IT ---------------------------------
   The frame fills these seven tiles with `Aires acondicionados · Barras de
   sonido · Celulares · Cocinas y hornos · Congeladores y frigobares · Consolas
   de videojuegos · Laptops` — which is simply the first seven categories in
   Spanish alphabetical order. That is mock data, not a rule: it puts Celulares
   and Laptops in the grid while the chrome's second tier is already showing
   both, two bands above.

   The heading says *OTRAS* categorías populares. So the rule is the heading's
   own: rank by product count, SKIP the ones the chrome already carries, take
   the next seven. `NAV_PRIMARY` lives in lib/nav.ts precisely so that this slice
   and the chrome's cannot drift apart — widen the nav to eight and this grid
   moves with it instead of quietly repeating two of them.

   ---- WHY IT IS NOT REDUNDANT WITH THE SCROLLER --------------------------
   The scroller above carries all fifteen categories and this carries seven of
   them again, which looks like duplication and is not: the scroller is a
   horizontally scrolling row, so on a 1440 viewport it shows seven and the other
   eight are behind a gesture. This grid is where the eight land. Between them
   every category is reachable without scrolling sideways, which is the whole
   "it's hard to know where to even go to look" argument the index was built
   for. */

import Link from 'next/link';

import { browseCats } from '@/lib/nav';
import { categoryPath } from '@/lib/seo';
import type { CatRef } from '@/lib/stats.server';
import s from './BrowseGrid.module.css';
import { CAT_ICONS, CAT_ICON_FALLBACK } from './cat-icons';
import { Icon } from './Icon';

export function BrowseGrid({ cats }: { cats: CatRef[] }) {
  const tiles = browseCats(cats);
  /* A catalogue with six or fewer categories leaves nothing to be "other" than
     the nav, and a section headed "otras" over an empty row is worse than no
     section. It renders nothing rather than a heading with a hole under it. */
  if (!tiles.length) return null;

  return (
    <section className={s.wrap} aria-labelledby="browse-h">
      <h2 className={s.h} id="browse-h">
        Buscar otras categorías populares
      </h2>
      <ul className={s.row}>
        {tiles.map((c) => (
          <li key={c.id}>
            <Link href={categoryPath(c.id)} className={s.tile}>
              <span className={s.well}>
                <Icon name={CAT_ICONS[c.id] ?? CAT_ICON_FALLBACK} size={28} />
              </span>
              {/* the label is clipped to one line, so the full name goes on the
                  link's title for a reader who meets a truncated one */}
              <span className={s.label} title={c.label}>
                {c.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
