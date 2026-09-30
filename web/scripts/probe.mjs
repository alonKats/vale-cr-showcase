#!/usr/bin/env node
/* Measures the spec-v2 §8.1 budgets and captures every state at 1440 and 390.
   Numbers, not adjectives — a miss is a build failure and is reported as a
   number. Screenshots are deviceScaleFactor 1. */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3200';
const OUT = process.env.OUT || '/tmp/veredicto-shots';
mkdirSync(OUT, { recursive: true });

const W = { d: { width: 1440, height: 900 }, m: { width: 390, height: 844 } };
const report = { budgets: {}, states: [], console: [], overflow: [] };
const p95 = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.ceil(a.length * 0.95) - 1)] : null);

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: W.d, locale: 'es-CR' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') report.console.push(m.text()); });
page.on('pageerror', (e) => report.console.push(`pageerror: ${e.message}`));

const shot = async (name, size = 'd', full = true) => {
  await page.setViewportSize(W[size]);
  await page.waitForTimeout(350);
  const f = `${OUT}/${name}-${size === 'd' ? 1440 : 390}.png`;
  await page.screenshot({ path: f, fullPage: full, scale: 'css' });
  report.states.push(f);
};

// A virtualized list only holds the rows near the viewport, so a full-page
// capture of one shows empty space by design. The list therefore also gets a
// viewport-sized shot scrolled onto it — that is what the list actually looks
// like to a reader.
const shotList = async (name, size = 'd') => {
  await page.setViewportSize(W[size]);
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const ul = [...document.querySelectorAll('main ul')].sort(
      (a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    if (ul) window.scrollTo(0, ul.getBoundingClientRect().top + window.scrollY - 90);
  });
  await page.waitForTimeout(450);
  const f = `${OUT}/${name}-${size === 'd' ? 1440 : 390}.png`;
  await page.screenshot({ path: f, fullPage: false, scale: 'css' });
  report.states.push(f);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
};

const shotDialog = async (name, size = 'd') => {
  await page.setViewportSize(W[size]);
  await page.waitForTimeout(350);
  const f = `${OUT}/${name}-${size === 'd' ? 1440 : 390}.png`;
  await page.screenshot({ path: f, fullPage: false, scale: 'css' });
  report.states.push(f);
  await page.evaluate(() => {
    const d = document.querySelector('aside[role=dialog]');
    if (d) d.scrollTop = d.scrollHeight;
  });
  await page.waitForTimeout(450);
  const f2 = `${OUT}/${name}-fondo-${size === 'd' ? 1440 : 390}.png`;
  await page.screenshot({ path: f2, fullPage: false, scale: 'css' });
  report.states.push(f2);
  await page.evaluate(() => {
    const d = document.querySelector('aside[role=dialog]');
    if (d) d.scrollTop = 0;
  });
  await page.waitForTimeout(250);
};

const overflowAt = async (label) => {
  for (const [k, v] of Object.entries({ 1440: W.d, 768: { width: 768, height: 900 }, 390: W.m })) {
    await page.setViewportSize(v);
    await page.waitForTimeout(220);
    const o = await page.evaluate((vw) => {
      const docW = document.documentElement.scrollWidth;
      if (docW <= vw + 1) return null;
      const el = [...document.querySelectorAll('*')].find((e) => e.getBoundingClientRect().right > vw + 1);
      return { docW, tag: el ? `${el.tagName}.${String(el.className).split(' ')[0]}` : '?' };
    }, v.width);
    if (o) report.overflow.push({ label, bp: k, ...o });
  }
  await page.setViewportSize(W.d);
};

const waitCatalog = () => page.waitForFunction(
  () => document.body.textContent && !document.body.textContent.includes('Cargando el catálogo'),
  null, { timeout: 20000 },
);

