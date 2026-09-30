/* PRICE HISTORY — a four-state machine keyed on DISTINCT DAYS (spec §5).

   Rewritten 2026-08-04 from the explicitly-labelled placeholder it used to be.
   Its single `MIN_TREND_DAYS = 7` is replaced by two named constants
   (EVIDENCE_TARGET_DAYS, MIN_CURVE_DAYS) because one constant doing two jobs is
   how the two source design docs came to disagree about the threshold.

   AUTHORITY SCALES WITH EVIDENCE. The size of this block is the depth rule, not a
   fixed slot: at day 1 it is three lines under a hairline; at day 14 it is a
   panel. It never takes hero space with nothing to say.

     state 0  no series    DARK today (2.170/2.170 carry one) — a real guard for a
                           product added between exports, or a chain whose scrape
                           failed.
     state 1  1 day        LIVE — 1.477 of 2.170. A sentence + the evidence meter.
     state 2  2–13 days    LIVE — 693 of 2.170. Points, never a curve.
     state 3  >= 14 days   DARK until the daily collector accumulates days;
                           earliest 2026-08-15 if it runs uninterrupted from
                           08-02. There is no wall-clock check to write — the
                           state machine reads `days` and the right thing happens
                           on the right day.

   NOTHING HERE REACHES THE JSON-LD. A price the site no longer sees is not an
   offer, and publishing it as one would republish a stale price through Google.
   scripts/seo-check.mjs checks that. */

import {
  MIN_CURVE_DAYS, evidenceMeter, historyState, nearOverlap, reading, windowLow,
} from '@/lib/history';
import type { ProductHistory } from '@/lib/types';
import { Clock } from './Mark';
import { PriceChart } from './PriceChart';
import s from './PriceHistory.module.css';

/* The note under every chart, and the thing the chart must never do. The engine's
   own `basis` says the series is never interpolated, smoothed or carried forward,
   so A MISSING DAY MEANS NO OBSERVATION, NOT AN UNCHANGED PRICE. The UI repeats
   that in words rather than relying on the reader to assume it. */
function Note({ days, sparse }: { days: number; sparse: boolean }) {
  if (sparse) {
    return (
      <p className={s.note}>
        Un punto por cadena por día, tomado de la última lectura de ese día.{' '}
        <b>Solo aparecen los días que realmente leímos</b> — un hueco significa que no hubo lectura,
        no que el precio siguió igual. Con {days} días mostramos los puntos y no una línea: unir
        puntos sueltos dibuja una tendencia que todavía no podemos sostener.
      </p>
    );
  }
  return (
    <p className={s.note}>
      Un punto por cadena por día, tomado de la última lectura de ese día. La serie nunca se rellena
      ni se suaviza. <b>El eje vertical no arranca en cero</b> y sus dos extremos están impresos: la
      diferencia entre cadenas suele ser de pocos puntos porcentuales, y en un eje desde cero eso
      sería un pixel.
    </p>
  );
}

