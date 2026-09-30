#!/usr/bin/env node
/* The gate for the SEO architecture. Deterministic, no eyeballing.

   Four things it proves, because each of them is a claim that is easy to make
   and easy to get wrong:

   1. CRAWLABLE — the product page renders its prices, chains, gap, reviews and
      specs with JavaScript DISABLED. A page that needs JS to say its price is
      not an indexable product page, whatever its route looks like.
   2. HONEST STRUCTURED DATA — every Product node parses, carries offers, and
      NEVER carries a US-derived aggregateRating. This is checked against the
      artifact, product by product, not spot-checked: structured data is where a
      misrepresentation becomes machine-readable and gets republished.
   3. NO DUPLICATE TWIN — one canonical per product, self-referencing, and the
      in-app overlay lives at that same URL rather than a second one.
   4. INTERCEPT — clicking a row inside the app opens the overlay at the
      canonical URL with NO document navigation, and the list stays mounted.
   5. v4.1-FIX B2 — NO NODE INSIDE A US-REFERENCE PANEL MAY EXCEED --t2 (14px).

   ---- WHY 5 LIVES IN *THIS* FILE AND NOT IN measure.mjs ----
   Because this file is where the US-honesty rules already are, and B2 proved that
   asserting them on the MARKUP ALONE is not enough. Gate 2 checks that no US-derived
   `aggregateRating` ever reaches the JSON-LD, product by product, and it passed
   throughout — while the rendered page set a Best Buy rating for A DIFFERENT PRODUCT at
   26px/600, the same role class as the four section headings, with all four sentences
   saying it was borrowed at 12px, the smallest size in the system. The structured data
   was clean and the TYPOGRAPHY made the claim anyway.

   A BORROWED NUMBER MUST NEVER BE TYPOGRAPHICALLY LOUDER THAN THE SENTENCE THAT
   DISCLAIMS IT. `[data-us-panel]` marks both US regions (the reviews card and the
   CR-vs-US markup chip) and the assertion is one computed-style read per node. That
   turns a taste rule into a build failure, which is the only form this rule survives
   in — the same reasoning that put the price-slot check in measure.mjs.
*/

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:3200';
const DATA = path.join(process.cwd(), 'public', 'data');
const read = (f) => JSON.parse(readFileSync(path.join(DATA, f), 'utf8'));

const products = read('products.json');
const cats = read('categories.json');
const out = { check: 'seo-architecture', pass: true, violations: [], stats: {} };
const fail = (v) => {
  out.pass = false;
  out.violations.push(v);
};

const browser = await chromium.launch();

/* ---- 1. crawlable: JS disabled ---- */
const noJs = await browser.newContext({ javaScriptEnabled: false });
const sample = [
  products.find((p) => p.offers.length > 1 && p.model),
  products.find((p) => p.offers.length === 1),
  products.find((p) => p.reviews.us),
  products.find((p) => p.reviews.cr),
].filter(Boolean);

