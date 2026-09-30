/* One line, COMPOSED FROM THE ARTIFACT (§4.5-9).

   zap prints `נמצאו 5180 מקררים` in bold 16px on its own line. Ours prints
   `526 refrigeradoras` the same way — and the number is the length of the filtered
   array, never a rounded-up marketing figure.

   THE TWO LIVE BUGS THIS COMPONENT EXISTS TO NOT REPEAT, both from today:
   "las tres cadenas" printed against an artifact carrying EIGHT, and
   `meta.retailers.join()` printed "[object Object]" into 8.701 meta descriptions
   because a type said `string[]` over an array of objects. Both were counts and
   names that were TYPED rather than composed. So: every figure that reaches this
   component is passed in from a real array length, and chain names only ever come
   through `retailerNames()`.

   16px is on the scale and is one of only two non-form uses of it (the other is the
   T1 rail heading) — the count is the one line on a results page a reader has to
   find without looking for it. */

import { mil } from '@/lib/format';
import s from './ResultCount.module.css';

export function ResultCount({
  n, noun, of, extra,
}: {
  /** the length of the array actually rendered */
  n: number;
  /** the category's own label, lower-cased by the caller. Never a hardcoded noun. */
  noun: string;
  /** when a filter is on: the size of the unfiltered pool, so the reader can see
   *  what the filter cost them rather than wondering. */
  of?: number;
  /** e.g. the page window — `mostrando 1–24`. Composed by the caller from the same
   *  numbers the pagination uses, so the two can never disagree. */
  extra?: string;
}) {
  return (
    <p className={s.count} aria-live="polite">
      <b className={s.n}>{mil(n)}</b> {noun}
      {of !== undefined && of !== n ? <span className={s.of}> de {mil(of)}</span> : null}
      {extra ? <span className={s.of}> — {extra}</span> : null}
    </p>
  );
}
