/* THE PRICE CHART — server-rendered SVG, two viewBoxes, no charting library.
   Port of comps-v3/chart.py (spec §5.4).

   NO CLIENT-SIDE CHARTING LIBRARY, NO RUNTIME, NO JS. The SVG is generated on the
   server and is about 2KB. A charting dependency for this would be the lazy-first
   rule failing out loud: nothing here needs one.

   THE FOUR DECISIONS INSIDE IT — all of them consequences of one measurement.
   257 of 2.170 products are comparable at all, their median gap is 9,5%, and 77
   of those 257 sit UNDER the 5% brecha floor. So for roughly a third of
   everything this chart will ever draw, the chains are within a few percent of
   each other and the lines overlap. Two lines nearly touching is the common case,
   not the edge case:

   1. NO HUE PER RETAILER. Eight chains would mean eight colours, a legend, and
      six chromatic families the token set does not have — the rainbow tell. Lines
      separate by WEIGHT + DASH + a DIRECT END LABEL. The chain cheapest on the
      last observed day takes --go, because green already means "the chain to buy
      from" everywhere else; everyone else is --ink-3, dashed.
   2. DIRECT END LABELS, NEVER A LEGEND. A legend forces a colour match. A label
      at the end of the line does not, it survives two lines overlapping, and it
      collapses to 390 without a layout change.
   3. THE AXIS DOES NOT START AT ZERO, AND SAYS SO. On a zero baseline a 3% gap is
      one pixel and the chart is decoration. The y-axis is padded ±16% of the
      observed range and BOTH BOUNDS ARE PRINTED, so the zoom is stated rather
      than hidden. Axis labels carry a --card halo via `paint-order: stroke`, so a
      label is never resolved against a data point that lands under it.
   4. END LABELS ARE DE-COLLIDED IN VIEWBOX UNITS, NOT BY A PRICE PERCENTAGE.
      `endLabels()` in lib/history.ts lays them out and pushes any pair closer
      than one label block apart; a label that moved gets a leader line back to
      its own point. The old 1,5%-price test could not detect the collision it
      existed to prevent, because pixels-per-colón is set by the axis range and
      the axis range is set by the furthest chain — 59 of the 693 charted
      products collided at 1440, 15 of them at exactly 0,00 units. The sentence
      under the chart (`nearOverlap()`) now fires off that same layout, so the
      words and the picture cannot disagree.

   ONE AMBER OBJECT ON THE CHART: today's lowest point. Amber against paper is
   1.68:1, so — exactly as everywhere else in the system — it carries
   --amber-edge and never appears bare.

   TWO SVGs, ONE MODEL. 1440 and 390 are separate renders with their own tick
   density and label sizes, swapped by media query at 767px. A desktop chart
   scaled to 0.55 has 6px axis labels: that is not a mobile chart, it is a desktop
   chart made unreadable. */

import {
  LABEL_SUB, axis, crc, crcAxis, dayShort, endLabels, labelBlock, parseDay, plotBox,
  type Series,
} from '@/lib/history';
import s from './PriceHistory.module.css';

export interface PriceChartProps {
  series: Series;
  /** 2–13 days: points only, never a curve between them */
  sparse: boolean;
  /** the 390 rendering — fewer ticks, smaller labels, narrower label gutter */
  small?: boolean;
  /** total distinct days, which decides the plot height */
  days: number;
}

