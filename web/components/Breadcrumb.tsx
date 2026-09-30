/* 3–4 levels, 12px, LOGICAL-START aligned (§4.5-10).

   zap's is right-aligned because zap is RTL Hebrew. Ours is not mirrored — it is
   rebuilt logically: `text-align: start`, `inset-inline-start`, and the separator
   sits between items rather than after each. Memory:
   `feedback_rtl_build_directionality_logically`.

   The separator is `›` rather than `·`. That is not taste: measure.mjs asserts no
   `·` may be the first or last thing on a rendered line, and a breadcrumb is the
   one list in the product that is BOTH separated and allowed to wrap. A chevron
   carries direction, so it reads correctly at a line break where a middot reads as
   debris.

   v4.1-FIX N9 — THE SEPARATOR TRAVELS WITH THE ITEM BEFORE IT, NOT THE ITEM AFTER IT.
   It used to render at the START of every item except the first, and each `<li>` is its
   own nowrap flex box, so the separator wrapped as part of the FOLLOWING crumb. Measured
   at 390 on T3: line 1 `Inicio › Refrigeradoras`, line 2 beginning `› Samsung French door
   29 pies³ RF29DB9950QDED` — a leading chevron at the start of a line. Rendering it at the
   END of every item except the last puts it where a wrap belongs: trailing line 1, which
   is what a separator is for. Still logical order, not a mirrored one — nothing here is
   positioned. */

/* The BreadcrumbList JSON-LD is emitted by the page through `JsonLd`, not here:
   one place in the app emits structured data, and seo-check.mjs asserts what that
   place may and may not carry. */

import Link from 'next/link';

import s from './Breadcrumb.module.css';

export interface Crumb {
  name: string;
  /** the last level is the current page and carries no href */
  path?: string;
}

export function Breadcrumb({ trail }: { trail: Crumb[] }) {
  return (
    <nav className={s.crumb} aria-label="Ruta">
      <ol className={s.list}>
        {trail.map((c, i) => (
          <li key={c.name} className={s.item}>
            {c.path ? (
              <Link href={c.path} className={s.link}>
                {c.name}
              </Link>
            ) : (
              <span className={s.here} aria-current="page">
                {c.name}
              </span>
            )}
            {i < trail.length - 1 ? (
              <span className={s.sep} aria-hidden="true">
                ›
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
