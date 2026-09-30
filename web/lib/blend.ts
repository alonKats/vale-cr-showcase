/* THE MULTIPLY GUARD, consumed (spec §3.4).

   `mix-blend-mode: multiply` is what makes a retailer photo on white sit on the
   --plate tint. It ASSUMES white. 102 of the 2.108 distinct photos in this
   artifact ship on a saturated green or black studio card, and multiply turns
   those into a mud rectangle. Without this guard the hero is a lottery every
   time the artifact re-exports — and choosing "the first product with a photo"
   for the category rail already picked three of them once.

   The corner-pixel test itself runs ONCE, at asset time, in
   scripts/blend-scan.mjs, and ships as blend-deny.json. Nothing samples a pixel
   at render time. (The engine ask to move the test into the image pipeline is
   spec §8-5, still open — when it lands, this file reads a field instead of a
   list and nothing else changes.)

   One helper, used by Thumb, Bodegon, CategoryRail and the empty state. */

import deny from './blend-deny.json';

const DENY = new Set<string>(deny as string[]);

/** `/img/af5b5d8b3484-320.webp` → `af5b5d8b3484`. One stem per photo, shared by
 *  its 160/320/640 variants, so the verdict is per PHOTO and not per size. */
export const imageStem = (src: string | null | undefined): string | null => {
  const m = /\/([0-9a-f]+)-\d+\.webp$/.exec(src ?? '');
  return m ? m[1] : null;
};

/** True when this photo may be multiplied onto the plate. False means render it
 *  flat on --card inside the plate instead — a white pad, not a mud rectangle.
 *  Unknown assets default to TRUE: the overwhelming majority are white, and a
 *  new asset that turns out dark is a re-run of blend-scan, not a broken page. */
export const canMultiply = (src: string | null | undefined): boolean => {
  const stem = imageStem(src);
  return stem === null ? true : !DENY.has(stem);
};
