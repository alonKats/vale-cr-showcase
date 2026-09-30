/* ==========================================================================
   THE ANSWER PLATE — v7.2 §3, and it is the two seconds.

   The homepage opened on a category rail and put its first real price at
   y=832, below the consent bar. This object puts ONE product's price gap at the
   top of the page as type: the catalogue's own widest-percentage difference,
   the two chains that published it, and a link to the product that proves it.

   ---- IT IS THE VERDICT PLATE AT PAGE SCALE, NOT A NEW IDIOM (§2.3) ----
   Same material as `VerdictPlate`: --ink, the full shell, --r2, NO SHADOW (the
   plate separates from --ground by 13,8:1 of value — a shadow under it would be
   the third one in a product that gates at two). What differs is the SUBJECT: a
   verdict plate answers "what does this product cost", this one answers "what
   is the biggest disagreement in the catalogue today".

   ---- WHICH PRODUCT: `byPct[0]`, NEVER `byCrc[0]` (§3.2) ----
   `byCrc[0]` is the largest COLONES gap — today a ₡975.000 spread on a
   ₡3–4 million 8K television. Two reasons it is the wrong record and both are
   about the page rather than the number:
     · nobody in this audience is buying it, so the figure reads as somebody
       else's problem
     · it CONTRADICTS THE OBJECT DIRECTLY BENEATH IT. The distribution strip's
       axis ends at the catalogue maximum, 79,85%. A plate showing a 32,2%
       product above a strip labelled `máximo 80%` is a page whose two loudest
       objects disagree about what the day's headline is.
   `byPct[0]` IS the strip's right-hand end — one fact rendered twice, which is
   what a composed page looks like. The designer got this wrong on her first pass and
   wrote the correction into the spec; it is repeated here because the two
   arrays differ by one character at the call site.

   ---- WHY THE COLONES FIGURE IS THE 56px GLYPH AND THE PERCENTAGE IS NOT ----
   79,85% is the more impressive number and it is the wrong one for this slot. A
   56px `80%` on a homepage says "Costa Rican retail varies by 80%", which is
   not what the artifact says. A 56px `₡155.390` beside a named stove says "this
   stove." The percentage still appears — as the strip's axis maximum, 16px
   below, where it is bounded by a denominator.

   ---- FOUR ELEMENTS AND NO FIFTH (§2.4) ----
   eyebrow · figure · sentence · price row. A fifth entry is how this becomes a
   hero, and a hero is what v4 deleted. Also on that list, all of them load
   bearing: never a second --loud object (the ramp is 2,63 on --ink and
   contrast.mjs fails the build if it is typed here), never a percentage larger
   than the colones figure, no gradient, no glow, no radius beyond --r2, and
   never the catalogue-wide claim — the denominator lives in the strip below
   and is not optional.

   ---- THE CHAIN LABELS ARE --on-deep-2, BOTH OF THEM (§8.1) ----
   `EN UNIMART` is the cheaper chain and every light surface in this product
   renders "the chain to buy from" in --go. --go on --ink measures 2,33 and is
   a BANNED pair, so typing it here fails the build — which is the correct
   outcome. The cheaper chain is distinguished by its position under the lower
   price, not by hue.
   ========================================================================== */

import { crc } from '@/lib/format';
import type { BuildStats } from '@/lib/stats.server';
import type { Enriched } from '@/lib/types';
import { ProductLink } from './ProductLink';
import s from './AnswerPlate.module.css';

/** ` · ` with BOTH spaces non-breaking — the `lib/format.ts` `cuotas()` idiom,
 *  same const and same reason as `Featured.tsx`. A separated pair that is allowed
 *  to wrap will, at some width, put the separator at a line boundary; gluing it
 *  to both neighbours removes the break opportunity rather than moving it. */
const SEP = ' · ';

/** One offer, twice per plate: the price over the chain that published it. The
 *  pair is one component so the two can never be composed apart — the defect
 *  class `lib/format.ts` `savings()` exists to prevent, at a smaller scale. */
function Offer({ price, chain }: { price: number; chain: string }) {
  return (
    <span className={s.offer}>
      <span className={s.price}>{crc(price)}</span>
      <span className={s.chain}>en {chain}</span>
    </span>
  );
}

