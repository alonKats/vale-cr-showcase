#!/usr/bin/env node
/* ==========================================================================
   THE CONSENT GATE — assertions 26 and 27 (design-v5 §6.2)

   These are THE ONLY TWO ASSERTIONS IN v5 THAT CAN MAKE US LEGALLY WORSE OFF IF
   THEY ARE SKIPPED. The principle: "A banner that sets cookies
   before the click is worse than no banner, because it documents intent to comply
   while not complying… verified by loading the site fresh and confirming no GA4
   cookie exists before consent — a functional.mjs-style assertion, not an eyeball."

   ---- WHY THEY LIVE HERE AND NOT IN scripts/verify/functional.mjs ----
   §6.2 says "new assertions for functional.mjs". That file is a shared Tier-0
   gate used across projects; GA4-and-Ley-8968 assertions are vale-specific and
   belong beside this project's own measure.mjs / seo-check.mjs / contrast.mjs,
   which is where every other vale gate already lives. Same idiom, same JSON shape,
   same exit code. Flagged rather than done silently.

   ---- 26. NO ANALYTICS BEFORE CONSENT ----
   Fresh context, no cookies. Load /, settle, then assert:
     · no request to google-analytics.com / googletagmanager.com / doubleclick
     · document.cookie carries no _ga, no _ga_*, no _gid
     · dataLayer carries a `consent default` with analytics_storage: 'denied'
   THEN click Aceptar and assert the state actually flips.

   "HALF THIS TEST IS WORTHLESS: PROVING NOTHING FIRES WHILE NOTHING WORKS PROVES
   NOTHING." That is §6.2's own warning and it is live on this build — the analytics
   tag itself (components/Analytics.tsx) is in an UNMERGED PR, and the GTM container
   that gates it is deliberately unpublished (the container is unpublished). So
   the positive half is split in two:

     26c  THE SIGNAL — after Aceptar, dataLayer carries a `consent update` with
          analytics_storage: 'granted'. PROVABLE TODAY, and it is the thing that
          actually unblocks the tag under Consent Mode v2. Asserted unconditionally.
     26d  THE NETWORK — after Aceptar the Google requests fire. Provable only on a
          build that HAS a tag. Asserted when one is detected; when none is, the run
          reports `analytics-tag-absent-so-the-network-half-is-vacuous` as a
          violation, because a check that measures nothing must not pass quietly.
          `--no-tag-expected` downgrades it to a note for a build that is
          deliberately tag-free.

   ---- 27. AFTER A REJECTION, EXACTLY ONE COOKIE EXISTS, AND IT IS THE RECORD ----
   Fresh context → click Rechazar → document.cookie must parse to exactly ONE entry,
   named vale_consent, with c: "denied". Then reload and assert THE GATE DOES NOT
   RETURN. A banner that re-nags a refusal is the pattern Ley 8968's "free consent"
   language exists to prevent, and it is also the only way this design costs the
   fold more than once.

   Usage: node scripts/consent-check.mjs <base-url> [--no-tag-expected]
   ========================================================================== */

import { chromium } from 'playwright';

const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) {
  console.error('usage: node scripts/consent-check.mjs <base-url> [--no-tag-expected]');
  process.exit(2);
}
const NO_TAG_EXPECTED = process.argv.includes('--no-tag-expected');

const GOOGLE = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|google\.[a-z.]+\/(ads|pagead)/i;
const GA_COOKIE = /(^|;\s*)(_ga|_ga_[^=]+|_gid)=/;

const out = { check: 'consent-v5', base, pass: true, violations: [], notes: [], measured: {} };
const fail = (v) => { out.pass = false; out.violations.push(v); };

const browser = await chromium.launch();

/** a context that has never seen this origin — the first-visit state, by construction */
async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const hits = [];
  ctx.on('request', (r) => { if (GOOGLE.test(r.url())) hits.push(r.url()); });
  const page = await ctx.newPage();
  return { ctx, page, hits };
}

const readLayer = (page) => page.evaluate(() => {
  const dl = window.dataLayer || [];
  // Consent Mode pushes an `arguments` object, which is array-LIKE, not an array.
  return [...dl].map((e) => {
    if (e && typeof e === 'object' && 'length' in e) return Array.from(e).map((x) => (typeof x === 'object' ? { ...x } : x));
    return e;
  });
});

const consentEntries = (layer, kind) =>
  layer.filter((e) => Array.isArray(e) && e[0] === 'consent' && e[1] === kind);

