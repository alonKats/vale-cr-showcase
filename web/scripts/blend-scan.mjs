#!/usr/bin/env node
/* THE MULTIPLY GUARD, computed once (spec §3.4, §8-5).

   `mix-blend-mode: multiply` is the one line that makes retailer photos on
   white sit on the --plate tint: white goes transparent and the product keeps
   its own shadow. IT ASSUMES WHITE. Several images in the set ship on a
   saturated green or black studio card, and multiply turns those into a mud
   rectangle — picking "the first product with a photo" for the category rail
   picked three of them.

   So the corner test runs HERE, once, over the whole asset set, and the result
   ships as lib/blend-deny.json. It is deliberately NOT in `npm run build`:
   spec §8-5 says the test belongs at asset-generation time, once, not at every
   render, and the engine ask to move it into the image pipeline is open. Re-run
   this whenever the engine re-exports images:

       node scripts/blend-scan.mjs            # rewrite lib/blend-deny.json
       node scripts/blend-scan.mjs --report   # print the distribution, write nothing

   Reads the 160px variant (smallest, same background) and samples the four
   corner pixels. A photo is blendable only if EVERY corner is near-white on
   every channel — one dark corner is enough to make multiply produce mud. */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* `sharp` is NOT a declared dependency of this app — it is present because Next
   ships it as an optional dependency for its own image optimiser, and Node has no
   built-in WebP decoder. That is fine BECAUSE THIS SCRIPT IS NOT IN THE BUILD
   PATH: `npm run build` never calls it, the committed lib/blend-deny.json is the
   artifact, and a missing sharp can therefore never break a build or a deploy.

   It is imported dynamically with an explicit message rather than statically, so
   the failure mode is a sentence instead of a module-resolution stack trace.
   FLAGGED to Max: if this ever needs to run in CI, declare sharp as a
   devDependency there — do not add it to make the local script work. */
let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error(
    'blend-scan needs `sharp` to decode the WebP set. It normally comes along with\n' +
    'next; if it is gone, run `npm i -D sharp` deliberately and say why. The\n' +
    'committed lib/blend-deny.json is unaffected and the build does not need this.',
  );
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = process.argv.includes('--report');

/** Every channel of every corner must clear this to be called "white". 235 of
 *  255 = a corner that may carry a soft JPEG-ish gradient but not a colour. */
const NEAR_WHITE = 235;

const products = JSON.parse(readFileSync(path.join(root, 'public/data/products.json'), 'utf8'));

/** the asset stem — `/img/af5b5d8b3484-320.webp` → `af5b5d8b3484`. One stem per
 *  photo, shared by its 160/320/640 variants, so the verdict is per PHOTO. */
export const stemOf = (src) => {
  const m = /\/([0-9a-f]+)-\d+\.webp$/.exec(src ?? '');
  return m ? m[1] : null;
};

const stems = new Map();
for (const p of products) {
  const stem = stemOf(p.image);
  if (stem && !stems.has(stem)) stems.set(stem, p.id);
}

const deny = [];
const mins = [];
let missing = 0;

for (const [stem, id] of stems) {
  const file = path.join(root, 'public/img', `${stem}-160.webp`);
  let raw;
  try {
    raw = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  } catch {
    missing++;
    continue;
  }
  // toBuffer({resolveWithObject}) resolves to { data, info } — the geometry is
  // one level down. Reading it off the top level yields undefined, which makes
  // every sample NaN, which fails `min < THRESHOLD` silently and denies
  // nothing. A guard that reports zero violations is indistinguishable from a
  // clean set, so this destructure is load-bearing.
  const { data, info: { width, height, channels } } = raw;
  const at = (x, y) => {
    const i = (y * width + x) * channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  const min = Math.min(...corners.flat());
  mins.push(min);
  if (min < NEAR_WHITE) deny.push({ stem, id, min });
}

if (REPORT) {
  mins.sort((a, b) => a - b);
  const q = (f) => mins[Math.min(mins.length - 1, Math.floor(mins.length * f))];
  console.log(JSON.stringify({
    check: 'blend-scan',
    photos: stems.size,
    unreadable: missing,
    threshold: NEAR_WHITE,
    denied: deny.length,
    deniedPct: +((deny.length / stems.size) * 100).toFixed(1),
    minChannelQuantiles: { p0: q(0), p1: q(0.01), p5: q(0.05), p50: q(0.5), p100: mins[mins.length - 1] },
    worst: deny.slice().sort((a, b) => a.min - b.min).slice(0, 12),
  }, null, 2));
} else {
  const out = deny.map((d) => d.stem).sort();
  writeFileSync(
    path.join(root, 'lib/blend-deny.json'),
    `${JSON.stringify(out, null, 0)}\n`,
    'utf8',
  );
  console.log(JSON.stringify({
    check: 'blend-scan',
    wrote: 'lib/blend-deny.json',
    photos: stems.size,
    unreadable: missing,
    threshold: NEAR_WHITE,
    denied: out.length,
  }, null, 2));
}
