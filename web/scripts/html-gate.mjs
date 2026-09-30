#!/usr/bin/env node
/* ==========================================================================
   A29 — THE SERVED HTML CARRIES THE PRICE SURFACE (v7.2 §8.2, corrected form).

   Every other gate in this directory measures the DOM. This one measures the
   BYTES, with no browser and no JavaScript, because that is the difference
   between "the page renders prices" and "a crawler, a curl and a cold load see
   prices" — and that difference is the entire subject of H1. W7 shipped a report
   claiming a change was "visible on the homepage" when `curl` returned one `₡`
   and zero `data-gap-band` nodes.

   ---- WHY THE FORM IN §8.2 AND §11 IS NOT THE FORM HERE ----
   The document specified `curl … | grep -c '₡'`. The designer reproduced it against this
   build (her §6.6) and it CANNOT FAIL:

     grep -c '₡'                      → 1     on the broken build AND on the fixed one
     grep -o '₡' | wc -l  (raw)       → 122   ~2× the truth
     <script> stripped, grep -o | wc  → 60    the real markup

   Two defects, both load-bearing:

     1. `grep -c` COUNTS MATCHING LINES, and a Next page is one line. It returns
        `1` for a page with no prices and `1` for a page with sixty — it is
        incapable of distinguishing the two builds it exists to distinguish, and
        it would have shipped green forever.
     2. THE RAW COUNT MEASURES THE RSC FLIGHT PAYLOAD. Every figure is repeated
        inside `<script>` blocks, so a page whose visible markup is EMPTY still
        clears a ≥20 threshold on the payload alone — which is precisely the
        pre-H1 state this assertion exists to catch.

   So: strip `<script>` blocks first, then count OCCURRENCES, not lines.

   An assertion that has never been run against a known-bad build is not a gate,
   it is a sentence. This one has: see `--self-test`, which serves a synthesised
   pre-H1 page — markup emptied of prices, flight payload intact — and requires
   this gate to FAIL on it. The self-test fails if the gate passes.

   Usage:
     node scripts/html-gate.mjs http://localhost:3000/
     node scripts/html-gate.mjs http://localhost:3000/ --self-test
   ========================================================================== */

/** §8.2 A29. 20 and 10 are the document's, unchanged: below 20 `₡` the price
 *  surface is not in the HTML in any useful quantity, and below 10 band nodes
 *  the ramp is not either. */
const MIN_CRC = 20;
const MIN_BAND = 10;

/** The RSC flight payload repeats every figure in the tree. It is not markup and
 *  it is not what a crawler reads as content, so it is removed BEFORE anything
 *  is counted — this single substitution is the difference between 122 and 60. */
const markup = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, '');

/** Occurrences, never lines. `grep -c` on a one-line document is a boolean
 *  wearing a count's clothes. */
const count = (s, needle) => s.split(needle).length - 1;

export function auditHtml(html) {
  const body = markup(html);
  return {
    crc: count(body, '₡'),
    band: count(body, 'data-gap-band'),
    /* reported alongside, never asserted on: it is the number the naive form
       would have read, and seeing the two side by side is what makes the defect
       legible in the output rather than only in this comment. */
    crcRaw: count(html, '₡'),
    bytes: html.length,
    markupBytes: body.length,
  };
}

async function audit(url) {
  const res = await fetch(url, { headers: { accept: 'text/html' } });
  const m = auditHtml(await res.text());
  const violations = [];
  if (res.status !== 200) violations.push({ rule: 'not-200', status: res.status });
  if (m.crc < MIN_CRC) {
    violations.push({ rule: 'served-html-carries-fewer-than-min-price-figures', min: MIN_CRC, measured: m.crc });
  }
  if (m.band < MIN_BAND) {
    violations.push({ rule: 'served-html-carries-fewer-than-min-gap-band-nodes', min: MIN_BAND, measured: m.band });
  }
  return { url, status: res.status, measured: m, violations, pass: violations.length === 0 };
}

/* ---- THE RED PROOF ----
   A synthesised pre-H1 homepage: the REAL served page with every `₡` and every
   `data-gap-band` removed from the markup and the `<script>` payload left
   untouched. That is the exact shape of the build this assertion exists to
   catch, and on it the two rejected forms both report success. */
async function selfTest(url) {
  const { createServer } = await import('node:http');
  const real = await (await fetch(url)).text();
  const scripts = [];
  /* A NUL-DELIMITED PLACEHOLDER, NEVER A BARE NUMBER: the markup is full of
     ` 123 ` and a restore keyed on that pattern would splice a script block into
     the middle of a price. A byte that cannot occur in served HTML is the only
     safe stand-in, and a red proof that corrupts its own input proves nothing. */
  const broken = real
    .replace(/<script[\s\S]*?<\/script>/gi, (s) => `\u0000${scripts.push(s) - 1}\u0000`)
    .replace(/₡/g, '')
    .replace(/data-gap-band/g, 'data-x')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => scripts[+i]);

  const srv = createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(broken);
  });
  await new Promise((r) => srv.listen(0, r));
  const bad = await audit(`http://127.0.0.1:${srv.address().port}/`);
  srv.close();

  const naive = {
    'grep -c (lines, the §8.2 form)': broken.split('\n').filter((l) => l.includes('₡')).length,
    'grep -o raw (payload included)': count(broken, '₡'),
  };
  return {
    check: 'a29-red-proof',
    note: 'the gate must FAIL on this input; if it passes, the assertion is a sentence',
    knownBad: { violations: bad.violations, measured: bad.measured },
    naiveFormsOnTheSameInput: naive,
    naiveWouldHavePassed:
      naive['grep -c (lines, the §8.2 form)'] >= 1
      && naive['grep -o raw (payload included)'] >= MIN_CRC,
    pass: bad.pass === false,
  };
}

const url = process.argv[2];
if (!url) {
  console.error('usage: node scripts/html-gate.mjs <url> [--self-test]');
  process.exit(2);
}

const out = process.argv.includes('--self-test') ? await selfTest(url) : await audit(url);
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
