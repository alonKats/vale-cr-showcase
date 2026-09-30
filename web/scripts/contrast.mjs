#!/usr/bin/env node
/* WCAG 2.x contrast, wired into the build — not into a checklist.
   Port of comps-v3/contrast.py, plus one check the Python version could not do:
   every colour in design/pairs-v3.json must still be a live value in
   app/tokens.css. Without that, editing a token silently detaches the ratios
   from the thing they claim to measure and the gate keeps passing.

   A pair may carry "banned": true. That records a combination the design
   FORBIDS and the assertion inverts — it must measure BELOW the minimum. That
   is how "amber never sits under white text" stops being a convention someone
   has to remember and becomes a build failure.

   BANNED PAIRS ARE EXEMPT FROM THE TOKEN-LIVENESS CHECK, BY DESIGN. A banned
   pair asserts a combination that must NEVER exist, so requiring its colours
   to be live tokens is backwards. The v3 pairs file bans `#FF4627` — the
   retired red — as ink on paper precisely so it cannot quietly return as text,
   and #FF4627 is deliberately not a v3 token. Without the `if (!p.banned)`
   guard below the gate reports "1 colour(s) ... no longer declared in
   tokens.css: #FF4627" and the v3 build could never go green.
   (design-v3-build-spec.md §7.1b / §9-13.)

   Runs as `prebuild`, so `npm run build` cannot produce a bundle whose colours
   have drifted out of contract. */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* ONE PAIRS FILE, NOT TWO. v3 kept a design copy (comps-v3/pairs-v3.json, read
   by contrast.py) and a build copy (web/design/pairs-v3.json, read by this
   script) that had to stay byte-identical — a drift meant the two asserted
   different palettes and neither one told you. There are no v4 comps: the spec
   document IS the design source, so the duplication has no reason to exist.
   v4 §3.7: one file, one reader, one truth. */
const PAIRS_FILE = 'design/pairs-v8.json';
const pairs = JSON.parse(readFileSync(path.join(root, PAIRS_FILE), 'utf8'));
const tokensCss = readFileSync(path.join(root, 'app/tokens.css'), 'utf8');

const tokens = new Map();
for (const m of tokensCss.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
  tokens.set(m[2].toUpperCase(), m[1]);
}

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

const ratio = (fg, bg) => {
  const [a, b] = [lum(fg), lum(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

let fails = 0;
const orphans = new Set();

for (const p of pairs) {
  // ← the guard. See the header: a banned pair names a combination that must
  // never exist, so its colours are not required to be live tokens.
  if (!p.banned) {
    for (const hex of [p.fg, p.bg]) {
      if (!tokens.has(hex.toUpperCase())) orphans.add(hex.toUpperCase());
    }
  }
  const r = ratio(p.fg, p.bg);
  const ok = p.banned ? r < p.min : r >= p.min;
  if (!ok) fails++;
  const need = p.banned ? `must be < ${p.min}` : `need ${p.min}`;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}:1  (${need})  ${p.fg} on ${p.bg}  — ${p.what}`,
  );
}

if (orphans.size) {
  console.log(
    `\nFAIL: ${orphans.size} colour(s) in ${PAIRS_FILE} are no longer declared in tokens.css: ` +
    `${[...orphans].join(', ')}`,
  );
  fails += orphans.size;
}

console.log('(banned pairs are exempt from the token-liveness check by design)');
console.log(`\n${fails} failure(s) over ${pairs.length} pairs · ${tokens.size} tokens read`);
process.exit(fails ? 1 : 0);
