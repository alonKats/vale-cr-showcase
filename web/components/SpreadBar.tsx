/* ==========================================================================
   THE SPREAD BAR — design-direction-v7 §2. THE ONE BOLD MOVE.

   > The gap is a distance between two prices. Draw it as a distance.

   One horizontal track. Two marks on it. One amber span between them. The whole
   redesign is this object: vale's single fact, stated as a distance instead of
   as a chip and a paragraph.

   ---- THE AXIS IS THE ENTIRE DESIGN, AND IT IS NOT NEGOTIABLE (§2.5) ----
   The domain is `0 → meta.gap_distribution.max_gap_pct` — the largest gap in the
   catalogue on the export date (79,85% today) — on EVERY instance, at every
   scale, on every page. Never the product's own two prices.

   A bar drawn on `[low, high]` makes an 8% gap and an 80% gap look identical:
   the self-scaling lie, the same error class as the tautological 1200 shell and
   the %-of-page-area amber ceiling, both of which this project has already
   caught once. A bar drawn on `[0, high price]` puts the two marks on top of
   each other and makes every gap look like nothing. `0 → today's largest gap` is
   the only domain that is both honest and comparable — and it has the property
   that matters more: it is the SAME axis on the product page, the leaderboard,
   the category table and /brechas, so every bar in the product is mutually
   comparable and the reader learns the scale once.

   `axisMax` is therefore a REQUIRED prop with no default. A default would be a
   number typed into a component, which is precisely the failure the whole
   section is written against.

   ---- WHAT IT MUST NEVER DO (§2.5, verbatim — any of these is a bounce) ----
   · never rescale to the product              → `axisMax` is passed in, always
   · never render a span with no second price  → `hatch`, no span, no marks
   · never render a span below the parejo floor (gapPct < 5) — a near-tie is not
     a brecha. The track renders, the span does not, the label reads `casi igual`
   · never put a figure INSIDE the track       → labels sit above or below it
   · no second --loud object on this surface   → the span IS the amber
   · no gradient in the span, no rounded ends, no glow, no ruler graduations
   · the figures above the marks are the REAL PRICES, never the gap restated

   ---- THE PRINTED AXIS MAXIMUM IS LOAD-BEARING, NOT A CAPTION ----
   The designer's named risk for this object is that a horizontal track with a coloured
   fill is the most over-loaded shape on the web and may read as "80% complete"
   rather than "8% of the biggest disagreement in the country". Her stated fix is
   the printed axis maximum and the two chain labels — so the caption row is part
   of the object and does not get "tidied away" as decoration.

   ---- THE LABELS ARE MARK-ALIGNED. §2.1's DIAGRAM IS STRUCK (critique-v7-wave1 §3.2) ----
   This built §2.1's frame-aligned row first and flagged the conflict with §2.4.
   The designer ruled: §2.5's prose ("labels sit above or below THEIR OWN MARK") outranks
   both diagrams, §2.4's agrees with it, and §2.1's is a bug drawn for an ~80%
   product. Frame-alignment was measured as its own lie — the high label sat at
   90% of the track on EVERY product while its mark sat at 10–65%, so the reader,
   who reads the distance off the 14px/700 figures rather than off a 2×10px tick,
   read "full track" on all 525 comparable products. That is §2.5's self-scaling
   ban moved out of the span (gated) and into the typography (not gated).

   So the high figure is anchored to its own mark, and the collision objection —
   which was real, and which the ruling answers rather than waves at — is handled
   by a clamp instead of by frame-alignment. See SpreadBar.module.css `.figHi`
   for the geometry; it needs no measurement, no client JS and no extra node.

   BAND 0 IS A DIFFERENT OBJECT, NOT A DEGENERATE CASE OF THIS ONE. A near-tie has
   no high and no low: both marks land on 0%, so two mark-anchored labels collide
   completely — correctly, because there is nothing to separate. Rendering them at
   the two ends of the frame put two IDENTICAL numbers 328px apart on 124 products,
   which is the most expensive possible way to say "these are the same price". It
   renders as ONE position on the axis: one mark, one figure block at the track's
   left, `casi igual` underneath. That also resolves the critique's A7-1 (`markHi`
   sat 1px outside the track at 0% — the only place that tick was ever at 0%).

   ---- THE PLATE TAKES NO RAMP. NOT NOW, NOT IN A LATER PASS (v7.1 §9-3) ----
   v7.1 introduces a four-step amber ramp whose steps ARE the gap bands, and this
   surface is explicitly excluded from it: the span inside the verdict plate is
   flat `--loud` AT EVERY GAP SIZE. The reason is measured rather than stylistic —
   `--loud-4` is 2.63 on --ink, so a ramp step here would be a magnitude signal
   nobody can see on the darkest surface in the product, and v7.1 adds a banned
   pair to contrast.mjs that fails the build if one is typed. The band index still
   ships on every product (`gap_band`, v7.1 §9-1) for the LIGHT surfaces Wave 2
   builds; it is deliberately not read here.

   ---- WAVE 1 BUILDS ONE SCALE ----
   §2.2 declares four scales. This is scale 2, the verdict plate, because that is
   what Wave 1 (§12) asks for. There is no `scale` prop and no `tone` prop yet:
   three unused variants would be three untested variants. Wave 2 adds the
   leaderboard, category-table and /brechas scales — and the light-surface tone,
   where the low mark is --go rather than --card (§8's ruling: --go measures 2.33
   on --ink and CANNOT be the low mark inside the plate).

   WAVE 2 MUST ADD `band` AS A PROP AT THE SAME TIME AS THE LIGHT TONE, NOT
   AFTER IT (v7.1 §9-2), or this component gets built twice. On a light surface
   the fill is `var(--loud-${band})` with `--loud-edge` as the boundary in every
   band, and `band === 0` renders NO SPAN — which is the `parejo` floor already
   implemented below, so the fill is the only real change. The band arrives ON THE
   PRODUCT RECORD (`gap_band`) and must never be recomputed here.

   ---- W7: THE BAND IS NOW ON THE NODE, AND THE SPAN STILL IGNORES IT --------
   `bandAttrs(product)` writes `data-gap-band` + `data-gap-pct` on the bar root.
   Two things follow, and neither of them is a colour change:

     · the light scales Wave 2 adds inherit --band-fill / --band-edge from the
       table in tokens.css by being inside this node. Nothing to plumb, no prop
       to thread, and no second opinion about which step a product is on;
     · THE PLATE'S EXCLUSION BECOMES MEASURABLE. The bar now declares a band and
       visibly does not paint one — so measure.mjs assertion 27 can assert that
       the span inside an --ink plate is `--loud` while the node it sits in says
       "band 4", which is the runtime twin of the `#8A5A00 on #002832` banned
       pair. Before this attribute the exclusion was only checkable in a
       stylesheet a later pass would be editing anyway.

   NO `band` PROP WAS ADDED, and that is a stated deviation from v7.1 §10's
   wording. The band is a field on the `product` this component already takes;
   a prop that re-passes it has no caller today, and an untested variant is what
   this file's own comment three paragraphs up refuses to build. Wave 2 passes
   the same product and gets the same band.
   ========================================================================== */

