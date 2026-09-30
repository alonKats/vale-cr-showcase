/* THE PRODUCT JUMP LIST (§4.5-5) — real `<a href>`, no client-only state.

   v4.1-FIX B4 — IT IS NO LONGER STYLED AS A TAB STRIP, AND THE COMPONENT NAME IS THE
   ONLY THING LEFT OF THAT. It shipped with a 2px `rgba(0,0,0,0)` keyline track on every
   item and no `aria-current` anywhere: a control styled as a tab set, behaving as a jump
   link, indicating nothing, in either state, on the navigational spine of all 2.170
   product pages. The strip was also the only place in the product where a real `<a>`
   rendered in --ink-2 instead of --act, so it did not read as a link either.

   Now: a `Saltar a:` label and a row of --act links. A tab metaphor promises
   panel-switching that this page cannot do — and must not do, see the two reasons
   below — so it stops promising it. Least code, no reserved indicator, no observer, no
   sticky offset for `.sec` to compensate for. Full reasoning in Tabs.module.css.


   ONE DELIBERATE DEVIATION FROM THE SPEC, FLAGGED RATHER THAN SUBSTITUTED
   SILENTLY. §4.5 asks for `?tab=` search params. `?tab=` cannot be used here for
   two reasons, and the second one is disqualifying:

     1. Reading `searchParams` in a route that also declares
        `generateStaticParams` + `dynamicParams = false` forces DYNAMIC rendering.
        That would un-prerender all 2.170 product pages — the exact architecture
        §5.1 calls "the most valuable thing in the repo".
     2. A `?tab=` strip renders ONE panel and hides three. With JavaScript
        disabled a crawler would then see the specs OR the offers OR the reviews,
        never all of them, and `seo-check.mjs` gate 1 asserts a product page says
        its prices, chains, specs and reviews with JS off. `?tab=` would trade an
        indexable page for a nicer URL.

   So the strip is a set of IN-PAGE ANCHORS over sections that are ALL RENDERED,
   which keeps every property the spec actually asked for — real `<a href>`,
   crawlable, shareable, keyboard-reachable, zero JavaScript, no client state —
   and adds one the `?tab=` version could not have: all of the content is in the
   HTML at the canonical URL.

   T3 gets 4 items, T4 gets 3 — and T4's missing `Precios` item is ABSENT, not
   disabled and not empty. A disabled `Precios (1)` tab is exactly zap's silence
   with extra steps. */

import s from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: string;
  /** rendered as `(3)` after the label. Composed from the artifact — a count is
   *  never typed and never rounded. */
  count?: number;
}

export function Tabs({ items }: { items: TabItem[] }) {
  return (
    <nav className={s.tabs} aria-label="Secciones de este producto">
      {/* aria-hidden: the nav's own accessible name already says what this row is, so
          the visible label is redundant to a screen reader and would be read twice. */}
      <span className={s.lb} aria-hidden="true">
        Saltar a:
      </span>
      <ul className={s.list}>
        {items.map((t) => (
          <li key={t.id}>
            <a className={s.tab} href={`#${t.id}`}>
              {t.label}
              {t.count === undefined ? null : <span className={s.n}> ({t.count})</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