for (const p of sample) {
  const page = await noJs.newPage();
  await page.goto(`${BASE}/producto/${p.id}`, { waitUntil: 'domcontentloaded' });
  const text = await page.evaluate(() => document.body.innerText);
  const missing = [];
  // every retailer and every price has to be IN THE HTML
  for (const o of p.offers) {
    if (!text.includes(o.retailer)) missing.push(`retailer ${o.retailer}`);
    const money = `₡${Math.round(o.price_crc).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
    if (!text.includes(money)) missing.push(`price ${money}`);
  }
  if (p.model && !text.includes(p.model)) missing.push(`model ${p.model}`);
  /* v4: THE EXPECTED REGIONS ARE TEMPLATE-AWARE, because v4 has two product templates
     rather than one composition with hidden parts.

     T3 (comparable, 257 products) has the offer table as its primary region.
     T4 (single-offer, 1.913 products) HAS NO OFFER TABLE AT ALL — the region is not
     rendered, not hidden — and its primary region is the spec table. Asserting
     "La evidencia" (v3's offer-block heading) on a T4 page would be asserting that
     the wrong component exists, which is the same class of mistake as demanding rows
     on a page that legitimately has none.

     Case-insensitive on purpose: some of these headings are `text-transform:uppercase`
     and innerText returns the RENDERED casing. */
  if (p.offers.length > 1) {
    if (!/Precios en cada cadena/i.test(text)) missing.push('offer-table region (T3)');
    /* This phrase must not drift between surfaces:
       CompareTray's `solo` band already said "no hay con qué comparar". Same fact,
       same words, two surfaces. THE ASSERTION MOVES WITH THE STRING — a gate still
       grepping the old sentence would fail a correct build, which is the same class
       of lie as a gate that selects nothing. */
  } else if (!/No hay con qu[eé] comparar/i.test(text)) {
    // the single highest-leverage sentence in the build: T4 states the absence of a
    // comparison IN WORDS. If it is missing, we have shipped zap's silence.
    missing.push('stated-absence paragraph (T4)');
  }
  if (!/Ficha t[eé]cnica/i.test(text)) missing.push('spec-table region');
  if (!/Reseñas/i.test(text)) missing.push('reviews block');
  if (!/Historial de precio/i.test(text)) missing.push('price-history block');
  if (!/C[oó]mo comparamos/i.test(text)) missing.push('method note');
  if (!/D[oó]nde comprar/i.test(text)) missing.push('branch panel');
  if (p.reviews.us && !text.includes(p.reviews.us.us_title)) missing.push('us_title disclosure');
  if (missing.length) fail({ rule: 'crawlable-no-js', id: p.id, missing });
  await page.close();
}
out.stats.noJsPagesChecked = sample.length;

/* ---- 2 + 3. structured data + canonical, over a wide sample ---- */
const ctx = await browser.newContext();
const page = await ctx.newPage();
const stride = Math.max(1, Math.floor(products.length / 60));
const audited = products.filter((_, i) => i % stride === 0);
let withRating = 0;
let aggregate = 0;

for (const p of audited) {
  const url = `${BASE}/producto/${p.id}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const blocks = await page.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent));
  let nodes = [];
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b);
      nodes = nodes.concat(Array.isArray(parsed) ? parsed : [parsed]);
    } catch (e) {
      fail({ rule: 'jsonld-parse', id: p.id, error: String(e) });
    }
  }
  const prod = nodes.find((n) => n['@type'] === 'Product');
  if (!prod) {
    fail({ rule: 'jsonld-missing-product', id: p.id });
    continue;
  }
  if (!prod.offers) fail({ rule: 'jsonld-missing-offers', id: p.id });
  if (p.offers.length > 1) {
    if (prod.offers['@type'] !== 'AggregateOffer') {
      fail({ rule: 'jsonld-expected-aggregateoffer', id: p.id, got: prod.offers['@type'] });
    } else {
      aggregate++;
      const lo = Math.min(...p.offers.map((o) => o.price_crc));
      const hi = Math.max(...p.offers.map((o) => o.price_crc));
      if (prod.offers.lowPrice !== lo || prod.offers.highPrice !== hi) {
        fail({ rule: 'jsonld-price-mismatch', id: p.id, said: [prod.offers.lowPrice, prod.offers.highPrice], real: [lo, hi] });
      }
      if (prod.offers.offerCount !== p.offers.length) {
        fail({ rule: 'jsonld-offercount-mismatch', id: p.id });
      }
    }
  } else if (prod.offers['@type'] !== 'Offer') {
    fail({ rule: 'jsonld-expected-offer', id: p.id, got: prod.offers['@type'] });
  }

  /* THE LOAD-BEARING RULE. A US review record is never this SKU. If a rating
     is present at all it must equal the CR record, and only at n >= 3. */
  if (prod.aggregateRating) {
    withRating++;
    const cr = p.reviews.cr;
    const us = p.reviews.us;
    if (!cr) fail({ rule: 'jsonld-rating-without-cr-reviews', id: p.id });
    else {
      if (cr.count < 3) fail({ rule: 'jsonld-rating-below-threshold', id: p.id, count: cr.count });
      if (prod.aggregateRating.ratingValue !== cr.average) {
        fail({ rule: 'jsonld-rating-not-cr-value', id: p.id, said: prod.aggregateRating.ratingValue, cr: cr.average });
      }
      if (us && prod.aggregateRating.ratingValue === us.average && cr.average !== us.average) {
        fail({ rule: 'jsonld-rating-is-us-value', id: p.id });
      }
    }
  }
  // and no US figure may appear anywhere in the structured data
  const blob = JSON.stringify(nodes);
  if (p.reviews.us && blob.includes(`"${p.reviews.us.us_title}"`)) {
    fail({ rule: 'jsonld-leaks-us-title', id: p.id });
  }

  const canon = await page.evaluate(() => document.querySelector('link[rel=canonical]')?.href ?? null);
  if (canon !== `${new URL(BASE).origin.replace(BASE, BASE)}` && !canon?.endsWith(`/producto/${p.id}`)) {
    fail({ rule: 'canonical-not-self', id: p.id, canon });
  }
  const title = await page.title();
  if (!title || title.length < 20) fail({ rule: 'title-too-short', id: p.id, title });
  const desc = await page.evaluate(() =>
    document.querySelector('meta[name=description]')?.content ?? '');
  if (!desc.includes('₡')) fail({ rule: 'description-carries-no-price', id: p.id, desc });
}
out.stats.productsAudited = audited.length;
out.stats.aggregateOffers = aggregate;
out.stats.withAggregateRating = withRating;