/* ---------------------------------------------------------------- 26 ---- */
{
  const { ctx, page, hits } = await fresh();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });

  const before = {
    googleRequests: [...hits],
    cookie: await page.evaluate(() => document.cookie),
    layer: await readLayer(page),
    /* is there an analytics tag on this build AT ALL? Without one, the negative
       half below is true for the wrong reason. */
    tagPresent: await page.evaluate(() =>
      [...document.scripts].some((s) => /googletagmanager\.com|google-analytics\.com/.test(s.src || '')
        || /gtm\.js|gtag\(/.test(s.textContent || '') && /gtm\.start|gtag\/js/.test(s.textContent || ''))),
  };

  if (before.googleRequests.length) {
    fail({ rule: 'analytics-request-before-consent', n: before.googleRequests.length, urls: before.googleRequests.slice(0, 4) });
  }
  if (GA_COOKIE.test(before.cookie)) {
    fail({ rule: 'ga-cookie-set-before-consent', cookie: before.cookie.slice(0, 200) });
  }

  const defaults = consentEntries(before.layer, 'default');
  if (!defaults.length) {
    fail({
      rule: 'no-consent-mode-default-on-the-page',
      note: 'the default MUST be pushed before any tag can load — that ordering is what makes "no analytics before consent" true by CONSTRUCTION rather than by timing',
    });
  } else if (defaults.some((d) => d[2]?.analytics_storage !== 'denied')) {
    fail({ rule: 'consent-mode-default-is-not-denied', entries: defaults });
  }

  // now the positive half
  const accept = page.locator('[data-consent-action="granted"]');
  if (!(await accept.count())) {
    fail({ rule: 'no-accept-control-on-a-fresh-visit', note: 'a gate that measures nothing must fail' });
  } else {
    await accept.click();
    await page.waitForTimeout(1200);
    const updates = consentEntries(await readLayer(page), 'update');
    if (!updates.some((u) => u[2]?.analytics_storage === 'granted')) {
      fail({
        rule: 'accept-does-not-push-a-consent-update',
        note: '26c — the signal that actually unblocks the tag under Consent Mode v2',
        updates,
      });
    }
    const after = hits.filter((u) => !before.googleRequests.includes(u));
    out.measured.afterAcceptGoogleRequests = after.length;
    if (before.tagPresent) {
      if (!after.length) {
        fail({ rule: 'accept-does-not-let-the-tag-fire', note: '26d — a tag is present and it still did not request' });
      }
    } else {
      const vacuous = {
        rule: 'analytics-tag-absent-so-the-network-half-is-vacuous',
        note: '26d — no GA4/GTM tag on this build, so "nothing fired before consent" is true for the WRONG REASON. components/Analytics.tsx is in an unmerged PR and the GTM container that gates the tag is deliberately unpublished (The owner holds tagmanager.publish). 26a/26b/26c above are still real.',
      };
      if (NO_TAG_EXPECTED) out.notes.push(vacuous);
      else fail(vacuous);
    }
  }

  out.measured.beforeConsent = {
    googleRequests: before.googleRequests.length,
    gaCookie: GA_COOKIE.test(before.cookie),
    consentDefaults: defaults.length,
    analyticsTagPresent: before.tagPresent,
  };
  await ctx.close();
}

/* ---------------------------------------------------------------- 27 ---- */
{
  const { ctx, page } = await fresh();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });

  const reject = page.locator('[data-consent-action="denied"]');
  if (!(await reject.count())) {
    fail({ rule: 'no-reject-control-on-a-fresh-visit' });
  } else {
    await reject.click();
    await page.waitForTimeout(600);

    const cookies = await page.evaluate(() =>
      document.cookie.split(';').map((c) => c.trim()).filter(Boolean));
    out.measured.afterReject = { cookies: cookies.map((c) => c.split('=')[0]) };

    if (cookies.length !== 1) {
      fail({
        rule: 'more-than-one-cookie-after-a-rejection',
        cookies: out.measured.afterReject.cookies,
        note: 'THE STRONGEST SENTENCE AVAILABLE TO US, and /cookies publishes it: with analytics rejected this site keeps exactly ONE cookie — the one that remembers you said no.',
      });
    } else {
      const [name, ...rest] = cookies[0].split('=');
      if (name !== 'vale_consent') {
        fail({ rule: 'the-one-remaining-cookie-is-not-the-consent-record', name });
      } else {
        let rec = null;
        try { rec = JSON.parse(decodeURIComponent(rest.join('='))); } catch { /* below */ }
        if (rec?.c !== 'denied') {
          fail({ rule: 'the-consent-record-does-not-say-denied', rec });
        }
        out.measured.afterReject.record = rec;
      }
    }

    /* THE RE-NAG TEST. A banner that returns after a refusal arguably invalidates
       the "free" quality of consent under Ley 8968. */
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const back = await page.locator('.consent').count();
    if (back) {
      fail({
        rule: 'the-gate-returns-after-a-rejection',
        note: '§4.5 — it is paid once, on one page view, and never again. A re-nag is what would cost the fold repeatedly.',
      });
    }
    out.measured.gateReturnsAfterReject = Boolean(back);
  }
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