export function AnswerPlate({ product, stats }: { product: Enriched; stats: BuildStats }) {
  return (
    /* §8.3 — a <section> with an accessible name, and the name is the h1 it
       already carries. `data-w="1"` is v7 §4.1's composition hook, built here
       for the first time: exactly one W1 group per template, above the fold. */
    <section className={s.plate} data-w="1" aria-labelledby="respuesta">
      {/* ELEMENT 1 — the eyebrow. The label names the reading so the figure
          cannot be read as an offer (§11 risk 1), and the freshness sentence
          rides the same line rather than the 28px strip above the page. THAT
          STRIP NO LONGER RENDERS ON `/` (TopBar `onHome`, the designer's F2/H3.5): the
          sentence appeared here AND at y=105 — twice on one screen, 80px apart —
          which reads as a bug. This is the only place `/` states it now.

          THE LABEL CARRIES THE CATEGORY, AND IT IS F3'S FIX (The designer, Wave-H
          critique §8.4). The plate's product link renders `cardT`, and ALL 14
          `card_title` templates lack an object noun — they read as products only
          where an attribute happens to be one (`{machine_type}` → "Lavadora").
          `cocinas` is `{brand} {fuel} {width_in}`, so the plate's only noun was
          `Mabe Eléctrica 20 pulgadas de ancho`: a link that names no object.
          Her ruling splits — in a RAIL the heading supplies the noun and this is
          not a defect; in the PLATE the link stands alone on the fold and the
          two-column layout made it the caption of the price pair, so the missing
          noun got MORE conspicuous. The plate already knows its category, so the
          eyebrow says it, BEFORE the figure rather than in fine print after it.
          No fifth element (§2.4 holds — this rides the node that already exists),
          no per-category noun map, no engine change. The engine-side template fix
          is a named systemic deferral, not this wave.

          `catLabel` IS DERIVED, NEVER TYPED — it is the CategoryProfile's own
          `label` (lib/catalog.ts), the identical string the nav and every rail
          heading render, so `display.ts`'s "no category-specific string anywhere
          in this app" invariant is untouched and a 15th category needs no edit
          here. Same discipline as `pctDec()`: the page states no number and no
          label it did not derive.

          ONE expression, therefore ONE text node, therefore honestly measured:
          measure.mjs 17a walks TEXT NODES and dedupes by parent element, so
          splitting this across two children of the same <span> would hide the
          second half from the gate rather than satisfy it. Measured 45 characters
          against the 60 cap.

          Still two nodes at the eyebrow level, and now load-bearing rather than
          precautionary: label + stamp concatenated is 71 characters today (it was
          52), which is over the cap outright. At ≥1024 the two are also placed in
          different corners of the plate (F1) — the label captions the figure, the
          stamp drops to the bottom-right — which `display: contents` on this <p>
          makes possible without a second markup path. */}
      <p className={s.eyebrow}>
        <span className={s.label}>{`La mayor diferencia de hoy${SEP}${product.catLabel}`}</span>
        <span className={s.stamp}>
          <span>{stats.freshShort}</span>
          {SEP}
          <span>{stats.exportedDay}</span>
        </span>
      </p>

      {/* ELEMENT 2 — the figure. --t8's only use in the product. It is amber
          because amber means money, and it is the plate's ENTIRE amber budget. */}
      <p className={s.figure}>{crc(product.gapCrc)}</p>

      {/* ELEMENT 3 — the h1, and it is the document's only one. It moved here
          from `Precios de hoy en Costa Rica` at 34px above the rail (§3.3): that
          string named a PAGE, and this slot has to name a READING. An h1 is a
          programmatic name and DESIGN.md §5 nowhere requires it to be the
          largest thing on the page — the emphasis now sits on a number.

          THE WORDING states a fact and stops: no verb, no urgency, nothing that competes
          with the figure above it or restates it. */}
      <h1 className={s.h1} id="respuesta">
        El mismo modelo, dos precios distintos.
      </h1>

      {/* ELEMENT 4 — the price row: the two published prices, their chains, and
          the product that proves it. THE CHEAPER ONE IS FIRST and it is `lo` by
          construction (`enrich()` sorts the offers), so no surface here decides
          a direction. The link is the ONLY interactive thing on the plate and it
          is a text link in --act-on-dark, never a filled CTA — a filled button
          here would make the plate read as an offer, which is the one claim this
          product must never make. */}
      <p className={s.row}>
        <Offer price={product.lo.price_crc} chain={product.lo.retailer} />
        <Offer price={product.hi.price_crc} chain={product.hi.retailer} />
        {/* `cardT`, not `productName()`: §3.2 names the link
            `Mabe Cocina Eléctrica 20"`. `productName()` returns brand + MODEL
            NUMBER, which is the right identity on a product page beside a photo
            and the wrong one as the only noun in a sentence about a stove. */}
        <ProductLink id={product.id} className={s.name}>
          {product.cardT} ›
        </ProductLink>
      </p>
    </section>
  );
}
