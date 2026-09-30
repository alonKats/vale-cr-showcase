/* ==========================================================================
   THE DISTRIBUTION STRIP — v7 §2.3, specced in v7.1 §3.4.

   > It is not a legend. It is the hero, and it is where a reader learns the
   > palette without being told they are learning anything.

   Five bins, adjacent, left to right in gap order, pale to dark. After this
   object every amber thing in the product is decodable on sight: a darker chip
   is a bigger gap. THE MECHANISM IS ADJACENCY (v7.1 §11-1) — five bins touching,
   in order, on one strip. Separate them, caption them individually or reorder
   them by count and the ramp is never taught, and every amber elsewhere reverts
   to decoration.

   ---- THE FIRST BIN IS NOT AMBER, AND THE REASON WHY HAS BEEN CORRECTED -----
   §1.5 SAID `casi igual` WAS THE LARGEST BIN AND IT IS NOT. Live
   (`meta.gap_distribution`, Aug-11) the bins are 124 / 91 / 119 / 176 / 15 on
   edges [0,5,10,20,50]: the largest is `20–50%` at 176 and `casi igual` is
   THIRD. §1.5's "the reader's first encounter with this palette is the group
   where nothing is wrong" was composed from wrong counts and the designer struck it
   (Wave-H critique §5 item 2). It is not restated here in softer words.

   The first bin is still drawn in --fill with a 1px --edge boundary, and the
   reason that survives the correction is the RAMP's, not the guard's: --fill is
   where the sequential scale starts, and a near-tie is the absence of a gap
   rather than a small one. What replaced the struck guard is a true statement in
   the caption — the median, stated before the shape is read. See the figcaption.

   ---- WHAT IT REPLACES, AND WHY THAT IS NOT A DELETION ----------------------
   The three identical KPI boxes (525 · 14,2% · 80%, measured 421×37 each). All
   three figures survive HERE, with their relationship visible instead of
   asserted: 525 is the headline, the median is a POSITION on the axis and the
   maximum is the axis's own right-hand end. That is v7 §2.3 verbatim, and it is
   the reason the strip is worth building rather than adding.

   ---- EVERY NUMBER IS DERIVED. NOTHING IS TYPED (§0.1) ----------------------
   The bins, their edges, their counts and the axis all come from
   `meta.gap_distribution` via buildGaps(). The band labels are COMPOSED from
   each bin's own `from`/`to`, so the day the engine moves an edge the labels
   move with it. A histogram with a hardcoded bin is the `las 8` defect (v6.1
   §5.2) in a new costume, and it is the single easiest way to ship this object
   wrong.

   ---- TWO THINGS THIS DELIBERATELY DOES NOT DO -----------------------------
   · NO LOG SCALE, NO SQUARE ROOT. Bar height is LINEAR IN COUNT from a zero
     baseline. The largest bin is 124 and the smallest 15; an 8,3× ratio drawn
     honestly is the whole argument of §1.5, and a compressed axis would flatter
     the tail at the near-tie's expense.
   · NO Y-AXIS, NO GRIDLINES, NO RULES. Each bar prints its own count directly
     underneath it. A gridline exists to let you read a value off a bar you were
     not given; every value here is given.
   ========================================================================== */

import Link from 'next/link';
import type { CSSProperties } from 'react';

import { dec, mil, pct } from '@/lib/format';
import type { Gaps } from '@/lib/gaps.server';
import s from './GapStrip.module.css';

/** `13,8` — the Spanish decimal comma, through the one formatter. A percentage
 *  with one decimal is a measurement; the same number rounded is a headline. */
const pctDec = (n: number) => `${dec(n)}%`;

/** ` · ` with BOTH spaces non-breaking — `lib/format.ts` `cuotas()`, `Featured`
 *  and `AnswerPlate` use the identical const for the identical reason:
 *  measure.mjs fails a `·` that starts, ends or sits alone on a rendered line,
 *  and gluing both neighbours removes the break opportunity rather than moving
 *  it. The caption is the one line on this object that wraps. */
const SEP = ' · ';

