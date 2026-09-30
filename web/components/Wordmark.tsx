/* THE WORDMARK — v8, "vale.cr" set as type.

   THIS REPLACES THE DRAWN LOCKUP: a 86×48 SVG
   whose V was a solid wedge and whose a·l·e were monoline geometry on a 48-unit
   grid, with a square period as the accent. It was a good mark and it is not
   what the redesign draws. All five frames of the 2026-08-31 Figma set the
   wordmark as TEXT — Plus Jakarta Sans ExtraBold at 28px, `vale` in --deep and
   `.cr` in amber — and the `.cr` suffix is now doing the work the square period
   used to: it names the domain, which the drawn mark could not.

   The old file is recoverable from git and from logo/a-lockup.svg; it is not
   kept as a variant here, because a wordmark with two live forms is a wordmark
   that will appear in both.

   ---- WHY THE ACCENT IS A PROP AND NOT A CONSTANT --------------------------
   The Figma paints `.cr` #FEA619 everywhere. On the footer's --deep-2 that
   measures 6.36 and is correct; on the white chrome it measures 1.97, which is
   a BANNED pair in design/pairs-v8.json. So the accent flips with the surface:
   --loud-ink (#855300, 6.49) on light, --loud (#FEA619) on dark. Same mark,
   same amber hue, two luminances — which is exactly the split DESIGN.md already
   makes between `secondary` and `secondary-container`. */

import s from './Wordmark.module.css';

export function Wordmark({
  size = 28, tone = 'light', className = '',
}: {
  /** font-size in px. 28 in the chrome, 24 in the footer. */
  size?: number;
  /** the SURFACE the mark sits on, not the colour of the mark. */
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <span
      className={`${s.mark} ${tone === 'dark' ? s.onDark : s.onLight} ${className}`}
      style={{ fontSize: `${size}px` }}
    >
      vale<span className={s.tld}>.cr</span>
    </span>
  );
}
