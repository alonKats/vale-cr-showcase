/* T4'S PRIMARY REGION (§4.5-3). Nothing to compare, so show everything about the
   one thing.

   Driven entirely by `CategoryProfile.attributes` — the profile already declares
   the label, the unit, the display template and the enum value labels, which is
   why the two biggest new components in v4 (this and `FacetBar`) need no new data
   collection at all. THERE IS NO CATEGORY-SPECIFIC BRANCH, MAP OR STRING ANYWHERE
   IN THIS FILE: adding a category is a data change.

   ONE THING IN THE SPEC I COULD NOT BUILD FAITHFULLY, FLAGGED NOT SUBSTITUTED.
   §T3 `spec` asks for zap's GROUPED structure — `כללי / מאפייני מפתח / מאפייני
   אנרגיה / מידות` — "groups from CategoryProfile.attributes". The profile does not
   declare groups: `CategoryAttribute` carries key, label, unit, facet, display,
   values, value_labels and collapsible, and nothing that partitions them. Inventing
   the groups in the UI would put a category-specific map back in the app, which is
   the one thing this layer has never had. So the table is FLAT, and the group
   headers are an engine change (`categories.json`), not a UI change.

   ---- v7 §5.2 C3 — THE `Sin dato` ROWS DO NOT RENDER, AND THE FACT SURVIVES ----

   It used to render `Sin dato` in every cell the retailers left empty. Every one
   of those cells was honest, and on T4 — the primary region of 88% of the
   catalogue — the table still read as a list of things we do not know, in a
   product whose credibility rests on the things we do.

   THE CLAIM IS NOT WITHDRAWN, IT IS AGGREGATED: the empty rows are dropped and one
   line states the coverage — "Las cadenas publican 2 de 4 datos de este modelo."
   That is strictly MORE information than the cells it replaces (it gives the
   denominator, which no individual `Sin dato` cell could), it is a fact about THE
   RETAILERS rather than an apology from us, and it is countable where twelve
   scattered cells were not. v6 §4.4 ruled this and it did not ship.

   IF NOTHING IS MISSING THE LINE DOES NOT RENDER. "Las cadenas publican 4 de 4"
   is a sentence about a full table sitting directly above it — the freshness
   band's "0 tienen más de 24 h y ninguno más de 48 h" defect, which is a branch
   nobody took. AND IF NOTHING IS PUBLISHED AT ALL the table is not rendered as
   an empty box: the line carries the whole answer. */

import { attrText } from '@/lib/display';
import type { Category, Enriched } from '@/lib/types';
import s from './SpecTable.module.css';

export function SpecTable({ product, profile }: { product: Enriched; profile?: Category }) {
  const attrs = profile?.attributes ?? [];

  if (!attrs.length) {
    return (
      <p className={s.none}>
        La ficha de esta categoría todavía no está declarada, así que no le mostramos una tabla
        vacía.
      </p>
    );
  }

  /* C3 — the published rows are the table; the rest is a count. Computed once so
     the table and the coverage line can never disagree about the same denominator. */
  const published = attrs.filter((a) => {
    const raw = product.attributes?.[a.key];
    return raw !== null && raw !== undefined && raw !== '';
  });

  const coverage = published.length < attrs.length ? (
    <p className={s.coverage}>
      Las cadenas publican {published.length} de {attrs.length} datos de este modelo.
    </p>
  ) : null;

  if (!published.length) return coverage;

  return (
    <>
      <dl className={s.spec}>
        {published.map((a) => (
          <div className={s.cell} key={a.key}>
            <dt className={s.k}>{a.label}</dt>
            {/* attrText() is the only place a value becomes words — it resolves the
                profile's own `display` template and its `value_labels`, so
                "TOP_LOAD" reaches the screen as "Carga superior" and never as a
                matcher-internal key. */}
            <dd className={s.v}>{attrText(a, product.attributes[a.key] as string | number)}</dd>
          </div>
        ))}
        {/* An ODD attribute count leaves the last visual row half-filled, so the
            alternating band stops mid-table and reads as a rendering bug rather than as
            a stripe. One empty cell squares it off. It is decorative padding of a table,
            carries no data and is hidden from assistive tech — the alternative would be
            restructuring the grid into per-row wrappers for a purely visual gain.
            IT COUNTS THE RENDERED ROWS NOW, NOT THE DECLARED ONES (C3): keying it
            off `attrs` would square off a table it is no longer describing. */}
        {published.length % 2 === 1 ? <div className={s.cell} aria-hidden="true" /> : null}
      </dl>
      {coverage}
    </>
  );
}