/** An edge is a WHOLE NUMBER in the artifact ([0,5,10,20,50]) and prints as one.
 *  `dec()` unconditionally would render `5,0–10,0%`, which reads as a measured
 *  quantity when it is a boundary somebody chose — and it is 4 characters wider
 *  in a column that is 21px at 390. The decimal survives for a non-integer edge,
 *  because the edges are data and this label is composed from them. */
const edge = (n: number) => (Number.isInteger(n) ? String(n) : dec(n));

/** The band label, COMPOSED from the bin's own edges (§0.1). `to === null` is
 *  the open-ended top bin, which is why it reads `+50%` rather than `50–80%`:
 *  the bin is not bounded by today's maximum, it is bounded by nothing. */
const binLabel = (from: number, to: number | null) =>
  (to === null ? `+${edge(from)}%` : `${edge(from)}–${edge(to)}%`);

/* ---- v7.2 §3.5 — ONE OPTIONAL PROP, AND IT CARRIES DELTAS S2 AND S3 --------
   `href` means "this strip is standing on its own, as the link to that page" —
   which is what the homepage needs it to do (S2: the whole strip is one link to
   /brechas, replacing the `ver todas las brechas ›` text link §6.1 cuts).

   S3 rides on the same prop rather than a second one, because it is the same
   fact about the call site: on /brechas the denominator is stated twice around
   this object — the standfirst above it and guard 1 beside it — so the caption
   only has to say what 525 is. STANDING ALONE ON THE HOMEPAGE IT HAS TO CARRY
   ITS OWN DENOMINATOR, and that line is "mandatory and not collapsible": it is
   the honesty guard for the 56px figure in the plate above it, and the single
   easiest lie this page could tell is a big amber number with no `de 4.338`
   under it. So /brechas renders byte-identically to today and the homepage
   gets the fuller sentence, from one prop and no variant flag.

   THE CAPTION STAYS ABOVE THE BARS, which is where this component has always
   put it and where §3.5's own reasoning wants it — "a reader has to know what
   525 is a share of BEFORE reading the shape, or the shape says Costa Rican
   retail varies by 80%". §3.1's sketch draws it under the bars; that is the one
   place the sketch and the argument disagree, and the argument wins. Flagged in
   the build report rather than resolved silently. */
