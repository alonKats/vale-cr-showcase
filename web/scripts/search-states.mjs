/* SEARCH STATE GATE — the three things an empty result array can mean.
 *
 * Written 2026-09-01, after the search box spent an unknown period telling
 * visitors «Nada con "samsung"» about a catalogue holding 152 of them. The
 * matching code was correct throughout; what was wrong is that "no answer yet"
 * and "no such product" rendered identically. A unit test could not have caught
 * this — the bug exists only in the window between two parallel fetches, which
 * is why this gate THROTTLES index.json rather than waiting for it.
 *
 * It also caught a second bug that reasoning had missed: once the worker stopped
 * answering early, `ids === null` made applyQuery return the ENTIRE catalogue
 * for a typed query. Different wrong answer, same missing state.
 *
 * A NOTE ON ITS OWN HONESTY: the "catalogue has landed" signal must be the
 * COMPOSED COUNT (`152 productos`), not the bare word `productos`, which also
 * appears in static page copy. With the loose test this gate typed before the
 * catalogue arrived, landed in the skeleton state and reported a failure that
 * was its own. A gate that can produce a false verdict about the thing it exists
 * to verify is worth exactly nothing.
 *
 *   node scripts/search-states.mjs [base-url]      default: production
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.BASE || 'https://vale.cr';
const out = [];
const ok = (name, pass, detail = '') => {
  out.push(`${pass ? ' ok  ' : 'FAIL '} ${name}${detail ? '  — ' + detail : ''}`);
  return pass;
};

const browser = await chromium.launch();

// ---- 1. THE FALSE NEGATIVE. Throttle index.json so a keystroke certainly
//         beats it, then type and read what the page claims.
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route('**/data/index.json', async (route) => {
    await new Promise((r) => setTimeout(r, 9000));      // index arrives late
    await route.continue();
  });
  await page.goto(`${BASE}/buscar`, { waitUntil: 'domcontentloaded' });
  // wait for the CATALOGUE to land — that is the window this bug lived in:
  // products.json present, index.json not. Proven by the count line appearing.
  await page.waitForFunction(() => /\d[\d.]*\s+productos/i.test(document.body.innerText), null, { timeout: 8000 })
    .catch(() => {});
  await page.locator('input[aria-label="Buscar un producto"]').type('samsung', { delay: 40 });
  await page.waitForTimeout(600);                       // index still in flight
  const body = await page.locator('body').innerText();
  ok('during index load, does NOT claim the catalogue is empty',
     !/Nada con/i.test(body), `saw: ${(body.match(/Nada con[^\n]*/i) || ['—'])[0]}`);
  ok('during index load, says it is searching',
     /Buscando/i.test(body), (body.match(/Buscando[^\n]*/i) || ['not found'])[0]);
  await page.waitForTimeout(9000);                      // index lands
  const after = await page.locator('body').innerText();
  ok('once the index lands, real results replace the pending state',
     !/Buscando «/i.test(after) && /productos?/i.test(after),
     (after.match(/[\d.]+\s+productos?/i) || ['—'])[0]);
  await ctx.close();
}

// ---- 2. THE SUGGESTION PANEL, on a surface that is not /buscar
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const input = page.locator('input[aria-label="Buscar un producto"]');
  await input.click();
  await input.type('samsung', { delay: 60 });
  await page.waitForTimeout(900);
  const panel = page.locator('#find-suggest');
  ok('panel opens as you type on the home page', await panel.isVisible());
  const rows = panel.locator('[role="option"]');
  const n = await rows.count();
  ok('panel offers suggestions', n > 0, `${n} rows`);
  ok('typing no longer throws you to /buscar before you finish',
     new URL(page.url()).pathname === '/', page.url());
  const first = await rows.first().innerText();
  const href = await rows.first().getAttribute('href');
  ok('a row points at a product page', Boolean(href?.startsWith('/producto/')), `${href}`);
  await page.screenshot({ path: process.env.SHOT || '/tmp/vale-suggest.png' });
  // keyboard: ArrowDown then Enter must open the highlighted row
  await input.press('ArrowDown');
  await input.press('Enter');
  await page.waitForURL(/\/producto\//, { timeout: 8000 }).catch(() => {});
  ok('ArrowDown + Enter opens the highlighted suggestion',
     new URL(page.url()).pathname.startsWith('/producto/'), page.url());
  out.push(`       first row: ${first.replace(/\s+/g, ' ').slice(0, 70)}`);
  await ctx.close();
}

// ---- 3. the panel must NOT cover the results page, which is its own answer
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/buscar`, { waitUntil: 'networkidle' });
  const input = page.locator('input[aria-label="Buscar un producto"]');
  await input.click();
  await input.type('lg', { delay: 60 });
  await page.waitForTimeout(700);
  ok('no panel over /buscar', !(await page.locator('#find-suggest').isVisible()));
  await ctx.close();
}

await browser.close();
console.log(out.join('\n'));
console.log(out.some((l) => l.startsWith('FAIL')) ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);