export function PriceHistory({
  history, windowDays, demo = false,
}: {
  history?: ProductHistory;
  /** v7 §10.1 — `observation_window.distinct_days`, the number of days the
   *  COLLECTOR has run. The dot meter's denominator, derived rather than
   *  constant: it was hardcoded to 7 while the window was 10, and 92 pages
   *  printed `8 de 7` / `9 de 7`. See lib/history.ts `evidenceMeter`. */
  windowDays?: number | null;
  /** THE `demo` TAG IS A REAL PROP, NOT A COMP ARTEFACT (spec §5.7). If a
   *  projected series ever renders in production it must carry the tag. The only
   *  caller that passes `true` is a story/comp route — never `Detail`. */
  demo?: boolean;
}) {
  const state = historyState(history);
  const { series, days, observations } = state;
  const kicker = (
    <p className={s.k}>
      <Clock size={15} className={s.glyph} />
      Historial de precio{days >= 2 ? ` · ${days} días` : ''}
    </p>
  );

  /* ---- state 0: no series at all. One sentence, no furniture. ---- */
  if (!series.length) {
    return (
      <div className={s.hist}>
        {kicker}
        <div className={s.seedWrap}>
          <p className={s.seed}>Todavía no hay lecturas guardadas de este modelo.</p>
        </div>
      </div>
    );
  }

  /* ---- state 1: one day. The state 68% of products show. ----
     Why this works with one day of data: `observations` is a fact even when
     `days` is not. "We checked six times today and it did not move" is true,
     useful, and available on day one — it tells a shopper this is not a flash
     price about to vanish. */
  /* v4: THE SENTENCE STATE COVERS EVERY REACHABLE DAY COUNT, and the threshold
     moved from `days <= 1` to `days < MIN_CURVE_DAYS` for a structural reason, not
     a cosmetic one.

     Today's artifact has THREE distinct days: 1.477 products at 1 day and 693 at
     2–3. Nothing is at 14+. The old threshold handed the 693 to `PriceChart`,
     which draws SVG `<text>` at `width: 100%` over a fixed viewBox — and that
     makes user-space coordinates a RUBBER SHEET, so a declared `font-size: 12`
     rendered at 4.9 CSS px at 1024 and 23.7px at 767. v4 §2.4 exists because of
     that bug, and its structural rule is that such an SVG may not ship at all.

     `reading()` already composes an honest sentence for 2–13 days ("En 3 días
     ninguna cadena movió el precio", "Monge bajó ₡X en los últimos 3 días"), so
     raising the threshold costs NOTHING and removes the whole defect class:
     PriceChart is now genuinely dormant, exactly as §4.4 describes it, and the day
     the collector reaches 14 days it will have to satisfy §2.4 before it renders.
     A chart with 1–3 points is decoration claiming a maturity we do not have. */
  if (days < MIN_CURVE_DAYS) {
    const r = reading(state);
    /* ONE call, so the dots and the label read the SAME two numbers. The shipped
       defect was exactly a disagreement between them: the label said 9 while the
       row drew 7 dots, because the count and the denominator were derived
       separately (§10.1). */
    const { filled, target } = evidenceMeter(days, windowDays);
    return (
      <div className={s.hist}>
        {kicker}
        <div className={s.seedWrap}>
          <p className={s.seed}>{r.sentence}</p>
          <div className={s.meter}>
            <span className={s.dots} aria-hidden="true">
              {Array.from({ length: target }, (_, i) => (
                <span key={i} className={i < filled ? `${s.dot} ${s.dotOn}` : s.dot} />
              ))}
            </span>
            <span className={s.meterLb}>
              {filled} de {target} días registrados
            </span>
          </div>
        </div>
      </div>
    );
  }

  /* ---- states 2 and 3: the chart. `sparse` is the only switch. ---- */
  const sparse = days < MIN_CURVE_DAYS;
  const r = reading(state);
  const low = windowLow(state); // null below 14 days, by design
  // the annotation fires off the SAME geometric layout the SVG draws (§5.4-4 as
  // amended), so it needs the day count the plot height is derived from
  const warnings = nearOverlap(series, days);

  return (
    <div className={s.hist}>
      {kicker}
      <div className={s.box}>
        {demo ? (
          <span className={s.demo}>Ejemplo ilustrativo — no son nuestros datos</span>
        ) : null}
        <p className={r.kind === 'down' ? `${s.lead} ${s.leadDown}` : s.lead}>
          {low ?? r.sentence}
        </p>
        <div className={s.lg}>
          <PriceChart series={series} sparse={sparse} days={days} />
        </div>
        <div className={s.sm}>
          <PriceChart series={series} sparse={sparse} days={days} small />
        </div>
        <Note days={days} sparse={sparse} />
        {warnings.map((w) => (
          <p className={s.warn} key={w}>
            {w}
          </p>
        ))}
        <p className={s.note}>
          {observations} {observations === 1 ? 'lectura' : 'lecturas'} guardadas en {days} días.
        </p>
      </div>
    </div>
  );
}