export function GapStrip({ gaps, href }: { gaps: Gaps; href?: string }) {
  const { bins, comparable, medianPct, axisMaxPct } = gaps;

  /* NO BINS, NO STRIP — and no client-side substitute. An export older than E0
     has no distribution to draw, and binning 525 products in the browser to
     cover for it is exactly the defect the edges ship as data to prevent. The
     page keeps its denominator sentence and loses one object. */
  if (!bins || bins.length === 0) return null;

  /* THE TWO GEOMETRIES, AND THEY ARE DIFFERENT ON PURPOSE (§3.4).
       · WIDTH is the bin's share of the AXIS — so the strip is also a picture of
         the same `0 → 79,85%` axis every spread bar in the product is drawn on,
         and the reader learns that axis here once.
       · HEIGHT is the bin's share of the LARGEST COUNT, linear, from zero.
     Sharing one number between the two would make a wide bin look populous. */
  const maxCount = Math.max(...bins.map((b) => b.count));
  const span = (b: { from: number; to: number | null }) => (b.to ?? axisMaxPct) - b.from;

  const strip = (
    <figure className={s.strip}>
      {/* THE DENOMINATOR IS THE HEADLINE, not a caption underneath. A reader has
          to know what 525 is a share of BEFORE reading the shape, or the shape
          says "Costa Rican retail varies by 80%", which is not what we measured
          (the /brechas guard sentence carries the other half, above this).

          ---- AND ON `/` IT CARRIES THE MEDIAN TOO (The designer §5 item 2) --------
          §1.5's guard was "the reader's first encounter with this palette is the
          group where nothing is wrong" — the near-tie as the largest bin. THAT
          IS FALSE AGAINST THE LIVE ARTIFACT: the bins are 124/91/119/176/15, so
          `20–50%` is the largest and `casi igual` is third. The guard was
          invented from wrong numbers and it is struck.

          The real risk is the opposite one, and it is visible in the render: the
          `20–50%` bin is the biggest, darkest, widest amber block on the first
          screen and a reader takes away "prices differ by 20–50%". That
          OVER-states — the median is 14,2% and 215 of 525 are under 10%. The
          median was typeset as a 12px axis tick, equal in weight to `MÁXIMO 80%`,
          and the two are not equals: one is the shape of the catalogue, the
          other is one stove.

          So the median moves into the sentence read BEFORE the shape. The copy
          adds no new number and no new word — `mediana` is already printed on
          the axis three lines down — and it takes no side of the median, which
          is exactly how the struck framing failed. `pctDec()`, never a typed
          string: every number on this object is derived (§0.1), and the day the
          export moves the median this line moves with it.

          NOTHING ELSE MOVES. The bins, the ramp, the axis, the maximum and both
          axis marks are unchanged, and `/brechas` — which passes no `href` —
          renders byte-identically. */}
      <figcaption className={s.head}>
        {href ? (
          <>
            <b className={s.n}>{mil(comparable)}</b> de {mil(gaps.total)} productos se venden en
            más de una cadena{SEP}mediana {pctDec(medianPct)}{' '}
            <span className={s.more}>›</span>
          </>
        ) : (
          <>
            <b className={s.n}>{mil(comparable)}</b> productos que dos o más cadenas venden
          </>
        )}
      </figcaption>

      <ol className={s.bins}>
        {bins.map((b, i) => (
          <li
            key={b.from}
            className={s.bin}
            style={{ '--w': span(b), '--h': `${(b.count / maxCount) * 100}%` } as CSSProperties}
          >
            {/* THE BAND IS ON THE PAINTING NODE, so measure.mjs assertion 27 can
                read the fill and the band off one element. The bar carries no
                text — a count printed inside its own bar is unreadable at 15/124
                and is on §3.4's ban list. */}
            <span className={s.bar} data-gap-band={i} />
            <span className={s.count}>{mil(b.count)}</span>
            <span className={s.band}>
              {b.from === 0 ? 'casi igual' : binLabel(b.from, b.to)}
            </span>
            {b.from === 0 ? (
              <span className={s.sub}>menos de {edge(b.to ?? 0)}%</span>
            ) : null}
          </li>
        ))}
      </ol>

      {/* THE SAME FIVE FACTS, AS A LEGEND, BELOW 768 ONLY — see the stylesheet
          for why the labels move rather than the bars. Each row carries its own
          ramp swatch, so the mapping from colour to band stays explicit on the
          width where the bars cannot hold a word. The two label sets never
          render together. */}
      <ul className={s.legend}>
        {bins.map((b, i) => (
          <li key={b.from} className={s.item}>
            <span className={s.swatch} data-gap-band={i} />
            <span className={s.key}>
              {b.from === 0 ? `casi igual — menos de ${edge(b.to ?? 0)}%` : binLabel(b.from, b.to)}
            </span>
            <span className={s.val}>{mil(b.count)}</span>
          </li>
        ))}
      </ul>

      {/* ---- THE TWO MARKS, ON THE AXIS, BELOW THE BANDS ----
          The median stops being an abstraction and becomes a position; the
          maximum is not an annotation at all, it is the axis's right-hand end
          printed where it actually falls. Both are --ink-3 ticks: they are
          reference marks on a scale, and the sequential register is reserved
          for the size of a gap (§1.4.3 — four values of amber exist and all
          four mean the size of a price gap). */}
      <p className={s.axis}>
        <span
          className={s.mark}
          style={{ '--x': `${(medianPct / axisMaxPct) * 100}%` } as CSSProperties}
        >
          mediana {pctDec(medianPct)}
        </span>
        <span className={`${s.mark} ${s.markEnd}`}>máximo {pct(axisMaxPct, false)}</span>
      </p>
    </figure>
  );

  /* The accessible name is EXPLICIT rather than the figure's whole text content.
     Named by its contents this link reads as "525 de 4.338 productos … 124 91
     119 176 15 casi igual 5–10% … mediana 14,2% máximo 80%" — every number on
     the strip, in a row, as one label. The strip stays in the reading order and
     is read normally; only the link's NAME is the sentence a person would use
     for it. */
  return href ? (
    <Link href={href} className={s.link} aria-label="Ver dónde más varía el precio en Costa Rica">
      {strip}
    </Link>
  ) : (
    strip
  );
}
