/* TWO VARIANTS IN ONE COMPONENT, NOT TWO COMPONENTS (§4.3) — AND AFTER v4.1-FIX B1,
   ONE SURFACE.

   `variant="best"`  T3, 257 products (11.8%) — the answer. The mint ribbon, the amber
                     saving, the 44px price, one filled CTA.
   `variant="only"`  T4, 1.913 products (88.2%) — the STATEMENT. The same dark plate,
                     the same 44px price, and the absence of a comparison said OUT
                     LOUD in words instead of a ribbon and a saving.

   ---- B1: THE `only` PLATE IS NO LONGER GREY, AND THAT WAS THE BIGGEST DEFECT ----
   v4 reasoned "the dark fill means THIS IS THE ANSWER, and T4 has no answer". Measured
   consequence: on 88% of the catalogue the product's entire answer rendered on --fill
   — the token whose own comment reads "chip rests, alternating spec rows" — with the
   44px price in utility grey inside a 1px --edge box. A single offer is a WEAKER
   COMPARISON, NOT A LESS CERTAIN FACT: "₡6.599.900 en Monge, and no other chain
   publishes this model number" is fully evidenced. Quietness-of-surface was the wrong
   instrument for "less to compare", so the differentiation moved to what the plate
   CARRIES. Same plate, fewer claims on it.

   THE REGION ORDER IS NOW IDENTICAL ON BOTH TEMPLATES — kicker, price, the words, the
   outbound pill, the audit link. It differed before (T4 put the audit link above the
   CTA), which is exactly the kind of drift two skins invite.

   44px IS THE TOP OF THE SCALE AND IT IS SPENT HERE AND NOWHERE ELSE, EVER. The
   largest glyph anywhere in the product is a price.

   ZAP'S EQUIVALENT SLOT CARRIES A `מודעה` TAG — IT IS A PAID PLACEMENT. Ours is
   never paid, never tagged, and is always the genuinely lowest price in the
   artifact. That is the whole difference between our slot and theirs, and it is why
   the trust band and the method link survive the redesign. */

import { crc, pct } from '@/lib/format';
import type { Enriched } from '@/lib/types';
import { Icon } from './Icon';
import { SpreadBar } from './SpreadBar';
import s from './VerdictPlate.module.css';

/** The method note's anchor, shared by both variants' audit link. The plate makes
 *  the loudest claim on the page, so the link that lets a skeptic check it belongs
 *  beside the claim rather than in the footer. */
export const METHOD_ID = 'como-comparamos';

/** The plate's accessible one-liner. Used as the dialog's <h1> in the overlay
 *  frame, so the sheet's heading is the ANSWER while the page's heading is the
 *  product's IDENTITY — the only difference between the two frames. */
export function Verdict({ product }: { product: Enriched }) {
  if (product.nChains <= 1) {
    return (
      <>
        Solo {product.lo.retailer} publica este modelo — {crc(product.lo.price_crc)}
      </>
    );
  }
  if (product.band === 'parejo') {
    return (
      <>
        Las {product.nChains} cadenas cobran casi lo mismo — desde {crc(product.lo.price_crc)}
      </>
    );
  }
  return (
    <>
      Más barato en {product.lo.retailer} — {crc(product.lo.price_crc)}
    </>
  );
}