export function PriceChart({ series, sparse, small = false, days }: PriceChartProps) {
  const w = small ? 330 : 640;
  const box = plotBox(days, small);
  const h = box.h;
  const padL = 8;
  const padR = small ? 76 : 96;
  const padT = box.top;
  const padB = 26;
  const inset = 22; // keeps the first point clear of the y-axis label
  const iw = w - padL - padR - inset;
  const ih = box.height;

  const pts = series.map(([r, sr]) => [r, sr.map(([d, p]) => [parseDay(d), p] as const)] as const);
  const allD = [...new Set(pts.flatMap(([, sr]) => sr.map(([d]) => d.getTime())))].sort(
    (a, b) => a - b,
  );
  const d0 = allD[0];
  const d1 = allD[allD.length - 1];
  const DAY = 86_400_000;
  const span = Math.max(Math.round((d1 - d0) / DAY), 1);
  // the padded axis comes from lib/history so the label layout, the sentence and
  // the drawing all read one axis
  const { loA, hiA } = axis(series);

  const X = (t: number) => padL + inset + ((t - d0) / DAY / span) * iw;
  const Y = (p: number) => padT + ih - ((p - loA) / (hiA - loA)) * ih;

  // cheapest on the LAST OBSERVED DAY leads; everyone else recedes
  const last = new Map(pts.filter(([, sr]) => sr.length).map(([r, sr]) => [r, sr[sr.length - 1][1]]));
  let lead: string | null = null;
  for (const [r, v] of last) if (lead === null || v < (last.get(lead) as number)) lead = r;

  const fs = small ? 10 : 11;
  const fsl = small ? 11 : 12;

  /* three gridlines, labelled at the LEFT edge inside the plot so the right side
     stays free for the direct labels.

     THE AXIS LABELS ARE A SEPARATE LIST BECAUSE THEY PAINT LAST. The --card halo
     (`paint-order: stroke`) exists precisely so a label is never resolved
     against a data point that lands under it — but it was drawn FIRST, so the
     first day's points at x=30 painted straight over the halo of the lower bound
     label, whose box runs x 10..44,7 (measured). The halo could not do the job
     it was added for. Paint order, not geometry: no plot width is spent, and the
     first tick keeps its position. */
  const grid: React.ReactNode[] = [];
  const axisLabels: React.ReactNode[] = [];
  ([[0, hiA], [0.5, (hiA + loA) / 2], [1, loA]] as const).forEach(([frac, val], i) => {
    const y = padT + frac * ih;
    grid.push(
      <line key={`g${i}`} x1={padL} y1={y} x2={padL + inset + iw} y2={y} stroke="var(--line)" strokeWidth={1} />,
    );
    if (frac === 0 || frac === 1) {
      axisLabels.push(
        <text
          key={`gl${i}`}
          x={padL + 2}
          y={y - 4}
          fontSize={fs}
          fill="var(--ink-2)"
          fontFamily="var(--display)"
          stroke="var(--card)"
          strokeWidth={3}
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          {crcAxis(val)}
        </text>,
      );
    }
  });

  // x ticks
  const nTicks = Math.min(small ? 3 : 5, span + 1);
  const ticks: React.ReactNode[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < nTicks; i += 1) {
    const t = d0 + Math.round((span * i) / Math.max(nTicks - 1, 1)) * DAY;
    if (seen.has(t)) continue;
    seen.add(t);
    const anchor = i === 0 ? 'start' : i === nTicks - 1 ? 'end' : 'middle';
    ticks.push(
      <text
        key={`t${t}`}
        x={X(t)}
        y={h - 8}
        fontSize={fs}
        fill="var(--ink-2)"
        textAnchor={anchor}
        fontFamily="var(--display)"
      >
        {dayShort(new Date(t))}
      </text>,
    );
  }

  /* THE END LABELS, LAID OUT AND DE-COLLIDED (spec §5.4-4 as amended).
     Try it with the price sub-lines; if that stack cannot fit inside the plot —
     which needs more chains on one chart than this artifact currently produces,
     but eight retailers exist and only five have ever charted together — drop
     the sub-lines rather than print two labels in the same place. The prices are
     not lost: they are in the sentence above the chart and in the ledger below
     it. Collapsing to the annotation is the designer's own option (b), narrowed. */
  const minTy = fsl + 2; // the highest baseline whose cap still clears y=0
  let withPrice = true;
  let ends = endLabels(series, box, labelBlock(fsl, true), minTy);
  if (ends.length && ends[0].crowded) {
    withPrice = false;
    ends = endLabels(series, box, labelBlock(fsl, false), minTy);
  }
  const endAt = new Map(ends.map((e) => [e.r, e]));

  const lines: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  for (const [r, sr] of pts) {
    if (!sr.length) continue;
    const isLead = r === lead;
    const stroke = isLead ? 'var(--go)' : 'var(--ink-3)';
    if (!sparse && sr.length > 1) {
      const d = sr
        .map(([dt, p], i) => `${i === 0 ? 'M' : 'L'}${X(dt.getTime()).toFixed(1)} ${Y(p).toFixed(1)}`)
        .join(' ');
      lines.push(
        <path
          key={`p${r}`}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={isLead ? 2 : 1.25}
          strokeLinejoin="round"
          strokeDasharray={isLead ? undefined : '4 3'}
        />,
      );
    }
    for (const [dt, p] of sr) {
      lines.push(
        <circle
          key={`c${r}${dt.getTime()}`}
          cx={X(dt.getTime())}
          cy={Y(p)}
          r={isLead ? 2.6 : 2}
          fill={stroke}
        />,
      );
    }
    const [ld] = sr[sr.length - 1];
    const e = endAt.get(r)!;
    const lx = X(ld.getTime()) + 8;
    // a displaced label is no longer beside its own line, so it says which line
    // it belongs to — 1px --ink-3, which is non-text and therefore correct here
    if (e.moved) {
      labels.push(
        <line
          key={`ld${r}`}
          x1={X(ld.getTime()) + 3.5}
          y1={e.py}
          x2={lx - 2}
          y2={e.ty - fsl * 0.35}
          stroke="var(--ink-3)"
          strokeWidth={1}
        />,
      );
    }
    labels.push(
      <text
        key={`n${r}`}
        x={lx}
        y={e.ty}
        fontSize={fsl}
        fontFamily="var(--display)"
        fontWeight={isLead ? 600 : 500}
        fill={isLead ? 'var(--ink)' : 'var(--ink-2)'}
      >
        {r}
      </text>,
    );
    if (withPrice) {
      labels.push(
        <text
          key={`v${r}`}
          x={lx}
          y={e.ty + LABEL_SUB}
          fontSize={fs}
          fontFamily="var(--display)"
          fill="var(--ink-2)"
        >
          {crc(e.price)}
        </text>,
      );
    }
  }

  // the one amber object on the chart: today's lowest point, with its edge
  let marker: React.ReactNode = null;
  if (lead !== null) {
    const sr = pts.find(([r]) => r === lead)![1];
    const [ld, lp] = sr[sr.length - 1];
    marker = (
      <circle
        cx={X(ld.getTime())}
        cy={Y(lp)}
        r={5.5}
        fill="var(--loud)"
        stroke="var(--loud-edge)"
        strokeWidth={1.5}
      />
    );
  }

  return (
    <svg
      className={s.svg}
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      role="img"
      aria-label="Precio por cadena a lo largo del tiempo. Los valores están escritos en la frase de arriba y al final de cada línea."
    >
      {grid}
      {ticks}
      {lines}
      {marker}
      {/* text last, so the --card halo on the axis labels can actually resolve
          them against the points that land under them (N-12) */}
      {labels}
      {axisLabels}
    </svg>
  );
}
