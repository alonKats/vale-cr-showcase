'use client';

/* THE CATEGORY SCROLLER — v8. Figma 6:79 / 10:18.

   Fifteen category tiles plus `Brechas`, in a horizontally scrolling row with a
   right-hand fade and one arrow. The frame draws seven because a 1440 frame
   holds seven; the catalogue has fifteen, so the row scrolls — which is the
   behaviour the owner asked for in the first place ("they show just a couple in top
   nav and use sliders for all the rest", 2026-08-07).

   THE ORDER IS THE CATALOGUE'S, NOT A CURATION — but `stats.cats` does NOT
   arrive ranked (it is alphabetical by id), so the ranking is applied here via
   `rankedCats`, the same function the chrome and the browsing grid use. That is
   what makes the first six tiles the six in the bar, in the same order, so a
   reader who scans one and then the other does not meet two different "top"
   lists. An earlier version of this comment asserted the ranking was already
   done upstream; it was not, and the browsing grid shipped a visible overlap
   because of it. */

import Link from 'next/link';

import { useRail } from '@/lib/use-rail';
import { rankedCats } from '@/lib/nav';
import { categoryPath } from '@/lib/seo';
import type { BuildStats } from '@/lib/stats.server';
import { CAT_ICONS, CAT_ICON_FALLBACK } from './cat-icons';
import { Icon } from './Icon';
import s from './CategoryRail.module.css';


export function CategoryRail({
  stats, current,
}: {
  stats: BuildStats;
  /** the category id being viewed, so the rail can mark it. Absent on `/`. */
  current?: string;
}) {
  const rail = useRail([stats.cats.length]);
  const cats = rankedCats(stats.cats);

  return (
    <nav className={s.wrap} aria-label="Explorar por categoría">
      <div className={s.rail} ref={rail.ref} onScroll={rail.onScroll}>
        {cats.map((c) => {
          const on = c.id === current;
          return (
            <Link
              key={c.id}
              href={categoryPath(c.id)}
              className={`${s.tile} ${on ? s.on : ''}`}
              aria-current={on ? 'page' : undefined}
            >
              <span className={s.well}>
                <Icon name={CAT_ICONS[c.id] ?? CAT_ICON_FALLBACK} size={24} />
              </span>
              <span className={s.label}>{c.label}</span>
            </Link>
          );
        })}
        {/* The 16th tile, and it is a destination rather than a category — the
            same call the chrome's `Brechas` link makes, and it gets the same
            treatment: no badge, no dot, no "¡Nuevo!". */}
        <Link href="/brechas" className={s.tile}>
          <span className={s.well}>
            <Icon name="grid" size={24} />
          </span>
          <span className={s.label}>Brechas</span>
        </Link>
      </div>

      {rail.overflows && (
        <>
          <span className={s.fade} aria-hidden="true" />
          <button
            type="button"
            className={s.next}
            onClick={() => rail.nudge(1)}
            disabled={!rail.canNext}
            aria-hidden="true"
            tabIndex={-1}
          >
            <Icon name="arrow-right" size={20} />
          </button>
        </>
      )}
    </nav>
  );
}