export function VerdictPlate({ product, axisMaxPct }: { product: Enriched; axisMaxPct: number }) {
  const { lo } = product;
  const comparable = product.nChains > 1;
  /* NOTHING IS MARKED CHEAPEST IN A NEAR-TIE. Calling a ₡15 difference a winner is
     the overclaim this product exists to avoid, so the `parejo` state names the real
     remaining question — which branch is closer — instead of inventing a verdict.
     This is the rule that travelled here from the DELETED `Quiet` component; it is
     not optional and it is not a styling variant. */
  const tie = comparable && product.band === 'parejo';
  /* THE MINT FILL IS THE ONLY THING THAT SEPARATES THE TWO PLATES NOW (B1), and it
     needs BOTH guards: something to be cheapest than, and a real difference. */
  const win = comparable && !tie;

  return (
    <aside
      className={s.plate}
      aria-label={comparable ? 'El precio más bajo hoy' : 'Precio publicado'}
    >
      <div className={s.head}>
        <p className={win ? `${s.kicker} ${s.kickerWin}` : s.kicker}>
          {comparable
            ? tie
              ? `Desde, en ${lo.retailer}`
              : `Más barato en ${lo.retailer}`
            : `Precio en ${lo.retailer}`}
        </p>
        {/* 17:87 draws `✓ En Stock` unconditionally. It is rendered from
            `lo.in_stock`, which the engine actually reads, so the negative case
            says the negative thing instead of the panel quietly claiming
            availability it has not checked. */}
        <span className={lo.in_stock ? s.stock : `${s.stock} ${s.stockOut}`}>
          {lo.in_stock ? '✓ En stock' : 'Sin confirmar'}
        </span>
      </div>
      <div>
        <p className={s.lede}>
          {comparable ? 'Mejor precio encontrado:' : 'Precio publicado:'}
        </p>
        <p className={s.price} data-verdict-price>
          {crc(lo.price_crc)}
        </p>
      </div>

      {/* ---- v7 §2.4 — THE SPREAD BAR. IT IS WHAT WAS IN THE HOLE. ----

          The plate is the only object in this product that already breaks the panel
          stack, so it is where the one bold move lands: the gap, drawn as a distance
          on the catalogue-wide axis, replacing the `−₡20.271 (8%)` line that used to
          state it at 14px.

          IT RENDERS IN ALL THREE STATES AND IT IS THE SAME OBJECT IN EACH — that is
          the point of giving T4 the slot rather than an apology. On a single-offer
          product the track is HATCHED end to end with no span and no marks: "there is
          one price and nothing to measure it against", said in the material instead of
          in five sections of prose. On a near-tie the track and both marks render and
          the span does not, because a sub-5% spread is not a brecha. */}
      <SpreadBar product={product} axisMax={axisMaxPct} />
      {/* `Saving` WAS DELETED FROM THIS PANEL under the v4 §2.5 rule "no second
          --loud object on a surface carrying a --loud figure". 17:101 brings the
          statement back and the rule is NOT violated, because the object is not
          --loud any more: it is a GREEN box, in the savings grammar the whole
          redesign uses, on a panel whose figure is teal. The rule was about
          amber competing with amber, and there is no longer any amber here
          except the CTA. Guarded on `win`, so a near-tie and a single-offer
          product never see a savings claim. */}
      {win && product.gapCrc > 0 ? (
        <p className={s.saving}>
          <Icon name="arrow-down-teal" size={16} />
          Ahorrás {crc(product.gapCrc)} · {pct(product.gapPct, false)} de diferencia
        </p>
      ) : null}

      {/* THE WORDS. One slot, three states, and every one of them says what the data
          supports and nothing more.

          A CONSISTENCY RULE: `CompareTray`'s `solo` band already says
          "no hay con qué comparar" for the identical situation (one retailer, nothing
          to measure against), and this exact phrase must not drift between
          surfaces. Same fact, same words, two surfaces.
          "mismo" dropped as redundant beside "este". ~76 characters, inside the box's
          2-line / 44ch budget. It is also THE SINGLE HIGHEST-LEVERAGE SENTENCE IN THE
          BUILD and the thing zap does not have. */}
      {!comparable ? (
        <p className={s.statement}>
          No hay con qué comparar: ninguna otra cadena publica este número de modelo.
        </p>
      ) : tie ? (
        <p className={s.tie}>
          Las {product.nChains} cadenas cobran prácticamente lo mismo: {crc(product.gapCrc)} de
          diferencia. No le decimos que una es la barata, porque no lo es — lo que queda por decidir
          es cuál sucursal le queda cerca.
        </p>
      ) : null}
      {/* `Saving` NO LONGER RENDERS HERE, AND ITS DELETION IS THE §2.5 RULE THAT
          MATTERS MOST ON THIS SURFACE: "no second --loud object on a surface carrying a
          spread bar — the span IS the amber." The saving figure was `AHORRE EN <cadena>
          / −₡20.271 (8%)` at --t2; the same two numbers now render under the span at
          --t4/700, which is the size v6 §4.3 P3 asked for and never got. Nothing is
          withdrawn — the absolute saving and the percentage are both still printed,
          once, beside the geometry that draws them. `Saving` itself is untouched and
          still ships on the light surfaces that have no room for a track.

          A KNOWN REDUNDANCY, kept on purpose: in the NEAR-TIE state the
          sentence above and the bar's own `casi igual` label both say the spread is
          negligible, ~8px apart. §2.5 mandates the label at every scale and the
          sentence is the copywriter's, carrying an editorial refusal (§3.1 grammar 3 — "we are
          not calling a winner") that a mark must not make on our behalf. Both specs
          are therefore built intact and the redundancy is reported rather than
          arbitrated by the build. 124 of 4.338 products are in this state. */}

      {/* THE OUTBOUND CTA — one of exactly two button recipes in the product (B6):
          40px, filled, pill. Inside a dark plate an --ink fill would disappear, so it
          inverts to a --card fill with an --ink label (15.56:1). Same recipe, the
          surface decides the polarity. Identical on both templates: the plate is not
          the answer on T4, but an outbound link is still an action. */}
      <a
        className={s.cta}
        href={lo.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Ver en {lo.retailer} ›
      </a>

      {/* The method link is WITHIN REACH OF THE CLAIM, not parked in the footer.
          zap gets away with density because their Terms say the ordering is at
          their sole discretion; ours has to be accountable at the same density, and
          that is a real constraint on the layout rather than a nicety. */}
      <a className={s.audit} href={`#${METHOD_ID}`}>
        Cómo comparamos ›
      </a>
    </aside>
  );
}