/* ---- 5. B2: the US-reference panels' type ceiling ----
   Run over a sample that is CHOSEN FOR THE CONDITION rather than sliced by stride: a
   product WITH a US review record (the 26px `4,8` case), one WITHOUT (the empty state),
   and one on each template. A stride sample could contain none of them and the gate would
   pass on absence, which is the failure mode this whole file is written against. */
{
  const t2 = 14;
  const usSample = [
    products.find((p) => p.reviews.us && p.offers.length === 1),
    products.find((p) => p.reviews.us && p.offers.length > 1),
    products.find((p) => !p.reviews.us && p.offers.length === 1),
    products.find((p) => p.reviews.us && p.reviews.cr),
    /* THE MARKUP-CHIP CASE, and it needs naming because the first run of this assertion
       missed it: `USChip` only renders its panel when `us_reference` AND `markup_pct` are
       both present, so the four conditions above happened to select three pages that all
       rendered the REVIEWS panel and none that rendered the CHIP. One panel per page,
       gate green, and the `.usN` figure — the other US-derived number on the page — was
       never measured. 62 products satisfy this; a sample that does not include one is a
       sample that proves nothing about half the rule. */
    products.find((p) => p.us_reference && p.markup_pct !== null),
  ].filter(Boolean);

  let panelsChecked = 0;
  for (const p of usSample) {
    await page.goto(`${BASE}/producto/${p.id}`, { waitUntil: 'domcontentloaded' });
    const found = await page.evaluate((ceiling) => {
      const panels = [...document.querySelectorAll('[data-us-panel]')];
      const over = [];
      for (const panel of panels) {
        for (const el of [panel, ...panel.querySelectorAll('*')]) {
          // only nodes that actually carry text — a wrapper's font-size is inherited noise
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (!own) continue;
          const cs = getComputedStyle(el);
          const fs = parseFloat(cs.fontSize);
          if (fs > ceiling + 0.5) {
            over.push({
              size: fs,
              weight: cs.fontWeight,
              text: (el.textContent || '').trim().slice(0, 48),
            });
          }
        }
      }
      return { panels: panels.length, over };
    }, t2);

    /* A PRODUCT PAGE ALWAYS HAS AT LEAST ONE US PANEL — the reviews card renders its empty
       state when there is no record, and the markup chip renders a sentence when there is
       no percentage. Zero panels means the hook was dropped and this gate measured
       nothing, which must fail rather than pass. */
    if (!found.panels) {
      fail({ rule: 'us-panel-hook-missing', id: p.id, note: '[data-us-panel] is a gate hook; assertion 5 measured nothing' });
    }
    panelsChecked += found.panels;
    if (found.over.length) {
      fail({
        rule: 'us-reference-panel-exceeds-t2',
        id: p.id,
        ceiling: t2,
        cases: found.over.slice(0, 6),
        note: 'B2 — a borrowed number may never be typographically louder than the sentence that disclaims it',
      });
    }
  }
  out.stats.usPanelsChecked = panelsChecked;
  out.stats.usPagesChecked = usSample.length;
}

