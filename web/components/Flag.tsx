/* THE MINT `MÁS BARATO EN` RIBBON (§4.5-11).

   Kept from zap, where it hangs off the leading edge of the cheapest offer row.
   Their LAVENDER `zap choice` ribbon is DELETED and is not coming back: no store
   ratings exist for any of our 8 chains, and a badge that looks earned but isn't
   is a trust liability in CR's active consumer-protection climate.

   TWO RULES, BOTH ENFORCED HERE RATHER THAN AT EACH CALL SITE:

   1. IT ONLY EXISTS WHEN THERE IS SOMETHING TO BE CHEAPEST THAN. `offerCount <= 1`
      returns null — cheapest of one is not a fact, and a MÁS BARATO flag on a
      single-offer product is the first thing on §1's list of what T4 must never
      do. 1.913 of 2.170 products are single-offer, so this branch is the common
      one.

   2. NOTHING IS MARKED CHEAPEST IN A NEAR-TIE. `band === 'parejo'` returns null
      too. Calling a ₡15 difference a winner is the overclaim this product exists
      to avoid, and the rule travels with the component rather than living in the
      head of whoever renders it next. (It arrived here from the deleted `Quiet`
      component, which is where it used to live.)

   v4.1 §10 — THE FILL IS GONE, THE FACT IS NOT. This badge is now --go ink plus a
   caret; the mint fill moved to the T3 `best` slot, which is the only place on the
   site where a "cheapest" fill is a claim about a comparison the reader can SEE. The
   reasoning, the measurement and the banned pair all live in Flag.module.css. */

import type { Enriched } from '@/lib/types';
import s from './Flag.module.css';

export function Flag({
  product, className, short = false,
}: {
  product: Enriched;
  className?: string;
  /** THE OFFER-ROW LABEL DROPS THE CHAIN NAME, and the spec already distinguishes the
   *  two: §T2's card reads `MÁS BARATO EN` + chain, §T3's offer row reads just
   *  `MÁS BARATO`. The reason is structural — in a row whose own leading cell IS the
   *  chain, repeating it is redundant, and at a 120px column it does not fit: it
   *  rendered as "MÁS BARATO EN ..." with the chain ellipsed away, which is the one
   *  outcome worse than either version. */
  short?: boolean;
}) {
  if (product.nChains <= 1) return null;
  if (product.band === 'parejo') return null;
  return (
    <span className={className ? `${s.flag} ${className}` : s.flag}>
      <span className={s.caret} aria-hidden="true" />
      {short ? 'Más barato' : `Más barato en ${product.lo.retailer}`}
    </span>
  );
}
