#!/usr/bin/env node
/* THE TOKEN-LIVENESS GATE. Every `var(--x)` in the app must resolve to a token
   that app/tokens.css actually declares.

   ---- THE BUG THIS EXISTS FOR, WHICH IT DID NOT CATCH BECAUSE IT DID NOT EXIST
   The v8 repaint (2026-08-31) rewrote tokens.css wholesale. It deleted --act,
   --act-strong and --act-on-dark — v4's link colours, read 47 times across the
   eleven templates the redesign does not touch — and it renumbered the type
   ladder, so --t2 went from 14px to 12 under 79 declarations and --t4 from 20px
   to 14 under 26 more.

   NONE OF THAT IS AN ERROR ANYWHERE. An unresolvable `var()` is invalid at
   computed-value time: the declaration is dropped and the property falls back to
   inherited or initial, silently. `tsc` is green because CSS Modules are not
   typed against a token list. The contrast gate is green because it reads PAIRS,
   and a colour that no longer exists is not a pair — it is an absence, and the
   gate has nothing to measure. `next build` is green because a stylesheet with a
   dangling custom property is a valid stylesheet.

   So the failure mode is: eleven pages render with unstyled links and half-size
   headings, every automated check passes, and the only detector is a human
   opening each page. That is precisely the class of defect the contrast gate was
   built to make impossible for colour, so it gets the same treatment.

   REFUSE, don't log. This runs as `prebuild` beside contrast.mjs and exits
   non-zero, because a guard whose only output is a line of text is a guard
   nobody reads.

   ---- WHAT IS DELIBERATELY NOT A FAILURE ---------------------------------
   A custom property may legitimately be declared somewhere other than
   tokens.css: set inline from a component (`style={{ '--disc': … }}`), written
   at runtime (`root.style.setProperty('--consent-h', …)`), declared on a local
   rule for one module's own use, or scoped to a wrapper. Those are collected
   from the same sources rather than allow-listed by hand, so adding one does not
   mean editing this file.

   AND A `var()` THAT SUPPLIES A FALLBACK IS SAFE BY CONSTRUCTION. `var(--x, 0px)`
   cannot produce the failure this gate exists for — if --x is missing the
   declaration still computes, to the fallback, which is exactly what the author
   asked for. Flagging it would be reporting a deliberate default as a defect,
   and it is how the gate's first run flagged `--consent-h`: a property written
   by a ResizeObserver and read with a `0px` fallback, i.e. correct on both
   sides. The rule is therefore about UNDEFAULTED references only. */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['components', 'app'];
const SKIP = /node_modules|\.next|\.open-next/;

const files = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (SKIP.test(f)) continue;
    if (e.isDirectory()) walk(f);
    else if (/\.(css|tsx|ts)$/.test(f)) files.push(f);
  }
};
for (const r of ROOTS) walk(path.join(root, r));

/* DECLARED = tokens.css, plus every custom property declared anywhere else —
   `--x: value` in a module, and `'--x':` in a TSX inline style. Both are real
   declarations and both make a var() reference resolvable. */
const declared = new Set();
const declaredIn = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:^|[;{\s])(--[\w-]+)\s*:/gm)) {
    declared.add(m[1]);
    if (!declaredIn.has(m[1])) declaredIn.set(m[1], f);
  }
  for (const m of src.matchAll(/['"](--[\w-]+)['"]\s*:/g)) {
    declared.add(m[1]);
    if (!declaredIn.has(m[1])) declaredIn.set(m[1], f);
  }
  // written at runtime: root.style.setProperty('--consent-h', `${h}px`)
  for (const m of src.matchAll(/setProperty\(\s*['"`](--[\w-]+)['"`]/g)) {
    declared.add(m[1]);
    if (!declaredIn.has(m[1])) declaredIn.set(m[1], f);
  }
}

const used = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8')
    // a token named inside a comment is prose, not a reference
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  /* the trailing group captures whatever follows the name: a `,` means the
     author supplied a fallback, and that reference cannot dangle. */
  for (const m of src.matchAll(/var\(\s*(--[\w-]+)\s*(,?)/g)) {
    if (m[2] === ',') continue;
    if (!used.has(m[1])) used.set(m[1], new Set());
    used.get(m[1]).add(path.relative(root, f));
  }
}

const dangling = [...used].filter(([t]) => !declared.has(t)).sort();

for (const [t, where] of dangling) {
  console.error(`FAIL  ${t} is used but never declared`);
  for (const f of where) console.error(`        ${f}`);
}

/* The reverse direction is a WARNING, never a failure. An unused token is dead
   weight, but tokens.css is also the palette's documentation and a colour may
   legitimately be declared a step before the component that consumes it. */
const tokensCss = readFileSync(path.join(root, 'app/tokens.css'), 'utf8');
const inTokens = [...tokensCss.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]);
const unused = inTokens.filter((t) => !used.has(t)).sort();
if (unused.length) console.warn(`warn  ${unused.length} declared but unused: ${unused.join(' ')}`);

console.log(
  dangling.length
    ? `\n${dangling.length} dangling token reference(s)`
    : `ok — ${used.size} referenced tokens all resolve · ${inTokens.length} declared in tokens.css`,
);
process.exit(dangling.length ? 1 : 0);