import type { CSSProperties } from 'react';

import { crc, pct } from '@/lib/format';
import { bandAttrs, GAP_THRESHOLD } from '@/lib/catalog';
import type { Enriched } from '@/lib/types';
import s from './SpreadBar.module.css';

export function SpreadBar({
  product, axisMax,
}: {
  product: Enriched;
  /** `0 → axisMax`, the catalogue-wide domain. NO DEFAULT, on purpose. */
  axisMax: number;
}) {
  const { lo, hi, gapPct } = product;
  const comparable = product.nChains > 1;
  /* THE TWO GUARDS, AND THEY ARE THE SAME TWO EVERY AMBER OBJECT IN THIS PRODUCT
     CARRIES. `solo` has nothing to compare and gets the hatch; `parejo` has a
     real second price but no brecha, so it gets the track and ONE mark and NO
     span — calling a 2% difference a gap is the overclaim this product exists to
     avoid, and it is why the amber means anything anywhere else. */
  const tie = comparable && gapPct < GAP_THRESHOLD;
  const span = comparable && !tie;

  /* Clamped, though it cannot exceed 1 while lib/gaps.server.ts asserts the axis
     against the catalogue. The clamp is what makes that assertion the only thing
     that has to hold: if the artifact ever ships an axis smaller than a product
     on it, the span stops at the track's end instead of overflowing it. */
  const width = `${Math.min(100, Math.max(0, (gapPct / axisMax) * 100))}%`;
  /* ONE POSITION ON THE AXIS PUBLISHED BY N CHAINS. `sorted` is price-ascending, so
     when the two ends are equal every offer in between is equal too and all of them
     belong on the single figure. Reading the names off the offers rather than off
     `lo`/`hi` is what keeps a three-chain tie from printing two of its three names —
     and stops a one-price-two-rows product printing the same chain twice. */
  const samePrice = lo.price_crc === hi.price_crc;
  const tiedChains = product.sorted.map((o) => o.retailer).join(' · ');

  return (
    /* `--hi` IS THE MARK'S POSITION AND IT IS WRITTEN ONCE. The span's width, the
       high mark's offset and the high label's anchor are the same number by
       construction rather than by three inline styles that have to agree. */
    <div className={s.bar} style={{ '--hi': width } as CSSProperties} {...bandAttrs(product)}>
      {/* ---- the REAL PRICES, above their own marks (§2.5, §2.4's diagram) ---- */}
      {comparable ? (
        tie ? (
          /* BAND 0 — one mark, so one figure block, at the track's left. Identical
             prices collapse to a single figure carrying every chain that publishes
             it; prices a few colones apart stack, still left, because they are
             still one position on this axis. Neither is "the high price". */
          <div className={`${s.figs} ${s.figsTie}`}>
            <span className={s.fig}>
              <b className={s.price}>{crc(lo.price_crc)}</b>
              <span className={s.chain}>{samePrice ? tiedChains : lo.retailer}</span>
            </span>
            {samePrice ? null : (
              <span className={s.fig}>
                <b className={s.price}>{crc(hi.price_crc)}</b>
                <span className={s.chain}>{hi.retailer}</span>
              </span>
            )}
          </div>
        ) : (
          <div className={s.figs}>
            {/* the low figure needs no anchor: `markLo` is at 0% at every gap size,
                so left-aligned at the frame IS mark-aligned, always. */}
            <span className={s.fig}>
              <b className={s.price}>{crc(lo.price_crc)}</b>
              <span className={s.chain}>{lo.retailer}</span>
            </span>
            <span className={`${s.fig} ${s.figHi}`}>
              <b className={s.price}>{crc(hi.price_crc)}</b>
              <span className={s.chain}>{hi.retailer}</span>
            </span>
          </div>
        )
      ) : null}

      {/* ---- the track. 8px, SQUARE ENDS, zero radius: square reads as
              measurement, pill reads as decoration. The track IS the axis —
              there is no separate axis rule and no graduation, so its right-hand
              end is the catalogue maximum and the caption below says so. ---- */}
      <div className={comparable ? s.track : `${s.track} ${s.trackHatch}`}>
        {span ? (
          <>
            {/* THE SPAN — the one --loud object on this surface. It grows from 0
                on first paint, once, at --med/--ease. The global reduced-motion
                collapse (tokens.css) turns --med into 0.01ms, so there is no
                local media query here and there must never be one. */}
            <span className={s.span} />
            <span className={s.markLo} />
            <span className={s.markHi} />
          </>
        ) : comparable ? (
          /* THE NEAR-TIE: ONE MARK, no span. A sub-5% spread is not a brecha, and
             it is not a high price either — two marks at 0–6% of the track are one
             position drawn twice, and they drag two labels apart with them. The
             single mark is the honest picture and the one a sentence takes four
             lines to draw. */
          <span className={s.markLo} />
        ) : null}
      </div>

      {/* THE GAP FIGURE IS GONE FROM HERE. It read `₡200.000 · 31% de
              diferencia` in --loud, directly above the plate's green savings box
              which says the identical sentence — the same fact twice, eight
              pixels apart, in two colours. 17:101 gives that statement to the
              green box, so this is where it is removed rather than there. It was
              also --loud as TEXT on a white card (1.97), a banned pair. */}
      {tie ? (
        <p className={s.tie}>casi igual</p>
      ) : null}

      {/* ---- THE PRINTED AXIS. The designer's #1 anti-progress-bar tell. The `·` is
              NBSP-glued on both sides so measure.mjs assertion 5 (no separator at
              a line boundary) is unreachable rather than merely untested — this
              is the narrowest two-part string in the plate. ---- */}
      <p className={s.axis}>
        <span>0</span>
        <span>{`la brecha más grande hoy · ${pct(axisMax, false)}`}</span>
      </p>
    </div>
  );
}