/* ---- category pages: EVERY product linked across the WHOLE PAGINATION CHAIN, in the
       HTML, with no JS ----

   v4 paginates T2 at 24 per page, so this assertion is now STRONGER than v3's rather
   than weaker: it walks the pager from page 1 to the end, follows only real `<a href>`
   links with JavaScript disabled, and asserts that the UNION of products linked across
   the chain is exactly the category — and that the chain's own length matches the page
   count. A single page linking 24 of 526 products would pass a naive count check and
   leave 502 products unreachable; this cannot.

   It also asserts each page is reachable BY LINK, not merely by URL guess: the walk
   only ever visits an href it actually found in the previous page's pager. */
const PAGE_SIZE = 24;
for (const c of cats) {
  const inCat = products.filter((x) => x.category === c.id);
  const expectedPages = Math.max(1, Math.ceil(inCat.length / PAGE_SIZE));
  const seen = new Set();
  const visited = new Set();
  let next = `/categoria/${c.id}`;
  let guard = 0;

  while (next && !visited.has(next) && guard < 200) {
    visited.add(next);
    guard += 1;
    const p2 = await noJs.newPage();
    await p2.goto(`${BASE}${next}`, { waitUntil: 'domcontentloaded' });
    const found = await p2.evaluate(() => ({
      products: [...document.querySelectorAll('a[href^="/producto/"]')].map((a) => a.getAttribute('href')),
      pages: [...document.querySelectorAll('a[href^="/categoria/"]')].map((a) => a.getAttribute('href')),
    }));
    for (const href of found.products) seen.add(href);
    // follow the pager: the next unvisited page of THIS category
    next = found.pages.find((h) => h && h.startsWith(`/categoria/${c.id}/`) && !visited.has(h)) || null;
    await p2.close();
  }

  if (seen.size !== inCat.length) {
    fail({
      rule: 'category-links-incomplete-across-pagination',
      category: c.id, linkedUnion: seen.size, expected: inCat.length, pagesWalked: visited.size,
    });
  }
  if (visited.size !== expectedPages) {
    fail({
      rule: 'pagination-chain-length-mismatch',
      category: c.id, walked: visited.size, expected: expectedPages,
    });
  }
  out.stats[`category:${c.id}`] = { linked: seen.size, pages: visited.size };
}

/* ---- 4. intercept: overlay at the canonical URL, no document navigation ---- */
{
  await page.goto(`${BASE}/buscar`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  /* SETUP, not a relaxation of the assertion. v4 is no longer virtualized (page size
     24 made windowing redundant, which is why VirtualRows.tsx is deleted), but the
     grid still starts below the facet bar. The claim under test is "clicking a product
     opens the overlay at the canonical URL with no document navigation"; where the card
     happens to sit on the page is not part of it. */
  await page.locator('[data-rowlist]').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__navCount = 0;
    window.addEventListener('beforeunload', () => { window.__navCount++; });
    document.documentElement.dataset.marker = 'same-document';
  });
  /* RESOLVE THE ELEMENT ONCE. A Playwright locator re-queries on every action, and
     this list is virtualized: the hover scrolls, the window shifts, and `.first()`
     resolved to a DIFFERENT row between getAttribute and click — so the gate
     compared the href of one row against the URL opened by another and reported
     `intercept-url-not-canonical` for two perfectly canonical URLs. An element
     handle is stable. */
  /* RESOLVE THE ELEMENT ONCE, not through a locator. A Playwright locator re-queries on
     every action, and in v3 the hover scrolled the virtualized list so `.first()`
     resolved to a DIFFERENT row between getAttribute and click — the gate then compared
     one row's href against the URL opened by another and reported
     `intercept-url-not-canonical` for two perfectly canonical URLs. An element handle is
     stable, and it stays stable for the same reason a card grid is. */
  const link = await page.locator('main li a[href^="/producto/"]').first().elementHandle();
  const href = await link.getAttribute('href');
  await link.hover();
  await page.waitForTimeout(200);
  await link.click();
  await page.waitForSelector('aside[role=dialog]', { timeout: 5000 });
  const url = new URL(page.url()).pathname;
  if (url !== href) fail({ rule: 'intercept-url-not-canonical', url, href });
  const sameDoc = await page.evaluate(() => document.documentElement.dataset.marker === 'same-document');
  if (!sameDoc) fail({ rule: 'intercept-did-full-page-load', href });
  const listStillMounted = await page.evaluate(() => document.querySelectorAll('main li').length > 0);
  if (!listStillMounted) fail({ rule: 'intercept-unmounted-the-list' });
  // the overlay must not emit a second canonical for the same content
  const canonCount = await page.evaluate(() => document.querySelectorAll('link[rel=canonical]').length);
  if (canonCount !== 1) fail({ rule: 'overlay-canonical-count', canonCount });
  out.stats.interceptUrl = url;

  await page.goBack();
  await page.waitForTimeout(400);
  const closed = (await page.locator('aside[role=dialog]').count()) === 0;
  if (!closed) fail({ rule: 'back-does-not-close-overlay' });
}

