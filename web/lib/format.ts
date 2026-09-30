/* es-CR formatting. Hand-rolled, not Intl: the output has to be byte-identical
   between the Node prerender and the browser (hydration), and ICU builds differ.
   CR has no DST, so the UTC-6 shift is safe arithmetic.

   Ported from comps-v2/common.py + f.py so the built app prints exactly what the
   comps printed. */

import type { Enriched, Offer } from './types';

const dots = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const commas = (n: string) => n.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** ₡1.699.900 — U+20A1, dot thousands, no decimals. Never a bare $. */
export const crc = (n: number) => `₡${dots(n)}`;

/** US$1,999.99 — explicit prefix, comma thousands, CENTS KEPT. Rounding to the
 *  dollar turns a real US$2,399.99 into US$2,400, which is a different claim. */
export function usd(n: number): string {
  const whole = Math.abs(n - Math.round(n)) < 1e-9;
  if (whole) return `US$${commas(String(Math.round(n)))}`;
  const [i, d] = n.toFixed(2).split('.');
  return `US$${commas(i)}.${d}`;
}

/** US range, collapsed when both ends are the same figure. */
export const usdRange = (min: number, max: number) =>
  usd(min) === usd(max) ? usd(min) : `${usd(min)} – ${usd(max)}`;

/** 1.537 — plain integer with Spanish dot thousands (review counts). */
export const mil = (n: number) => dots(n);

/** Spanish decimal comma: 24.7 → "24,7" */
export const dec = (n: number, places = 1) => n.toFixed(places).replace('.', ',');

/** +48% / −10% — U+2212 minus, never a hyphen. */
export function pct(n: number, sign = true): string {
  const s = sign && n > 0 ? '+' : '';
  return `${s}${Math.round(n)}%`.replace('-', '−');
}

/** "EE. UU." — the space inside is U+00A0 and the span carries nowrap, so the
 *  abbreviation can never split across lines. One const, no raw literals. */
export const EEUU_TEXT = 'EE. UU.';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function crParts(iso: string) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t - 6 * 3_600_000);
  let h = d.getUTCHours();
  const ap = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12 || 12;
  return {
    d: d.getUTCDate(),
    m: MESES[d.getUTCMonth()],
    y: d.getUTCFullYear(),
    hm: `${h}:${String(d.getUTCMinutes()).padStart(2, '0')} ${ap}`,
    t,
  };
}

/** "3 ago 2026, 1:30 p. m." in Costa Rica time. */
export function fecha(iso: string): string {
  const p = crParts(iso);
  return p ? `${p.d} ${p.m} ${p.y}, ${p.hm}` : '';
}

/** "3 ago 2026" — the same stamp without the time of day. Exists because a meta
 *  description has a hard character budget and the minute is the least valuable
 *  thing in it: nobody choosing a search result cares that we read the price at
 *  6:25 rather than 6:26, and those six characters can be the difference between
 *  a visible date and a truncated one. Composed from `crParts` like `fecha`, not
 *  sliced off `fecha`'s output — a caller splitting on the comma would silently
 *  produce the wrong string the day that format changes. */
export function fechaDia(iso: string): string {
  const p = crParts(iso);
  return p ? `${p.d} ${p.m} ${p.y}` : '';
}

/** "1:30 p. m." — the short freshness stamp in the top bar. */
export function hora(iso: string): string {
  const p = crParts(iso);
  return p ? p.hm : '';
}

/** "3 de agosto" — long-form day for the trust band. */
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function diaLargo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t - 6 * 3_600_000);
  return `${d.getUTCDate()} de ${MESES_LARGOS[d.getUTCMonth()]}`;
}

export const DAY_MS = 24 * 3_600_000;
export const STALE_MS = 48 * 3_600_000;

/** Three tiers, and the middle one is the whole point: 121 of the 791 offers in
 *  this artifact are over 24 h old, so a stamp with only a 48 h tier prints
 *  "verificado" over all of them.
 *
 *  `now` is the ARTIFACT's export time, never the wall clock. A statically
 *  generated product page would otherwise freeze a wall-clock verdict at build
 *  time and keep asserting it for as long as the page is served — and the
 *  in-app overlay would disagree with the page it shares a URL with. */
