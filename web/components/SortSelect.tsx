'use client';

/* THE SORT CONTROL (§4.5-8). Four options and no fifth.

   zap's dropdown offers popularity / number of stores / price / rating / review
   count. THREE OF THOSE FIVE ARE UNMEASURABLE FOR US: we have no traffic data, no
   store ratings and no review counts on 8 of 8 chains. A sort option whose ordering
   is arbitrary is worse than a missing one — it is a claim that a ranking exists.

   Default is `brecha %` on a category and relevance on `/buscar` (a typed query is
   already in relevance order, and re-sorting it would throw away the only ranking
   the user asked for — `applyQuery` returns early for exactly that reason).

   A NATIVE `<select>`, not a custom listbox: it is keyboard-accessible, screen-
   reader-correct, and touch-native for free. Lazy-first — a custom dropdown here
   would be ~120 lines to be worse. 16px, because it is a form control and every form
   control in v4 is 16px without exception. */

import type { Sort } from '@/lib/catalog';
import s from './SortSelect.module.css';

/* THE PREFIX IS PART OF EACH OPTION. 18:107 draws the pill as one run —
   `Ordenar por: Precio menor` — so the prefix cannot be a sibling <span>: a
   <select> renders only its selected option's text, and a label beside it would
   sit OUTSIDE the pill the design draws. The visible label therefore lives in
   the options and the <label> element is visually hidden. */
const OPTIONS: { value: Sort; label: string }[] = [
  { value: 'brecha', label: 'Ordenar por: Brecha %' },
  { value: 'ahorro', label: 'Ordenar por: Ahorro en colones' },
  { value: 'precio-asc', label: 'Ordenar por: Precio menor' },
  { value: 'precio-desc', label: 'Ordenar por: Precio mayor' },
  { value: 'nombre', label: 'Ordenar por: Nombre' },
];

export function SortSelect({ value, onChange }: { value: Sort; onChange: (s: Sort) => void }) {
  return (
    <label className={s.wrap}>
      <span className={s.lb}>Ordenar por</span>
      <select
        className={s.sel}
        value={value}
        onChange={(e) => onChange(e.target.value as Sort)}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
