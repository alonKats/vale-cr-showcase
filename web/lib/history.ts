/* THE PRICE-HISTORY MODEL — the state key, and the four derived sentences.
   Port of comps-v3/chart.py `reading()` / `window_low()` / `near_overlap()`
   (spec §5.2, §5.5).

   THE STATE KEY IS DISTINCT DAYS ACROSS ALL CHAINS (THE UNION), NEVER OBSERVATION
   COUNT. `{observations: 8, days: 1}` is a real record in this artifact, and
   reading the 8 is how a single Tuesday gets published as a week of history. Two
   chains read on the same day are ONE day of history, not two.

   Posture (spec §5.1): a competitor already publishes a 19-day price table. We
   have three days. History is not an unclaimed differentiator and is not designed
   as one — at our data volume A SENTENCE BEATS A CHART, AND THE CHART IS WHAT THE
   SENTENCE BECOMES. */

import { crc as crcFmt } from './format';
import type { ProductHistory } from './types';

/** [retailer, [[isoDay, price], …]] — sorted ascending by day. */
export type Series = [string, [string, number][]][];

/* ---- two named constants, replacing PriceHistory's single MIN_TREND_DAYS = 7.
   One constant doing two jobs is exactly how the two source docs came to
   disagree about the threshold (spec §9-5). ---- */

/* ==========================================================================
   v7 §10.1 — `9 de 7 días registrados`. THE DENOMINATOR IS THE OBSERVATION
   WINDOW, DERIVED. IT WAS A CONSTANT, AND THE CONSTANT WENT STALE.

   `EVIDENCE_TARGET_DAYS = 7` was the dot meter's denominator: a legible "come
   back tomorrow" target, correct on the day it was written, when the collector
   had run for three days. The collector then kept running. On 2026-08-11 the
   window is TEN distinct days (2026-08-02 → 2026-08-11, `history.json
   observation_window.distinct_days`) and the numerator is a real count of days
   we actually watched — so 92 of 4.338 product pages (2,1%) printed a fraction
   whose numerator exceeds its denominator: 84 rendered `8 de 7` and 8 rendered
   `9 de 7`, above SEVEN filled dots, on a product whose entire proposition is
   that its numbers are careful. Confirmed live on samsung-6c30fe32 and
   apple-518823e7.

   AND 10 IS NOT THE FIX EITHER. Replacing 7 with 10 buys eleven days and
   reintroduces the identical defect on 2026-08-22. The denominator is not a
   number, it is a QUESTION — *how much of the window we watched* (§3.1 axis 2)
   — so it is read off the window the artifact publishes, on every render, and
   the meter is unable to express an impossible state at any future date.

   The numerator is clamped to the window as well. It cannot exceed it today
   (`days` is a product's slice of the same union the window counts), so the
   clamp guards a shape change in the artifact rather than a live defect — which
   is the only kind of guard worth writing for a fraction that has already been
   wrong once in public.
   ========================================================================== */

/** Fallback ONLY — used when no window is passed (an export older than the
 *  `observation_window` field, or a caller that has no artifact). It is the
 *  historical value, kept so the meter degrades to its old behaviour rather
 *  than to `de 0`. Never read directly by a component. */
const EVIDENCE_FALLBACK_DAYS = 7;

/** The dot meter's denominator and numerator, derived from the artifact's own
 *  observation window. One function, so the label and the dot count cannot
 *  disagree — the shipped defect printed 9 against 7 dots, which is the two
 *  reading different numbers. */
export function evidenceMeter(days: number, windowDays?: number | null) {
  const target = windowDays && windowDays > 0 ? windowDays : EVIDENCE_FALLBACK_DAYS;
  return { filled: Math.min(days, target), target };
}

/** THE ONLY RENDERING THRESHOLD. 14, because 14 is where "is this a good time to
 *  buy" starts having an answer, and because `windowLow()` refuses to compute
 *  below it. */
export const MIN_CURVE_DAYS = 14;

export const crc = crcFmt;

/** Axis labels only — ₡1,7 M / ₡380 mil. NEVER used for a real price: a rounded
 *  figure is a different claim from the price a chain actually publishes. */
