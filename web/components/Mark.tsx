/* CATEGORY MARK SYSTEM — one component, two renderings, one rule for growth.
   Port of comps-v3/icons.py (spec §4.2).

   Categories are engine config (categories.json). There are six today; there
   will be a seventh, and that must not be a design ticket. So the mark is a
   SYSTEM with a fallback, not six drawings:

     1. AUTHORED GLYPH — composed from a closed vocabulary of FIVE primitives on
        a 24×24 grid: BOX, DISC, BAR, STAND, DIVIDER (the last two are BAR with
        intent). 1.5px stroke, currentColor, square caps, no fills, max 6
        elements, minimum 2px between elements. A new category is COMPOSED from
        these primitives. It is never illustrated.

     2. TYPOGRAPHIC MARK — the automatic fallback. No authored glyph? The mark
        renders the label's first two letters in Space Grotesk 600, optically
        centred in the same 24px box. A category added to the engine config on a
        Tuesday ships on a Tuesday looking deliberate.

   Two rules that keep it from rotting:
     · NEVER BRANCH ON WHICH ONE YOU GOT. `Mark` returns a valid SVG for any
       input; callers never test for a glyph.
     · MARKS ARE NEVER COLOURED PER CATEGORY. currentColor only — --ink-2 at
       rest, --paper when the chip is selected. A rainbow taxonomy is the
       fastest way to make a catalogue look like a template and it encodes
       nothing.

   This is the same pattern the product already uses for a product with no
   photograph (the brand-initial tile), applied one level up. Consistency, not a
   new invention. */

const S = {
  stroke: 'currentColor',
  strokeWidth: 1.5,
  fill: 'none',
  strokeLinecap: 'square',
} as const;

/* ---- the five primitives ------------------------------------------------- */
const BOX = (x: number, y: number, w: number, h: number, r = 1) => (
  <rect key={`b${x}${y}${w}${h}`} x={x} y={y} width={w} height={h} rx={r} {...S} />
);
const DISC = (cx: number, cy: number, r: number) => (
  <circle key={`d${cx}${cy}${r}`} cx={cx} cy={cy} r={r} {...S} />
);
const BAR = (x1: number, y1: number, x2: number, y2: number) => (
  <line key={`l${x1}${y1}${x2}${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} {...S} />
);
/* BAR with intent. Same primitive, named for what it means in a composition. */
const DIVIDER = BAR;
const STAND = BAR;

/* ---- authored glyphs: composed from the primitives, nothing else --------- */
const GLYPHS: Record<string, () => React.ReactNode[]> = {
  // cabinet + a divider where the freezer splits + two handles
  refrigeradoras: () => [
    BOX(6, 3, 12, 18), DIVIDER(6, 9.5, 18, 9.5), BAR(15, 5.5, 15, 7.5), BAR(15, 12, 15, 15),
  ],
  // cabinet + drum + two controls
  lavadoras: () => [
    BOX(4, 3, 16, 18), DISC(12, 14, 4), BAR(7, 6.5, 8.5, 6.5), BAR(10.5, 6.5, 12, 6.5),
  ],
  // hob with four burners
  cocinas: () => [
    BOX(4, 4, 16, 16), DISC(9, 9, 1.6), DISC(15, 9, 1.6), DISC(9, 15, 1.6), DISC(15, 15, 1.6),
  ],
  // wide panel + stand
  pantallas: () => [BOX(3, 5, 18, 12), STAND(9, 20, 15, 20), STAND(12, 17, 12, 20)],
  // panel + a wider base bar (the hinge is the gap, not a line)
  laptops: () => [BOX(5, 5, 14, 10), BAR(3, 18.5, 21, 18.5)],
  // tall rounded box + speaker bar
  celulares: () => [BOX(7.5, 2.5, 9, 19, 2), BAR(10.5, 6, 13.5, 6)],
};

/** The automatic fallback for any category nobody has drawn yet. */
const letters = (label: string) => [
  <text
    key="t"
    x={12}
    y={12}
    textAnchor="middle"
    dominantBaseline="central"
    fontFamily="var(--display)"
    fontSize={11}
    fontWeight={600}
    letterSpacing="-0.02em"
    fill="currentColor"
  >
    {(label || '?').slice(0, 2).toUpperCase()}
  </text>,
];

export interface MarkProps {
  /** the engine's category id — `stats.cats[].id`, never typed by hand */
  id: string;
  /** the engine's label, used only by the typographic fallback */
  label: string;
  /** 24 is the token box; the rail uses 18 and a row glyph uses 15 */
  size?: number;
  className?: string;
}

/** The only entry point. Authored glyph if one exists, typographic mark if not.
 *  Same 24px viewBox, same currentColor, same stroke weight, either way. */
export function Mark({ id, label, size = 24, className }: MarkProps) {
  const body = (GLYPHS[id] ?? (() => letters(label)))();
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {body}
    </svg>
  );
}

/* ---- the other glyphs in the product ------------------------------------
   Not category marks, and they live here rather than in ui.tsx because they are
   built from the same five stroke primitives — a second copy of BOX/DISC/BAR
   next door is exactly the duplication spec §2.1 calls a collision. ui.tsx
   re-exports `Pin` so callers still reach it through the primitives module.

   They exist because deleting the third chromatic (--near teal) means a pin and
   a clock now carry meanings a colour used to carry. */

export const Pin = ({ size = 24, className }: { size?: number; className?: string }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" {...S} />
    {DISC(12, 10, 2.4)}
  </svg>
);

export const Clock = ({ size = 24, className }: { size?: number; className?: string }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {DISC(12, 12, 8)}
    {BAR(12, 7.5, 12, 12)}
    {BAR(12, 12, 15.5, 13.5)}
  </svg>
);

export const ArrowRight = ({ size = 24, className }: { size?: number; className?: string }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {BAR(4, 12, 19, 12)}
    <path d="M13.5 6.5 19 12l-5.5 5.5" {...S} />
  </svg>
);