/* ---------- 1. cold load → search interactive, on simulated Fast 3G ---------- */
{
  const c2 = await browser.newContext({ deviceScaleFactor: 1, viewport: W.m });
  const pg2 = await c2.newPage();
  const cdp = await c2.newCDPSession(pg2);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
  });
  const t0 = Date.now();
  await pg2.goto(`${BASE}/buscar`, { waitUntil: 'domcontentloaded' });
  await pg2.waitForFunction(() => {
    const g = window;
    return typeof g.__searchReady === 'undefined' ? document.querySelector('input[type=search]') !== null : g.__searchReady;
  }, null, { timeout: 30000 });
  await pg2.fill('input[type=search]', 'samsung');
  await pg2.waitForFunction(() => document.querySelectorAll('main ul li').length > 1, null, { timeout: 30000 });
  report.budgets.coldLoadToSearchMs_fast3g = Date.now() - t0;
  await pg2.screenshot({ path: `${OUT}/loading-cold-390.png`, fullPage: false, scale: 'css' });
  await c2.close();
}

/* ---------- 2. skeleton state (products.json deliberately slow) ---------- */
{
  const c3 = await browser.newContext({ deviceScaleFactor: 1, viewport: W.d });
  const pg3 = await c3.newPage();
  await pg3.route('**/data/products.json', async (r) => { await new Promise((k) => setTimeout(k, 6000)); r.continue(); });
  await pg3.goto(`${BASE}/buscar`, { waitUntil: 'domcontentloaded' });
  await pg3.waitForTimeout(900);
  await pg3.screenshot({ path: `${OUT}/loading-1440.png`, fullPage: true, scale: 'css' });
  await pg3.setViewportSize(W.m);
  await pg3.waitForTimeout(250);
  await pg3.screenshot({ path: `${OUT}/loading-390.png`, fullPage: true, scale: 'css' });
  report.states.push(`${OUT}/loading-1440.png`, `${OUT}/loading-390.png`);
  await c3.close();
}

/* ---------- 3. home ---------- */
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await waitCatalog();
await shot('home', 'd');
await shot('home', 'm');
await shotList('home-list', 'd');
await shotList('home-list', 'm');
await overflowAt('home');

/* ---------- 4. results + keystroke budget ---------- */
await page.goto(`${BASE}/buscar`, { waitUntil: 'networkidle' });
await waitCatalog();
await page.evaluate(() => { window.__vq = []; });
const input = page.locator('header input[type=search]');
for (const term of ['samsung', 'refrigeradora', 'wrw32', 'lg french', 'lavadora 18']) {
  await input.fill('');
  await page.waitForTimeout(120);
  await input.type(term, { delay: 90 });
  await page.waitForTimeout(300);
}
const vq = await page.evaluate(() => window.__vq || []);
report.budgets.keystrokeToPaintedMs = {
  n: vq.length,
  p50: [...vq].sort((a, b) => a - b)[Math.floor(vq.length / 2)],
  p95: p95(vq),
  max: Math.max(...vq),
};
await input.fill('');
await page.waitForTimeout(400);
await shot('results', 'd');
await shot('results', 'm');
await shotList('results-list', 'd');
await shotList('results-list', 'm');
report.budgets.domRowsAtRest = await page.evaluate(
  () => document.querySelectorAll('main ul li').length);
await overflowAt('results');

/* ---------- 5. detail overlay budget + states ---------- */
/* The row is a real <a href="/producto/…"> now, intercepted into the overlay by
   `@modal/(.)producto/[slug]`. Two numbers, because they are two different
   truths: WARMED is what a human gets (pointerenter / touchstart / focus fires
   ProductLink's router.prefetch before the click), COLD is a synthetic click
   with no intent signal at all. Reporting only the flattering one would be the
   same class of dishonesty as the freshness stamp this build fixed. */