export function crcAxis(n: number): string {
  if (n >= 1_000_000) return `₡${(n / 1_000_000).toFixed(1).replace('.', ',')} M`;
  return `₡${Math.round(n / 1000)} mil`;
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

/** A `YYYY-MM-DD` day, parsed as a LOCAL calendar date. `new Date(iso)` would
 *  make it midnight UTC and shift the label a day west of Costa Rica. */
export const parseDay = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

export const dayShort = (d: Date): string => `${d.getDate()} ${MES[d.getMonth()]}`;

export const dayShortIso = (day: string): string => dayShort(parseDay(day));

export interface HistoryState {
  series: Series;
  /** distinct calendar days across the union of chains */
  days: number;
  /** how many times a price was READ. A fact even when `days` is not. */
  observations: number;
  sortedDays: string[];
}

/** Reads one product's slice of history.json into the shape everything else
 *  consumes. Chains with an empty series are dropped here so no downstream
 *  branch has to test for them. */
export function historyState(history?: ProductHistory): HistoryState {
  const series: Series = Object.entries(history ?? {})
    .filter(([, v]) => v.points.length > 0)
    .map(([r, v]) => [r, [...v.points].sort((a, b) => a[0].localeCompare(b[0]))]);

  const all = new Set<string>();
  for (const [, sr] of series) for (const [d] of sr) all.add(d);

  const observations = Object.values(history ?? {}).reduce((n, v) => n + v.observations, 0);

  return { series, days: all.size, observations, sortedDays: [...all].sort() };
}

/** The day this product's page last changed IN SUBSTANCE — the most recent day a
 *  chain moved its price by more than the rounding floor. `null` when no move has
 *  ever been observed.
 *
 *  THIS EXISTS BECAUSE `scraped_at` ANSWERS THE WRONG QUESTION, and the sitemap
 *  asked it for months. `scraped_at` is when we last LOOKED; the collector runs
 *  daily, so it is today for every product, on every product, forever. Feeding it
 *  to `<lastmod>` told Google that all 4.543 URLs changed at the same instant
 *  every single day — measured 2026-08-09, every URL in the published sitemap
 *  carried the identical stamp. Google documents that it ignores `lastmod` on a
 *  site whose values it finds unreliable, and "everything changed at once, daily"
 *  is the textbook unreliable pattern. So the field was not merely uninformative,
 *  it was actively spending the credibility of the one signal that tells a crawler
 *  WHICH of 4.543 pages is worth re-fetching today. The real answer is 306 of
 *  4.346 (7%) — a number the crawler can act on.
 *
 *  MOVE_FLOOR_CRC IS SHARED WITH `reading()` DELIBERATELY. If the sitemap called a
 *  ₡200 drift a change while the page told the reader nothing moved, we would be
 *  inviting a crawl to see content we had already said was unchanged. One
 *  definition of "the price moved", used by both. */
export function lastPriceChange(history?: ProductHistory): string | null {
  let latest: string | null = null;
  for (const [, sr] of historyState(history).series) {
    for (let i = 1; i < sr.length; i += 1) {
      if (Math.abs(sr[i][1] - sr[i - 1][1]) < MOVE_FLOOR_CRC) continue;
      if (!latest || sr[i][0] > latest) latest = sr[i][0];
    }
  }
  return latest;
}

export type ReadingKind = 'none' | 'day1' | 'flat' | 'up' | 'down';

export interface Reading {
  kind: ReadingKind;
  sentence: string;
}

/** A price move small enough to be a rounding artefact is not a move. */
const MOVE_FLOOR_CRC = 1000;

/** THE DERIVED SENTENCE — honest with far less data than a chart needs. A
 *  sentence can be true at two observations; a trend line cannot. This is the
 *  part that ships on day one. */
export function reading({ series, days, observations }: HistoryState): Reading {
  const last = series.filter(([, sr]) => sr.length).map(([r, sr]) => [r, sr[sr.length - 1][1]] as const);
  if (!last.length) {
    return { kind: 'none', sentence: 'Todavía no hay lecturas guardadas de este modelo.' };
  }
  const lead = last.reduce((a, b) => (b[1] < a[1] ? b : a));

  if (days <= 1) {
    return {
      kind: 'day1',
      sentence:
        `Hoy es el primer día que guardamos el precio de este modelo. Lo leímos ${observations} ` +
        `veces y no se movió: ${crc(lead[1])} en ${lead[0]}. Desde mañana verá si sube o baja.`,
    };
  }

  const moved = series
    .filter(([, sr]) => sr.length >= 2)
    .map(([r, sr]) => ({ r, delta: sr[sr.length - 1][1] - sr[0][1], was: sr[0][1], now: sr[sr.length - 1][1] }))
    .filter((m) => Math.abs(m.delta) >= MOVE_FLOOR_CRC)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  if (!moved.length) {
    return {
      kind: 'flat',
      sentence:
        `En ${days} días de registro ninguna cadena movió el precio. ` +
        `Sigue en ${crc(lead[1])} en ${lead[0]}.`,
    };
  }

  const m = moved[0];
  return {
    kind: m.delta > 0 ? 'up' : 'down',
    sentence:
      `${m.r} ${m.delta > 0 ? 'subió' : 'bajó'} ${crc(Math.abs(m.delta))} en los últimos ` +
      `${days} días — de ${crc(m.was)} a ${crc(m.now)}.`,
  };
}

/** "el más bajo de los últimos N días" — only claimable once N is real.
 *  RETURNS NULL BELOW 14 DAYS. DO NOT REMOVE THAT GUARD (spec §5.5). */
export function windowLow({ series, days }: HistoryState): string | null {
  if (days < MIN_CURVE_DAYS) return null;
  const all = series.flatMap(([r, sr]) => sr.map(([d, p]) => ({ p, r, d })));
  if (!all.length) return null;
  const low = all.reduce((a, b) => (b.p < a.p ? b : a));
  const now = Math.min(...series.filter(([, sr]) => sr.length).map(([, sr]) => sr[sr.length - 1][1]));
  if (now <= low.p) return `Hoy está en el precio más bajo de los últimos ${days} días.`;
  return (
    `El más bajo de los últimos ${days} días fue ${crc(low.p)} en ${low.r}, el ` +
    `${dayShortIso(low.d)}. Hoy está ${crc(now - low.p)} por encima.`
  );
}

/* ==========================================================================
   THE END-LABEL LAYOUT — and why it is not a percentage (spec §5.4-2/-4,
   AMENDED 2026-08-04 after the designer's v3 gate, B-1).

   THE COLLISION CONDITION IS PIXELS. IT CANNOT BE A PRICE PERCENTAGE, EVER.
   The previous test fired at a 1,5% price difference, which is a test of the
   wrong quantity: pixels-per-colón is set by the y-axis range, and the y-axis
   range is set by whichever chain is furthest away. On
   /producto/samsung-rf29db965012ap, Gollo at +53% stretches the axis over a
   ₡1,1 M range, so Monge and Unimart — 3,0% apart, correctly not flagged —
   printed 4,90 viewBox units apart at font-size 12 and overlapped by ~7px. The
   old test could not have caught it and no amount of tuning the 1,5% would
   have: the threshold has no access to the axis.

   Measured across the whole artifact rather than the one page: of the 693
   products with 2+ days of history, 59 have two end labels closer than one
   label block at 1440, and 15 of those are exactly 0,00 units apart — the same
   price, printed twice in the same place. Structural, not an edge case.

   So the labels are LAID OUT, in viewBox units, by one function that both the
   SVG and the sentence under it read. A label that had to move says so with a
   leader line to its own point, and the sentence names the pair. They cannot
   disagree, because there is one layout.
   ========================================================================== */

/** The y-axis is padded by this fraction of the observed range at each end, and
 *  BOTH BOUNDS ARE PRINTED. Exported because the label layout needs the same
 *  axis the chart draws (§5.4-3). */
export const AXIS_PAD = 0.16;

/** the padded axis the chart will actually draw */
export function axis(series: Series): { loA: number; hiA: number } {
  const all = series.flatMap(([, sr]) => sr.map(([, p]) => p));
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const rng = Math.max(hi - lo, 1);
  return { loA: lo - rng * AXIS_PAD, hiA: hi + rng * AXIS_PAD };
}

/** the plot box, per rendering. One function so the sentence and the picture
 *  measure the same box — the height grows with `days` and the threshold has to
 *  grow with it. */
export function plotBox(days: number, small = false) {
  const h = (small ? 162 : 156) + (days < 5 ? 0 : small ? 58 : 54);
  return { h, top: 16, height: h - 16 - 26 };
}

/** the price baseline sits this far below the chain-name baseline */
export const LABEL_SUB = 13;

/** The vertical space one end label needs: its own cap height plus, when it
 *  carries a price sub-line, that line too. The name-only variant gets more
 *  leading (4 vs 2), because it is the CROWDED case — it only ever renders when
 *  five or more chains are stacked, and that is exactly when the labels need the
 *  air rather than less of it. */
export const labelBlock = (fsl: number, withPrice: boolean) =>
  (withPrice ? LABEL_SUB + fsl + 2 : fsl + 4);

export interface EndLabel {
  r: string;
  price: number;
  /** the data point's y — where the leader line starts and the dot is drawn */
  py: number;
  /** the chain name's baseline, after de-collision */
  ty: number;
  /** true when `ty` is no longer at the point, i.e. this label needs a leader */
  moved: boolean;
  /** the de-collided stack does not fit the plot even after sliding */
  crowded: boolean;
}

/** Places the end labels and DE-COLLIDES them geometrically: any label closer
 *  than one block to the one above is pushed down to exactly one block, then the
 *  whole stack slides back inside the plot if it now hangs out of it.
 *
 *  `minTy` is the highest baseline whose cap still fits inside the SVG canvas.
 *  It is the CANVAS edge, not the plot edge, on purpose: the padding band above
 *  the plot is free real estate for a displaced label, because the only other
 *  thing up there is the upper axis label and that sits at x≈10 while these sit
 *  at x≈552. Testing against the plot instead made a 3-chain chart report itself
 *  as crowded and needlessly drop its prices. */
export function endLabels(
  series: Series,
  { top, height }: { top: number; height: number },
  block: number,
  minTy = 0,
): EndLabel[] {
  const { loA, hiA } = axis(series);
  const Y = (p: number) => top + height - ((p - loA) / (hiA - loA)) * height;

  const out: EndLabel[] = series
    .filter(([, sr]) => sr.length)
    .map(([r, sr]) => {
      const price = sr[sr.length - 1][1];
      const py = Y(price);
      return { r, price, py, ty: py + 4, moved: false, crowded: false };
    })
    .sort((a, b) => a.py - b.py);

  for (let i = 1; i < out.length; i += 1) {
    if (out[i].ty - out[i - 1].ty < block) out[i].ty = out[i - 1].ty + block;
  }
  // the stack may now hang below the plot; slide all of it up by the overhang
  const last = out[out.length - 1];
  const over = last ? last.ty + LABEL_SUB - (top + height + 10) : 0;
  if (over > 0) for (const e of out) e.ty -= over;
  // …and it may not fit at all, which the caller answers by dropping the price
  // sub-lines rather than by printing two labels on top of each other
  const crowded = Boolean(out.length) && out[0].ty < minTy;
  for (const e of out) {
    e.moved = Math.abs(e.ty - (e.py + 4)) > 0.5;
    e.crowded = crowded;
  }
  return out;
}

/** NEAR-OVERLAP IS ANNOTATED, NOT FAKED — and the trigger is the SAME geometric
 *  test the layout above uses, at the 1440 rendering. When two lines end close
 *  enough that their labels had to be separated by force, the sentence says so
 *  and prints the number, because the picture no longer shows it truthfully on
 *  its own. */
export function nearOverlap(series: Series, days: number): string[] {
  const box = plotBox(days);
  const { loA, hiA } = axis(series);
  const perUnit = (hiA - loA) / box.height; // colones per viewBox unit
  const block = labelBlock(12, true); // the 1440 label block

  const last = series
    .filter(([, sr]) => sr.length)
    .map(([r, sr]) => [sr[sr.length - 1][1], r] as const)
    .sort((a, b) => a[0] - b[0]);

  const out: string[] = [];
  for (let i = 0; i + 1 < last.length; i += 1) {
    const [p1, r1] = last[i];
    const [p2, r2] = last[i + 1];
    if ((p2 - p1) / perUnit >= block) continue;
    out.push(
      p2 === p1
        ? `${r1} y ${r2} terminan en el mismo precio, ${crc(p1)} — en el gráfico sus dos puntos caen uno sobre el otro, así que separamos las etiquetas.`
        : `${r1} y ${r2} terminan a ${crc(p2 - p1)} de diferencia — en el gráfico sus dos líneas casi se tocan, así que separamos las etiquetas.`,
    );
  }
  return out;
}