export function priceAge(iso: string, now: number): 'fresh' | 'day' | 'stale' {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'stale';
  const age = now - t;
  if (age > STALE_MS) return 'stale';
  return age > DAY_MS ? 'day' : 'fresh';
}

export const AGE_LABEL: Record<'fresh' | 'day' | 'stale', string> = {
  fresh: 'Precio verificado: ',
  day: 'Precio de hace más de 24 h: ',
  stale: 'Precio con más de 48 h: ',
};

/* ==========================================================================
   ONE function owns the direction of every comparison. Sign and noun are never
   composed independently — that is how a "−10% más caro" ships, and a product
   whose whole premise is not misstating prices cannot do that once.
   ========================================================================== */

export interface Savings {
  verb: string;
  amount: string;
  prep: string;
  chain: string;
  line: string;
  /** `−₡84.000` — U+2212, the v4 `best` slot's signed form (spec §T3 `best`).
   *  The SIGN is composed HERE, inside the one function that asserts the
   *  direction, and never at a call site: a surface that builds its own minus is
   *  one edit away from printing "−10% más caro". */
  delta: string;
}

/** (verb, amount, preposition, chain) for a real price gap. Throws rather than
 *  branching on a negative, so there is no wrong-direction path to get wrong. */
export function savings(p: Enriched): Savings {
  if (!(p.gapCrc > 0)) throw new Error('savings() is only for products with a real gap');
  const chain = p.lo.retailer;
  return {
    verb: 'Ahorre',
    amount: crc(p.gapCrc),
    prep: 'en',
    chain,
    line: `Ahorre ${crc(p.gapCrc)} en ${chain}`,
    delta: `−${crc(p.gapCrc)}`,
  };
}

/** The US-reference chip. A negative markup means Costa Rica is CHEAPER, so
 *  the number, the words AND the colour flip together — they are one object,
 *  returned by one function, and there is no way to compose them apart. */
export interface MarkupChip {
  figure: string;
  words: string;
  cheaper: boolean;
}

export function markupChip(m: number): MarkupChip {
  if (m < 0) {
    return { figure: `${Math.round(Math.abs(m))}%`, words: 'más barato en Costa Rica', cheaper: true };
  }
  return { figure: `+${Math.round(m)}%`, words: 'más caro en Costa Rica', cheaper: false };
}

/* Colour variants. Where a retailer lists one SKU per colour the engine folds
   them into a single offer and `price_crc` becomes the CHEAPEST of them. If the
   variants do not all cost the same, showing that one figure alone would be
   presenting a "from" price as the price — so the figure gets a "desde" and the
   spread is named. One function decides it, so no surface can forget. */
export interface VariantNote {
  desde: boolean;
  text: string | null;
}

export function variantNote(o: Offer): VariantNote {
  if (!o.variant_count || o.variant_count <= 1) return { desde: false, text: null };
  if (o.variant_price_max_crc && o.variant_price_max_crc > o.price_crc) {
    return {
      desde: true,
      text: `${o.variant_count} versiones, de ${crc(o.price_crc)} a ${crc(o.variant_price_max_crc)}`,
    };
  }
  return { desde: false, text: `${o.variant_count} versiones al mismo precio` };
}

/** "12 cuotas de ₡25.826 · total ₡309.912" or the honest absence. */
export function cuotas(o: Offer): string {
  if (!o.credit) return 'Sin plan de cuotas publicado';
  const c = o.credit;
  // `\u00A0·\u00A0`: the separator is glued to both neighbours, so the only
  // break points left are real word boundaries and the `·` can never end or
  // start a line. At 390 this string is 225px in a 157px cell, so it DOES wrap.
  return `${c.months} cuotas de ${crc(c.monthly_crc)} · total ${crc(c.total_crc)}`;
}
