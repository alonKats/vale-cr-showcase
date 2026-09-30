/* THE SAVING — typographic, with a proportional amber keyline. One
   implementation, two surfaces (§2.4, §4.4).

     AHORRE EN WALMART            12 / 600 / .04em / uppercase
     −₡187.587  (98%)             --display 20 / 600  +  14

   THE PROPORTIONAL AMBER KEYLINE IS DELETED (v4.1-FIX N1), AND THE `data-scales` /
   `data-pct` HOOKS WITH IT. It restated in a bar the percentage printed as text 8px
   above it — the redundancy that was supposed to earn it the space is what made it the
   object with no job. On the T3 390 fold the plate carried five treatments in 245px;
   it now carries four. The TrustBand's freshness distribution still exercises
   measure.mjs's pixels-vs-data bar assertion, so no gate lost its only subject.

   `tone="dark"` is the T3 `best` slot, where the figure is AMBER ON --ink
   (8.67:1) — the only surface amber may ever be text on. `tone="light"` is a row
   or a panel, where the figure is --ink and the amber lives only in the bar, which
   carries --loud-edge because amber on a light surface always does.

   No fill, no box, no badge: in v2 a filtered results view turned into 19
   identical red badges and the badge's whole scarcity argument collapsed the
   moment a user did the obvious thing.

   THE FIGURE IS THE OBJECT. `−₡187.587 (98%)` states the absolute saving and the
   ratio in the same breath, which is everything the bar was drawing. */

import { pct, savings } from '@/lib/format';
import type { Enriched } from '@/lib/types';
import p from './primitives.module.css';

export function Saving({
  product, tone = 'light',
}: {
  product: Enriched;
  tone?: 'light' | 'dark';
}) {
  // savings() throws rather than branching on a negative, so there is no
  // wrong-direction path to get wrong. Only ever called on `brecha`.
  const s = savings(product);

  return (
    <span className={tone === 'dark' ? `${p.saving} ${p.savingDark}` : p.saving}>
      <span className={p.savingK}>
        {s.verb} {s.prep} {s.chain}
      </span>
      <span className={p.savingN}>
        {s.delta} <span className={p.savingPct}>({pct(product.gapPct, false)})</span>
      </span>
    </span>
  );
}
