'use client';

/* Skeleton, never a white flash and never a spinner.

   ITS GEOMETRY MUST MATCH THE NEW CARD EXACTLY, so nothing reflows when the data
   lands (§4.4). v3's version rendered real `Row.module.css` rows for the same reason;
   the browse surface is `ProductCard` now, so this renders card-shaped boxes on the
   same `pg.grid`. The grid derives its column count from `auto-fill`, so the skeleton
   shows 4 / 4 / 3 / 2 boxes at exactly the widths the real cards do — a thing that had
   to be maintained by hand in v3 and now cannot drift.

   A SLOW OPACITY BREATH, NEVER A SHIMMER SWEEP. A gradient travelling across the
   screen is decoration doing no job (DESIGN.md §3), and the breath collapses with the
   motion tokens under `prefers-reduced-motion`, handled once in tokens.css. */

import pg from './Page.module.css';
import p from './primitives.module.css';
import k from './Skeleton.module.css';

/** Exactly one page of cards — the same 24 the real grid will render, so the page
 *  height does not jump when the catalogue lands. */
const N = 24;

export function CatalogSkeleton() {
  return (
    <ul className={pg.grid} aria-hidden="true">
      {Array.from({ length: N }, (_, i) => (
        // eslint-disable-next-line react/no-array-index-key -- placeholders have no identity; position IS the key
        <li className={k.card} key={i}>
          <div className={k.flagRow} />
          <div className={`${p.skel} ${k.thumb}`} />
          <div className={`${p.skel} ${p.skelLine}`} style={{ width: '90%' }} />
          <div className={`${p.skel} ${p.skelLine}`} style={{ width: '64%' }} />
          <div className={`${p.skel} ${k.price}`} />
          <div className={`${p.skel} ${p.skelLine}`} style={{ width: '48%' }} />
          <div className={`${p.skel} ${k.cta}`} />
        </li>
      ))}
    </ul>
  );
}