/* ---- sitemap + robots ---- */
{
  const r = await ctx.request.get(`${BASE}/sitemap.xml`);
  const xml = await r.text();
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  /* products + category page 1 × 6 + every pagination page + `/` + `/buscar`
     + THE SIX v5 TRUST ROUTES.
     The pagination pages are real, indexable, self-canonical URLs; a sitemap that
     omitted them would leave them discoverable only by following the pager. The
     trust routes are the same argument plus an E-E-A-T one: a commerce-adjacent
     site with no About or Contact page is a documented quality-rating negative, so
     they are not merely allowed in the sitemap, they are part of the SEO case.

     7 since 2026-08-08: /comercios joins them. It is not a trust page in the
     legal sense — it is addressed to a BUSINESS reader — but it belongs in the
     sitemap for the same E-E-A-T reason and one stronger commercial one: a
     retailer searching for how to correct their own listings has to be able to
     find it. This constant is deliberately a literal rather than a glob over
     app/, so ADDING A ROUTE FAILS THIS GATE UNTIL SOMEONE UPDATES IT — which is
     exactly what caught /comercios (got 4529, expected 4528). A count that
     derived itself would have silently accepted a route nobody meant to ship. */
  const TRUST_ROUTES = 7;
  /* `/`, `/buscar` and — since 2026-08-10 — `/brechas`.
     `/brechas` is deliberately counted HERE and not folded into TRUST_ROUTES: it
     is not a policy page, it is a listing surface whose subject is the catalogue
     (v6.1 §4), and putting it in the legal bucket would make the next reader
     think it carries a policy stamp. Same literal-not-derived discipline as
     TRUST_ROUTES — this number does not compute itself, so adding a route fails
     this gate until someone comes here and says which kind of route it is. */
  const APP_ROUTES = 3;
  const paginationPages = cats.reduce(
    (n, c) => n + Math.max(0, Math.ceil(products.filter((x) => x.category === c.id).length / PAGE_SIZE) - 1),
    0,
  );
  const expected = products.length + cats.length + paginationPages + APP_ROUTES + TRUST_ROUTES;
  if (locs.length !== expected) {
    fail({ rule: 'sitemap-count', got: locs.length, expected, paginationPages });
  }
  for (const p of products.slice(0, 40)) {
    if (!locs.some((l) => l.endsWith(`/producto/${p.id}`))) {
      fail({ rule: 'sitemap-missing-product', id: p.id });
    }
  }
  const lastmods = new Set([...xml.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map((m) => m[1]));
  if (lastmods.size < 2) fail({ rule: 'sitemap-lastmod-is-one-build-timestamp', distinct: lastmods.size });
  out.stats.sitemapUrls = locs.length;
  out.stats.sitemapDistinctLastmod = lastmods.size;

  const rb = await ctx.request.get(`${BASE}/robots.txt`);
  const txt = await rb.text();
  if (!/Sitemap:/.test(txt)) fail({ rule: 'robots-missing-sitemap' });
  if (!/Allow: \//.test(txt)) fail({ rule: 'robots-missing-allow' });
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