const openFirst = async (nth = 0, warm = true) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  if (warm) {
    const links = page.locator('main li a').filter({ hasText: /^Ver / });
    const n = await links.count();
    if (n) {
      await links.nth(Math.min(nth, n - 1)).hover();
      await page.waitForTimeout(220);
    }
  }
  return page.evaluate((n) => new Promise((res, rej) => {
  const btns = [...document.querySelectorAll('main li a')].filter((b) => (b.textContent || '').startsWith('Ver '));
  if (!btns.length) { rej(new Error('no row hit links found')); return; }
  const t0 = performance.now();
  btns[Math.min(n, btns.length - 1)].click();
  const tick = () => {
    const el = document.querySelector('aside[role=dialog]');
    if (el && el.textContent.includes('La evidencia')) {
      requestAnimationFrame(() => setTimeout(() => res({ ms: performance.now() - t0, spinner: /Cargando|cargando/.test(el.textContent) }), 0));
    } else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), nth);
};

for (const [key, warm] of [['detailOpenMs', true], ['detailOpenColdMs', false]]) {
  const opens = [];
  for (let i = 0; i < 8; i++) {
    const r = await openFirst(i % 4, warm);
    opens.push(r.ms);
    if (r.spinner) report.budgets.detailSpinner = true;
    await page.goBack();
    await page.waitForTimeout(160);
  }
  report.budgets[key] = { n: opens.length, p50: [...opens].sort((a, b) => a - b)[Math.floor(opens.length / 2)], p95: p95(opens), max: Math.max(...opens) };
}
report.budgets.detailSpinner ??= false;

// a gap product (badge in the row) — the outlier sheet
await openFirst(0);
await page.waitForTimeout(500);
await shotDialog('detail', 'd');
await shotDialog('detail', 'm');
await overflowAt('detail');
report.budgets.urlIsCanonicalOnOpen = /\/producto\//.test(page.url());
await page.goBack();
await page.waitForTimeout(300);
report.budgets.backClosesSheet = (await page.locator('aside[role=dialog]').count()) === 0;

// a parejo product — negative-markup / no-winner sheet
{
  const idParejo = await page.evaluate(async () => {
    const res = await fetch('/data/products.json');
    const all = await res.json();
    const cands = all.filter((x) => x.offers.length > 1 && x.markup_pct !== null && x.markup_pct < 0);
    const calm = all.filter((x) => {
      if (x.offers.length < 2) return false;
      const p = x.offers.map((o) => o.price_crc).sort((a, b) => a - b);
      return (p[p.length - 1] - p[0]) / p[0] * 100 < 5;
    });
    return (cands[0] || calm[0]).id;
  });
  await page.goto(`${BASE}/producto/${idParejo}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await shot('producto-page-parejo', 'd');
  await shot('producto-page-parejo', 'm');
  await overflowAt('producto-page-parejo');
}

/* ---------- 6. compare tray ---------- */
// deterministic: three known ids, opened by URL, so the tray fills the same way
// every run regardless of what the virtual window happens to be showing
{
  const ids = await page.evaluate(async () => {
    const all = await (await fetch('/data/products.json')).json();
    const pick = all.filter((x) => x.offers.length > 1).slice(0, 3);
    return pick.map((x) => x.id);
  });
  for (const id of ids) {
    // a COLD hit on the canonical URL — the standalone page, not the overlay.
    // It carries the same actions, which is the point of the check.
    await page.goto(`${BASE}/producto/${id}`, { waitUntil: 'networkidle' });
    const add = page.locator('button').filter({ hasText: /^Comparar$/ });
    if (await add.count()) await add.first().click();
    await page.waitForTimeout(150);
  }
  await page.goto(`${BASE}/buscar`, { waitUntil: 'networkidle' });
  await waitCatalog();
  await page.waitForTimeout(400);
  report.budgets.trayPersistedAcrossReload = await page.locator('button').filter({ hasText: 'Ver lado a lado' }).count() > 0;
  await shot('tray-docked', 'd', false);
  await shot('tray-docked', 'm', false);
  await page.locator('button').filter({ hasText: 'Ver lado a lado' }).first().click();
  await page.waitForTimeout(500);
  await shotDialog('tray-open', 'd');
  await shotDialog('tray-open', 'm');
  await overflowAt('tray-open');
  await page.locator('[aria-label="Cerrar"]').last().click();
  await page.waitForTimeout(200);
  await page.locator('button').filter({ hasText: /^Vaciar$/ }).first().click();
  await page.waitForTimeout(250);
}

/* ---------- 7. no-match + empty-filter ---------- */
await input.fill('zzzqqq');
await page.waitForTimeout(500);
await shot('no-match', 'd');
await shot('no-match', 'm');
await overflowAt('no-match');
await input.fill('');
await page.waitForTimeout(300);

await page.locator('button').filter({ hasText: /^Con brecha/ }).first().click();
await page.locator('button').filter({ hasText: /^Laptops/ }).first().click();
await page.waitForTimeout(500);
const emptyShown = await page.locator('text=Ningún producto cumple estos filtros').count();
report.budgets.emptyFilterStateRendered = emptyShown > 0;
if (emptyShown) {
  await shot('empty-filter', 'd');
  await shot('empty-filter', 'm');
}
await page.locator('button').filter({ hasText: /^Todos/ }).first().click();
await page.locator('button').filter({ hasText: /^Laptops/ }).first().click();

/* ---------- 8. scroll fps at full catalogue ---------- */
{
  await page.setViewportSize(W.d);
  await page.locator('button').filter({ hasText: /^Todos/ }).first().click();
  await page.waitForTimeout(400);
  const fps = await page.evaluate(() => new Promise((res) => {
    let frames = 0;
    const t0 = performance.now();
    const tick = () => { frames++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(frames / ((performance.now() - t0) / 1000)); };
    let y = 0;
    const scroller = setInterval(() => { y += 220; window.scrollTo(0, y); }, 16);
    setTimeout(() => clearInterval(scroller), 2000);
    requestAnimationFrame(tick);
  }));
  report.budgets.scrollFps = Math.round(fps);
  report.budgets.domRowsWhileScrolling = await page.evaluate(() => document.querySelectorAll('main ul li').length);
}

/* ---------- 9. offline ---------- */
{
  const c4 = await browser.newContext({ deviceScaleFactor: 1, viewport: W.d });
  const pg4 = await c4.newPage();
  await pg4.goto(`${BASE}/buscar`, { waitUntil: 'networkidle' });
  await pg4.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 15000 }).catch(() => {});
  await pg4.waitForTimeout(2500);
  await c4.setOffline(true);
  await pg4.goto(`${BASE}/buscar`, { waitUntil: 'domcontentloaded' }).catch((e) => { report.budgets.offlineNavError = e.message; });
  await pg4.waitForTimeout(2500);
  report.budgets.offlineRowsRendered = await pg4.evaluate(() => document.querySelectorAll('main ul li').length);
  report.budgets.offlineBannerShown = await pg4.locator('text=Sin conexión').count() > 0;
  await pg4.screenshot({ path: `${OUT}/offline-1440.png`, fullPage: true, scale: 'css' });
  await pg4.setViewportSize(W.m);
  await pg4.waitForTimeout(300);
  await pg4.screenshot({ path: `${OUT}/offline-390.png`, fullPage: true, scale: 'css' });
  report.budgets.offlineCatalogRendered = await pg4.evaluate(
    () => document.body.innerText.includes('brechas más grandes'));
  report.states.push(`${OUT}/offline-1440.png`, `${OUT}/offline-390.png`);
  await c4.close();
}

/* ---------- 10. index.json transfer size ---------- */
{
  const c5 = await browser.newContext();
  const pg5 = await c5.newPage();
  const sizes = {};
  pg5.on('response', async (r) => {
    if (/\/data\/.*\.json$/.test(r.url())) {
      const h = await r.allHeaders();
      sizes[r.url().split('/').pop()] = Number(h['content-length'] || 0);
    }
  });
  await pg5.goto(`${BASE}/buscar`, { waitUntil: 'networkidle' });
  report.budgets.artifactTransferBytes = sizes;
  await c5.close();
}

await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
