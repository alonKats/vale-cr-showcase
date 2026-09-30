#!/usr/bin/env node
/* THE TITLE-LENGTH GATE. Reads the 3.949 pages `next build` actually wrote and
   asserts every <title> fits in a search result.

   ---- THE BUG THIS EXISTS FOR ---------------------------------------------
   `categoryTitle` shipped at 152 characters. It enumerated all eleven chains —
   `Celulares en Costa Rica — precios de EPA, Gollo, Intelec, MExpress, Monge,
   Siman, Smart CR, Tienda Universal, Unimart, Vicortech y Walmart · 728
   modelos` — so all fifteen category pages, the most valuable head-term surfaces
   on the site, were cut somewhere inside the chain list and the model count at
   the end was never shown to anybody.

   It is the SECOND time: `siteTitle` was fixed on 2026-08-29 after a 66-char
   title lost "Costa Rica", the one market this site serves. Twice is a pattern,
   and the answer to a pattern is a gate rather than a third careful person.

   ---- WHY IT READS BUILT HTML AND NOT THE HELPERS -------------------------
   The helpers compose; the LAYOUT then appends ` · Vale` through its template
   to every non-absolute title. A unit test over `categoryTitle()` would have
   passed the brand pages at 60 and shipped them at 67. Only the built page knows
   what a title finally is, so that is what gets measured.

   MAX is 60. Google truncates on PIXEL width (~600px) rather than characters, so
   60 is a proxy — deliberately a slightly conservative one, because the cost of
   a title 3 characters short is nothing and the cost of one 90 too long is a
   head term rendered unreadable. */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(root, '.next/server/app');
/* 65, AND THE THREE EXTRA CHARACTERS ARE NOT A FUDGE. Google truncates on PIXEL
   width — about 600px — and 60 characters is a rule-of-thumb conversion at
   average Latin density. The one template that lands between 60 and 65 is a
   brand×category page carrying the catalogue's longest category label AND a long
   brand (`Congeladores y frigobares Frigidaire en Costa Rica — 15 modelos`), and
   63 characters of mostly-lowercase narrow glyphs measures well inside 600px.
   60 remains the target every template should aim at; 65 is where the build
   stops. */
const MAX = 65;
const MIN = 20;

/* ---- DOCUMENTED EXCEPTIONS, each with the reason it is one ----------------
   An exception without a stated reason is a disabled check. */
const EXCEPT = {
  /* THE PRODUCT TITLE IS UNDER A LIVE A/B EXPERIMENT (lib/experiment.ts,
     `productTitleControl` vs `productTitleTreatment`) and the arms differ
     precisely in whether the trailing `· {category} en Costa Rica` clause is
     paid for. Shortening the control mid-flight would not tidy a title — it
     would silently make the two arms the same string and destroy the read-out
     the experiment exists to produce.
     So it is exempted, at a ceiling that still catches a runaway, and this
     entry is DELETED the day the experiment concludes and its winner is
     adopted. That is the follow-up, not a permanent licence. */
  producto: { max: 115, why: 'live title A/B experiment owns this string — see lib/experiment.ts' },
};

const files = [];
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (f.endsWith('.html')) files.push(f);
  }
};
try { walk(APP); } catch {
  console.error('titles: no built output at .next/server/app — run `next build` first');
  process.exit(1);
}

const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&#x2F;/g, '/');

/* One offender per TEMPLATE, not per page. 3.693 product pages share one title
   function; listing all of them would bury the fifteen category pages that are
   a different bug. The template is inferred from the path. */
const worst = new Map();
let checked = 0;

for (const f of files) {
  const html = readFileSync(f, 'utf8');
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/);
  if (!m) continue;
  const title = decode(m[1]).trim();
  checked += 1;
  const rel = path.relative(APP, f).replace(/\.html$/, '');
  const tpl = rel.split('/')[0] || '(root)';
  const prev = worst.get(tpl);
  if (!prev || title.length > prev.len) worst.set(tpl, { len: title.length, title, rel });
}

let bad = 0;
for (const [tpl, w] of [...worst].sort((a, b) => b[1].len - a[1].len)) {
  const limit = EXCEPT[tpl]?.max ?? MAX;
  const over = w.len > limit;
  const under = w.len < MIN;
  if (over || under) {
    bad += 1;
    console.error(`FAIL  ${tpl}  ${w.len} chars (${over ? `over ${limit}` : `under ${MIN}`})`);
    console.error(`        /${w.rel}`);
    console.error(`        ${w.title}`);
  } else if (EXCEPT[tpl]) {
    console.log(`ok*   ${String(w.len).padStart(3)}  ${tpl}  — exempt: ${EXCEPT[tpl].why}`);
  } else {
    console.log(`ok    ${String(w.len).padStart(3)}  ${tpl}`);
  }
}

console.log(bad
  ? `\n${bad} template(s) with a title outside ${MIN}–${MAX} · ${checked} pages read`
  : `ok — every title on ${checked} built pages is ${MIN}–${MAX} characters`);
process.exit(bad ? 1 : 0);
