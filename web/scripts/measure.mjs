#!/usr/bin/env node
/* THE LAYOUT GATE — v4 §2.4/§2.5 + v4.1 §5.3/§7.2.

   ---- WHY THIS FILE EXISTS AT ALL ----
   v3's `PriceChart` declared `font-size: 12` on SVG `<text>`. It rendered at 4.9 CSS px
   at 1024 and 23.7px at 767 — invisible at one width, oversized at the other, correct
   at neither of the two widths it was designed at. Cause: `width: 100%` over a fixed
   `viewBox` makes SVG user-space coordinates A RUBBER SHEET, so a declared font-size is
   a RATIO, not a size. v3 shipped "two viewBoxes" as the fix and the bug survived,
   because two viewBoxes covered 1440 and 390 and THE FAILURE LIVED BETWEEN THEM.

   ---- TWELVE WIDTHS, NOT THREE — AND EVERY DECLARED BOUNDARY AS A PAIR (v4.1 §5.3) ----
   `functional.mjs` tests 1440 / 768 / 390 and the v3 bug lived at 1024 and 767 —
   precisely in the gaps. BAND EDGES ARE WHERE THESE BUGS LIVE, AND A SINGLE WIDTH ON
   ONE SIDE OF AN EDGE IS NOT EVIDENCE, so every boundary is tested as a PAIR:

     320   the floor. Cards at 144, titles clamp at 2 lines
     390   the mobile design width                       card 179
     539   last width before --pad drops to 12           card 253.50
     540   first width of the 20px pad, 2-up             card 242
     639   last 2-up width                              card 291.50
     640   FIRST 3-UP WIDTH — a declared boundary        card 189.33
     768   the 3-up design width. NO LONGER A RAZOR EDGE — 128px inside a band
     1023  last 3-up width                              card 317
     1024  FIRST 4-UP WIDTH — a declared boundary        card 234
     1239  one px before the shell cap binds             card 287.75
     1240  the narrowest 4-up at the old cap             card 288
     1440  the desktop design width                     card 328

   v4.1 replaced `auto-fill` with three declared column counts, so 640/1024 joined the
   list: they are now the ONLY two widths where the column count changes, and a
   transition nobody tests is a transition that ships broken. 768 moved OFF an edge
   (it was floor(3.000) exactly) and is now a safe interior width — which is the
   concrete proof the declared construction beats the derived one.

   ---- THE ASSERTIONS ----
     1. SVG user space is 1:1 with CSS px for any `<text>` inside a [data-scales] node.
        This is the assertion that would have caught the v3 bug.
     2. Every [data-scales] node's rendered box is inside the band DECLARED ON THE NODE
        (`data-band-min` / `data-band-max`). The band travels with the element rather
        than living in a table in this file, so it cannot drift away from the thing it
        describes.
     3. Proportional bars: `bar.offsetWidth / track.offsetWidth` within ±0.02 of
        `data-pct` — THE PIXELS COMPARED TO THE DATA, never to a second rendering. A bar
        rendered correctly but computed from the wrong number is a false claim about
        savings, and two derived artifacts agreeing proves nothing: reconcile
        against the issuing system, not a second derived artifact.
        A multi-segment track additionally asserts its segments SUM TO THE TRACK ±1px.
     4. Fixed row heights EQUAL their token, and no row's content exceeds its own box. A
        uniform row height is a design CLAIM, and a fixed height its own content
        overflows is a broken promise, not a nit.
     5. No `·` may start, end, or sit alone on a RENDERED LINE. A separated list that is
        allowed to wrap will, at some width, put a separator at a line boundary; gluing
        it to a neighbour only moves which boundary. So the gate asserts the OUTCOME
        rather than the construction. Line membership comes from
        `Range.getClientRects()`, which returns ONE RECT PER LINE BOX — a text node's
        bounding rect makes a two-line node look like it sits on its first line and
        produces false hits.
     6. Chart labels: for any two `<text>` nodes in one SVG whose x-extents overlap,
        |Δy| must be at least the larger font size. Geometric, in the SVG's own units —
        a price-difference threshold can never predict a pixel collision, because
        pixels-per-colón is set by the y-axis range.

   ---- THREE v4.1 ASSERTIONS: EACH TURNS A TASTE RULE INTO A NUMBER (§7.2) ----
     8. THE PHOTOGRAPHY FLOOR. Rendered image area ≥ 14% of page area at 1440.
        THIS IS THE REGRESSION TEST FOR ALON'S ACTUAL COMPLAINT. The v4 build measured
        7.05% against zap's ~14%; "missing a lot of colour" is now a FAILING BUILD
        rather than a review comment, and it is the assertion that matters six weeks
        from now — the day someone shrinks a thumbnail back to 120 to win some
        vertical space, this fails and says why. IT IS ALSO THE ASSERTION THAT NOW
        CARRIES THE CHROMA ARGUMENT ALONE: v4.1-fix B6 took the solid --ink fill off
        24 card CTAs, and the defence of that trade is that --ink is a dark NEUTRAL and
        never contributed chroma — the photography did, and this number proves it.
     9. THE AMBER PAGE-AREA CEILING IS DELETED (v4.1-fix N2). "--loud fill < 1.5% of
        page area at 1440" is a BAD METRIC, not a badly-tuned one: %-of-page-area falls
        as the page grows, so 800px of extra footer makes the gate pass HARDER. It
        rewards exactly the bloat this project spent two versions removing. Measured
        2.28% on /buscar at 320 with an IDENTICAL object count (24) and identical chip
        sizes — the page simply got shorter relative to its chips. 2.28% is accepted;
        the metric is rejected. Replaced by 15 and 16 below, neither of which can be
        gamed by page length.
    10. THE STICKY-CHROME CEILING. Sticky chrome ≤ 12% of the viewport, at EVERY
        width. It was 243.5px sticky at 390 — 28.8% of an 844 viewport, permanently,
        with the first price at y=806. STICKY COST IS PAID ON EVERY PIXEL OF SCROLL,
        not once, which is why it is a ratio against the viewport and not a raw px cap.

   8 is measured at 1440 only, because it is a claim about a rendered PAGE and the spec
   states it at the design width. 10 runs at every width — the defect it guards lived at
   390 and would have passed a desktop-only check.

   ---- EIGHT v4.1-FIX ASSERTIONS. EVERY ONE OF THEM GUARDS A DEFECT THAT PASSED THIS
        ENTIRE GATE STACK ONCE (design-critique-v41.md) ----

   The critique's own summary is the reason these exist: "every defect above passed
   every deterministic check we own." Three of them are defect CLASSES rather than
   single bugs, and those three are 13, 14 and 17.

    11. B3 — ONE PRICE BASELINE PER GRID ROW, ONE HEIGHT PER CARD. Cards in a row are
        grid items and were already equal in HEIGHT; what differed was where their
        CONTENT started, because the ribbon's reserved slot (18px) was shorter than a
        rendered ribbon (22.09px). So a mixed row put four prices on two baselines and
        the row pitch went 412 / 412 / 407.
    12. B5 — THE LONGEST PRICE IN THE ARTIFACT, RENDERED AT --t7, FITS ITS SLOT AT
        EVERY GATED WIDTH. Not the current price: the LONGEST ONE THE DATA CONTAINS,
        injected into the real node and measured. Without this the nowrap fix has a
        shelf life of one catalogue refresh — and the fix's 340→360 widening buys 22px
        of slack but NOT an eleventh glyph, so this assertion is the actual protection.
    13. DEFECT CLASS — B7 — NO --plate ELEMENT MAY BE A LETTERBOX. Matched on the
        computed background-image (the --plate radial gradient), never on a class name,
        so a fourth plate introduced anywhere is measured too. Two of the three plate
        instances shipped as landscape boxes with a contained portrait object in them.
    14. DEFECT CLASS — B4 — A RESERVED INDICATOR MUST BE FILLED BY A NON-HOVER
        STATE. Any interactive element computing a border/outline ≥1px whose colour is
        fully transparent is a RESERVED KEYLINE; the gate then walks every stylesheet
        rule for that element's classes and requires at least one non-`:hover` state
        (`:target`, `[aria-current]`, `[aria-pressed]`, `[aria-selected]`, `[data-*]`,
        `:checked`, `.is-*`) to set a non-transparent border colour. HOVER DOES NOT
        COUNT, and that exclusion is the whole point: the tab strip's 2px
        `rgba(0,0,0,0)` track DID have a hover rule, and a page at rest — or any touch
        device — still had no indicator on any of 2.170 product pages. a11y passed
        because axe does not require `aria-current` on in-page anchors; contrast passed
        because there is nothing to contrast.
    15. N2a — AT MOST ONE --loud OBJECT PER CARD / OFFER ROW / PLATE. A count, not an
        area, and width-independent. This is the invariant that actually protects
        "loud stays loud".
    16. N2b — AMBER ≤ 2.5% OF THE DENSEST 100vh WINDOW. Measured at the worst window
        rather than averaged over the document, so a longer page cannot dilute it.
    17. DEFECT CLASS — B8 — THE TYPE LADDER, AS THREE NUMBERS:
          a. NO 12px NODE CARRIES A SENTENCE. A visible --t1 text node longer than 60
             characters fails, unless it is declared single-line-truncating
             (`white-space: nowrap` + `text-overflow: ellipsis`), which a paragraph
             never is. This is the assertion that encodes the rule "everything that is
             a sentence goes to 14px" — measured worst cases today are 43 and 38 chars.
             A GLOBAL "12px < 35% of nodes" RATIO IS DELIBERATELY NOT USED: on a browse
             grid three legitimate floor nodes per card × 24 cards is ~40% of the page
             BY DESIGN, so that metric moves with page composition instead of with the
             defect — the same error as the deleted amber ceiling. The share is
             REPORTED at every width instead.
          b. --t5 (26) CARRIES AT MOST TWO ROLES, where a role is a
             (font-weight × text-transform) signature over visible nodes. §1.2
             authorised exactly two (the h2 and the card price) and the build had
             three, with a heading at 26 sitting 65px above three offer prices at 26.
          c. --t7 (44) APPEARS ON AT MOST ONE NODE PER PAGE, and that node must be the
             verdict price (`[data-verdict-price]`). "44 is the best/only price and
             nothing else, ever" is the hardest type rule in the product and it was
             entirely ungated.
          d. A32 — --t8 (56) APPEARS AT MOST ONCE PER PAGE, and that node must sit
             inside the page's own `[data-w="1"]` group. Same shape as c, one step up:
             56 is the answer plate's figure and it is a ROLE, not a style. The designer's
             wording (Wave-H critique §6.7), NOT v7.2 §8.2's — "exactly once on `/` and
             nowhere else in the product" would forbid `GapStrip` its own intended 56
             on /brechas forever, and a gate that forbids something correct gets
             relaxed later. Vacuously true below 360, where the figure steps to --t6.
    18. v7 §2.4 — THE HERO ROW'S PHOTO PLATE AND VERDICT PLATE REPORT AN IDENTICAL
        **TOP** at every width ≥768. IT ASSERTED THE BOTTOM UNTIL v7, and the swap is a
        design ruling: filling the row made the plate's height come from the photograph
        rather than from its own content, which put a ~90px hole in it on 88% of the
        catalogue. The plate is content-height now and top-aligned. Measured before the
        original fix: T3 missed by 9px and T4 BY 1px, and 1px is the worse of the two —
        9px reads as "not aligned", 1px reads as a rendering fault, and that is what
        makes a careful reader distrust the rest of the page. See the assertion itself
        for why the scope widens from ≥1024 back to ≥768.
    18b. v7 §2.4 — AND THE PLATE'S HEIGHT IS ITS OWN CONTENT'S HEIGHT. 18 ALONE
        CANNOT SEE THE DEFECT IT REPLACED: a shared top is a property of the row, which
        `align-items: start` hands over for free, so `align-self: stretch` — the exact
        v4.1 N5 mechanism that put the ~90px hole in the plate — shares BOTH edges and
        passes 18 with a top delta of 0.0 (The designer ran the regression rather than assuming
        it). §2.4's actual rule was therefore guarded by nothing. This asserts the rule
        itself: `plateH − contentSpan − padding ≤ 1px`, from the nodes 18 already
        selects, at the same widths, with its own measured-nothing guard.

   ---- AND THE META-ASSERTION ----
   A GATE THAT SELECTS ZERO NODES PASSES, WHICH IS WORSE THAN FAILING. v3 learned this
   once with CSS-Modules-hashed class names. So this prints the node count per width and
   EXITS 1 if any width yields zero `[data-scales]` nodes.

   ---- v5 §6.0 — THE DOCUMENT SURFACE, AND WHY IT IS CLASSIFIED STRUCTURALLY ----

   Point this gate at /privacidad as it stood and it fails on two FALSE POSITIVES:

     zero-data-scales-nodes-selected     — a document page has no [data-scales] node
     zero---plate-elements-selected      — a document page has no product photograph

   Those two are the meta-assertions above, and they are right to exist. What is wrong
   is their SCOPE: they are claims about a PRODUCT surface. A privacy policy with a
   --plate on it would be the defect, not the absence.

   THE FIX IS NOT A PATHNAME LIST. `isBrowseGrid = scales.cards > 4` already sets the
   precedent — classify by what the page IS, so a route added later is classified
   correctly without editing this gate:

     isDoc = the page declares a [data-prose] region AND renders no measurable product

   THE ZERO-NODE META-ASSERTION IS NOT WEAKENED, IT IS RELOCATED. On a document
   surface the "must measure something" guard becomes assertion 19's
   `zero-prose-nodes-on-a-document-surface` — a [data-prose] region with no qualifying
   prose node fails, for exactly the same reason. Assertions 5, 7, 10, 14, 15, 16, 17
   and 24/25 all still apply to a document page and all must pass.

   ---- SEVEN v5 ASSERTIONS (§6.1) ----
    19. THE PROSE MEASURE IS A CHARACTER COUNT, AND `ch` IS NOT A CHARACTER. 1ch in
        Plus Jakarta Sans is the advance of `0` — 0.732em, a tabular figure. The
        average character in es-CR prose measures 0.4705em. THE RATIO IS 1.556, so the
        eight `max-width: 68ch` declarations this codebase shipped rendered 105.8
        characters per line against DESIGN.md §5's 60–75. THE UNIT LIES; THE GATE
        MEASURES CHARACTERS, so a typeface change cannot silently reopen it.
    20. A PARAGRAPH GAP MUST EXCEED ITS OWN LEADING. 24 against a 22.4px line box is
        1.07×; at --s2 (16) the gap is 0.71× the leading and consecutive paragraphs
        read as one block. The one declaration this system genuinely did not have, and
        therefore the one most likely to be "tidied" back to 16.
    21. NO PROSE LINK IS DISTINGUISHED BY COLOUR ALONE (SC 1.4.1).
    22. THE DOCUMENT HEADING LADDER IS h1 > h2 > h3 AND IT STOPS.
    23. AMBER MEANS MONEY YOU KEEP, AND NOTHING ON A DOCUMENT PAGE OR IN THE CONSENT
        GATE IS MONEY. The tempting fourth place is a louder `Aceptar`; this assertion
        is why that temptation costs a build instead of a review comment.
    24. THE CONSENT GATE'S HEIGHT BUDGET — two rules, because one is not enough: a raw
        px cap passes on a tall desktop viewport and a pure ratio passes on a short
        one. Plus: it must never make the document unscrollable. It is a bar, not a
        cookie wall.
    26. v7 §5.4-3 — THE CONSENT BAR MAY NOT OCCLUDE THE FIRST PRICE. Measured
        twice, ten days apart, unchanged: at 390 on T4 the price ran 675–721 against
        a bar starting at 717. THE POINT OF THIS ONE IS THAT EVERY OTHER ASSERTION
        IN THIS FILE PASSED WHILE IT WAS TRUE — the bar was inside its px budget,
        inside its 17% ratio, its two buttons were identical and nothing overflowed.
        A budget is not a position.
    25. REJECT IS NOT HARDER THAN ACCEPT — THE LEGAL REQUIREMENT, EXPRESSED IN PIXELS.
        This is the assertion in the file most likely to rot: it is exactly the rule a
        later "conversion" tweak walks back by four pixels and one shade at a time, and
        nothing else we own would notice.

   Usage: node scripts/measure.mjs <url> [url…]
*/

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const urls = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!urls.length) {
  console.error('usage: node scripts/measure.mjs <url> [url…]');
  process.exit(2);
}

/* THIRTEEN WIDTHS. 767 IS NEW IN THE v4.1-FIX PASS, and its absence was a real hole:
   768 was tested and 767 was not, while ≤767 is the busiest breakpoint in the product —
   it stacks the hero, caps the product shot, and used to carry the `order: -1` that N7
   deleted and a 166px scroll-margin literal that B4 deleted. Every OTHER declared
   boundary was already tested as a pair; this one was tested from one side only, which
   §5.3's own rule says is not evidence. */
const WIDTHS = [320, 390, 539, 540, 639, 640, 767, 768, 1023, 1024, 1239, 1240, 1440];

/** The width the photography claim (§7.2 assertion 8) is stated at. */
const DESIGN_W = 1440;
/** ≥ 14% of page area must be photography. v4 built 7.05%; zap runs ~14%. */
const IMAGE_FLOOR = 0.14;
/** the sticky chrome may cost ≤ 12% of the viewport. It was 28.8% at 390. */
const STICKY_CEIL = 0.12;
/* N2b — amber may occupy ≤ 4% of the DENSEST 100vh window (never of the document).

   THE CRITIQUE SAID 2.5% AND 2.5% DOES NOT SURVIVE ITS OWN RULING. That number was
   carried over from the metric it replaces (%-of-page-area, where /buscar at 320 measured
   2.28% and was EXPLICITLY ACCEPTED) — but the window metric is a different measurement of
   a different thing, and on the accepted build it reads 1.54% at 1440, 2.86% at 390 and
   3.48% at 320. Adopting 2.5% would fail the exact surface the ruling accepts.

   WHY IT RISES AS THE VIEWPORT NARROWS, since that is the part worth knowing before
   tuning it again: amber per unit of scroll is roughly constant (one gap chip per card,
   two card columns below 640) and the chip DOES NOT SHRINK with the column, while the
   denominator is vw × vh. So the ratio is ~inversely proportional to viewport WIDTH. That
   is an honest property, not a flaw — on a 320px screen amber genuinely is a larger share
   of what you see — but it means the ceiling has to be set from a measurement of the
   accepted state, which is what 4% is: 3.48% worst case plus ~15%.

   AND IT IS THE WEAKER HALF OF N2 BY DESIGN. The load-bearing assertion is the object
   COUNT (≤1 --loud object per card / offer row / plate), which is width-independent and
   cannot be diluted or inflated by geometry at all. */
const AMBER_WINDOW_CEIL = 0.04;
/** B8a — a --t1 node longer than this is a sentence, not a caption. Worst real: 43. */
const T1_SENTENCE_CHARS = 60;
/** B8b — --t5 may carry at most two roles (the h2 and the card price). */
const T5_MAX_ROLES = 2;

/* ---- v5 §6.1 constants ---- */
/** 19 — DESIGN.md §5's band, as CHARACTERS. `ch` over-reports by 1.556× here. */
const PROSE_MAX_CHARS = 75;
const PROSE_MIN_CHARS = 45;
/** below this a block is a caption, not prose, and has no measure to breach */
const PROSE_MIN_LEN = 150;
/** 19 — the floor is asserted at ≥390 only. At 320 the measure reads 40.1 characters
 *  and THE VIEWPORT GOVERNS: no CSS can buy characters that do not fit. Accepted on
 *  the same precedent as the 2.28% amber reading at 320 that tokens.css N2 accepts —
 *  the reading is reported at 320, not asserted. */
const PROSE_FLOOR_FROM = 390;
/** 24 — the gate's height budget. Measured: 130 @390 · 74 @768 · 72 @1440. */
const consentPxBudget = (w) => (w < 540 ? 136 : w < 1024 ? 96 : 80);
const CONSENT_PCT_CEIL = 0.17;
/** 25 — labels differ in length, treatment may not */
const CONSENT_WIDTH_TOLERANCE = 0.08;

/* B5 — THE LONGEST PRICE THE ARTIFACT CONTAINS, formatted exactly as lib/format.ts
   formats it (₡ + dot thousands, no decimals — hand-rolled there so Node and the browser
   are byte-identical, and hand-rolled here for the same reason). This is the string the
   gate injects into the real --t7 node and measures. Composed from the artifact, never
   typed: the whole point is that the assertion tracks the next catalogue refresh. */
const DATA = path.join(process.cwd(), 'public', 'data');
const dots = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const LONGEST_PRICE = (() => {
  const products = JSON.parse(readFileSync(path.join(DATA, 'products.json'), 'utf8'));
  let best = '';
  for (const p of products) {
    for (const o of p.offers) {
      const s = `₡${dots(o.price_crc)}`;
      if (s.length > best.length) best = s;
    }
  }
  return best;
})();

/* ==========================================================================
   27 — v7.1 §8.3, THE ONE THAT MATTERS FOR COLOUR.

   > A ramp that does not track the data is decoration wearing a semantic
   > palette, which is the worst outcome available here.

   Every gap object that takes a step declares two things on the node: the band
   the ENGINE binned it into (`data-gap-band`) and, where the object is a single
   product, the percentage that band came from (`data-gap-pct`). This assertion
   closes the loop in both directions:

     a. the declared band is the band the node's OWN NUMBER falls in, re-binned
        here against `meta.gap_distribution.edges` — the artifact's edges, read
        off the artifact, never typed into this file. A chip that says band 2 on
        a 34% product fails even though it renders a perfectly nice amber;
     b. the PAINT matches the band. A node whose background is a ramp value must
        be painting its own step. This is what catches a hand-typed `--loud-3`,
        a stale `--band-fill` and a chip that keeps the flat amber after the
        table moves — none of which any contrast or css-idiom check can see,
        because all four values are legal colours in legal places.

   AND THE EXCLUSION IS ASSERTED THE SAME WAY (§1.4.1). The verdict plate's bar
   carries a band and must NOT paint one: `--loud-4` measures 2.63 on --ink, so
   a ramp step inside the plate is a magnitude signal nobody can see. Any ramp
   value other than --loud found inside an --ink surface fails here — the
   runtime twin of the `#8A5A00 on #002832` banned pair in pairs-v4.json. Two
   gates on one rule because it is the rule a later pass will "finish". */
const BAND_EDGES = (() => {
  const meta = JSON.parse(readFileSync(path.join(DATA, 'meta.json'), 'utf8'));
  return meta.gap_distribution?.edges ?? null;
})();
/* index-aligned with the bands: 0 is the neutral --fill bin, 1–4 the ramp. */
const BAND_FILLS = [
  'rgb(225, 233, 238)',
  'rgb(255, 179, 0)',
  'rgb(219, 146, 0)',
  'rgb(179, 116, 0)',
  'rgb(138, 90, 0)',
];

const out = { check: 'layout-v4.1', widths: WIDTHS, pass: true, violations: [], measured: {} };
const fail = (v) => {
  out.pass = false;
  out.violations.push(v);
};

const browser = await chromium.launch();

for (const url of urls) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
      isMobile: width < 500,
      hasTouch: width < 500,
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // the catalogue is fetched client-side on / and /buscar; cards do not exist until
    // it lands. The static routes already have theirs, so this resolves immediately.
    await page.waitForSelector('[data-scales]', { timeout: 20000 }).catch(() => {});

    const key = `${new URL(url).pathname}@${width}`;

    /* ---- 1 + 2 + 3: everything that scales with its container ---- */
    const scales = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('[data-scales]')];
      const bands = [];
      const ctm = [];
      const bars = [];

      for (const el of nodes) {
        const name = el.getAttribute('data-scales');
        const r = el.getBoundingClientRect();

        // 2. the declared band, read off the node itself
        const min = el.getAttribute('data-band-min');
        const max = el.getAttribute('data-band-max');
        if (min !== null && r.width + 0.5 < Number(min)) {
          bands.push({ name, w: +r.width.toFixed(2), min: Number(min), side: 'below' });
        }
        if (max !== null && r.width - 0.5 > Number(max)) {
          bands.push({ name, w: +r.width.toFixed(2), max: Number(max), side: 'above' });
        }

        // 1. SVG text must live in a 1:1 user space
        for (const t of el.querySelectorAll('text')) {
          const m = t.getScreenCTM();
          if (!m) continue;
          if (Math.abs(m.a - 1) > 0.05) {
            ctm.push({ name, k: +m.a.toFixed(3), text: (t.textContent || '').slice(0, 24) });
          }
        }

        // 3. proportional bars: pixels vs THE DATA
        const track = r.width;
        const segs = [...el.children].filter((c) => c.hasAttribute('data-pct'));
        if (segs.length && track > 0) {
          let sum = 0;
          for (const seg of segs) {
            const want = Number(seg.getAttribute('data-pct'));
            const got = (seg.getBoundingClientRect().width / track) * 100;
            sum += seg.getBoundingClientRect().width;
            // ±0.02 of the ratio == ±2 percentage points, plus a 1px sub-pixel floor
            if (Math.abs(got - want) > Math.max(2, (1 / track) * 100)) {
              bars.push({ name, want: +want.toFixed(2), got: +got.toFixed(2), track: +track.toFixed(1) });
            }
          }
          // a MULTI-segment track must also fill it exactly
          if (segs.length > 1 && el.hasAttribute('data-track')) {
            if (Math.abs(sum - track) > 1) {
              bars.push({ name, rule: 'segments-do-not-sum-to-track', sum: +sum.toFixed(2), track: +track.toFixed(2) });
            }
          }
        }
      }
      /* the ProductCard count specifically — it is what distinguishes a BROWSE grid
         from a product page's 4-card similar rail (see the photography floor below). */
      const cards = nodes.filter((el) => el.getAttribute('data-scales') === 'ProductCard').length;
      /* v5 §6.0 — the STRUCTURAL half of the document classifier. A [data-prose]
         region is what a document surface declares about itself; the other half
         (no measurable product) is `count === 0` below. */
      const prose = Boolean(document.querySelector('[data-prose]'));
      const shot = Boolean(document.querySelector('[data-scales="product-shot"]'));
      return { count: nodes.length, cards, bands, ctm, bars, prose, shot };
    });

    /* v5 §6.0. Assertions 2, 8, 12, 13 and 18 are claims about a PRODUCT surface
       and do not apply here — a privacy policy with a --plate on it would be the
       defect, not the absence. THE ZERO-NODE META-ASSERTION IS NOT WEAKENED, IT IS
       RELOCATED: on a document surface it becomes assertion 19's
       `zero-prose-nodes-on-a-document-surface`.

       THE PREDICATE IS "NO MEASURABLE PRODUCT", NOT "NO [data-scales] NODE AT ALL",
       AND THE FIRST RUN PROVED WHY. §6.0 operationalised it as `scales.count === 0`;
       /metodologia reuses `TrustBand` verbatim at its foot, and TrustBand's freshness
       distribution IS a [data-scales] node — a measurement instrument, not a product.
       So the page classified as a product surface and failed
       `zero---plate-elements-selected` at all 13 widths for exactly the wrong reason.
       Counting PRODUCTS (ProductCards and the product shot) instead of gate hooks is
       both stricter and correct: a browse page still cannot enter this branch, and a
       document page that borrows one instrument no longer leaves it. */
    const isDoc = scales.prose && scales.cards === 0 && !scales.shot;

    /* ---- 4: fixed row heights ---- */
    const rows = await page.evaluate(() => {
      const els = [...document.querySelectorAll('[data-row]')];
      const heights = new Set();
      const overflow = [];
      els.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        heights.add(Math.round(r.height));
        if (el.scrollHeight > Math.ceil(r.height) + 1) {
          overflow.push(`row ${i}: content ${el.scrollHeight} > box ${Math.round(r.height)}`);
        }
      });
      const read = (n) =>
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) || null;
      const mobile = window.matchMedia('(max-width: 767px)').matches;
      return {
        count: els.length,
        heights: [...heights].sort((a, b) => a - b),
        overflow,
        token: read(mobile ? '--row-h-sm' : '--row-h'),
      };
    });

    /* ---- 5: no separator glyph at a rendered line boundary ---- */
    const seps = await page.evaluate(() => {
      const SEP = '·';
      const hits = [];
      let checked = 0;
      const leafRects = (root) => {
        const acc = [];
        const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walk.nextNode())) {
          const t = n.textContent;
          if (!t || !t.trim()) continue;
          const r = document.createRange();
          r.selectNodeContents(n);
          // ONE RECT PER LINE BOX — a bounding rect would make a two-line node look
          // like it sits on its first line and would produce false hits
          for (const rect of r.getClientRects()) {
            if (rect.width < 0.5 && rect.height < 0.5) continue;
            acc.push({ node: n, text: t.trim(), x: rect.x, y: rect.y });
          }
        }
        for (const el of root.querySelectorAll('svg,img')) {
          const rect = el.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          acc.push({ node: el, text: '', x: rect.x, y: rect.y });
        }
        return acc;
      };
      const blockOf = (el) => {
        for (let e = el; e && e !== document.body; e = e.parentElement) {
          const d = getComputedStyle(e).display;
          const blockish = ['block', 'grid', 'flex', 'list-item', 'table-cell'].includes(d);
          /* AND it must hold more than the separator itself. FLEX AND GRID ITEMS ARE
             BLOCKIFIED — `<span aria-hidden>·</span>` inside a flex breadcrumb computes
             to `display: block`, so a naive walk stops there and every legitimate
             separator reads as "alone on its own line". */
          if (blockish && e.textContent.trim() !== SEP) return e;
        }
        return document.body;
      };
      const blocks = new Map();
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        if (n.textContent.trim() !== SEP) continue;
        checked += 1;
        const b = blockOf(n.parentElement);
        if (!blocks.has(b)) blocks.set(b, []);
        blocks.get(b).push(n);
      }
      for (const [block, nodes] of blocks) {
        const rects = leafRects(block);
        for (const node of nodes) {
          const r = document.createRange();
          r.selectNodeContents(node);
          const me = r.getBoundingClientRect();
          const line = rects.filter((x) => Math.abs(x.y - me.y) < 4).sort((a, b) => a.x - b.x);
          const idx = line.findIndex((x) => x.node === node && Math.abs(x.x - me.x) < 1.5);
          if (idx === -1) continue;
          const alone = line.length === 1;
          const leading = idx === 0;
          const trailing = idx === line.length - 1;
          if (alone || leading || trailing) {
            hits.push({
              where: (block.className || block.tagName || '').toString().slice(0, 60),
              kind: alone ? 'alone-on-line' : leading ? 'starts-line' : 'ends-line',
              line: line.map((x) => x.text).join(' | ').slice(0, 120),
            });
          }
        }
      }
      return { checked, hits };
    });

    /* ---- 6: chart labels within one label height ---- */
    const charts = await page.evaluate(() => {
      const hits = [];
      let checked = 0;
      for (const svg of document.querySelectorAll('svg')) {
        const vb = svg.viewBox?.baseVal;
        if (!vb?.width) continue;
        const texts = [...svg.querySelectorAll('text')];
        if (texts.length < 3) continue;
        /* A DISPLAY:NONE SVG CANNOT BE MEASURED and must not be counted as if it had
           been: getBBox() returns zeros inside one, every pair then reads as
           non-overlapping, and the gate would pass a hidden collision in silence. */
        if (!svg.getBoundingClientRect().width) continue;
        checked += 1;
        const boxes = texts.map((t) => {
          const b = t.getBBox();
          return { s: t.textContent, fs: parseFloat(t.getAttribute('font-size')) || 12, ...b };
        });
        for (let i = 0; i < boxes.length; i += 1) {
          for (let j = i + 1; j < boxes.length; j += 1) {
            const a = boxes[i];
            const b = boxes[j];
            if (a.x + a.width <= b.x || b.x + b.width <= a.x) continue;
            const dy = Math.abs(a.y - b.y);
            const need = Math.max(a.fs, b.fs);
            if (dy < need) hits.push({ a: a.s, b: b.s, dy: +dy.toFixed(2), need });
          }
        }
      }
      return { checked, hits };
    });

    /* ---- 7: the document must not overflow horizontally ---- */
    const overflowX = await page.evaluate(
      (w) => ({ scrollWidth: document.documentElement.scrollWidth, viewport: w }),
      width,
    );

    /* ---- 8 + 9 + 10: the v4.1 composition assertions ----
       All three are AREA/RATIO measurements over the RENDERED page, taken in one pass
       because they share the page-area denominator. A ratio is the right unit for all
       three: a raw px cap on the chrome would pass on a tablet and fail on a phone for
       the same design, and a raw px floor on imagery would be satisfied by one enormous
       photograph, which is the opposite of what §2.3 is asking for. */
    /* SCROLL THE WHOLE PAGE FIRST, THEN MEASURE, AND THIS IS NOT A NICETY. An
       `img loading="lazy"` that has not decoded has NO INTRINSIC SIZE, so its rendered
       box is 0×0 — a photography-area assertion taken without scrolling measures a
       loading state and reports the floor as breached when the design is correct. (Same
       root cause as the fullPage-screenshot trap: a fullPage screenshot does not
       scroll, so lazy images below the fold come out as empty squares.) One pass down,
       one back to the top so the sticky measurement is taken at rest. */
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 24)));
      }
      window.scrollTo(0, 0);
      await Promise.all([...document.images].filter((i) => !i.complete).map((i) => i.decode().catch(() => {})));
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 48)));
    });

    const composition = await page.evaluate(() => {
      const doc = document.documentElement;
      const pageArea = doc.scrollWidth * doc.scrollHeight;

      /* Photography. `getBoundingClientRect` on the <img> is the RENDERED box, which is
         the number the claim is about — a natural-size or srcset-derived figure would
         measure the asset rather than the page. Zero-size images (a lazy one below the
         fold that has not decoded) contribute 0 and are counted separately, because
         "the images are all lazy" is exactly how this assertion could pass on a page
         that renders empty squares. */
      let imageArea = 0;
      let imgs = 0;
      let imgsZero = 0;
      for (const el of document.images) {
        const r = el.getBoundingClientRect();
        imgs += 1;
        if (r.width < 1 || r.height < 1) { imgsZero += 1; continue; }
        imageArea += r.width * r.height;
      }

      /* Amber. Matched on the COMPUTED background-color, not on a class name: the
         assertion is about what a reader SEES, and a class-name scan would miss an
         amber fill introduced by an inline style or by a token change. --loud is
         #FFB300 → rgb(255, 179, 0). Borders are excluded on purpose — --loud-edge is
         amber's MANDATORY boundary, so counting it would penalise the rule that keeps
         amber accessible. */
      /* v7.1 §1.2 — AMBER IS FOUR VALUES NOW, AND THE GATE HAS TO SEE ALL FOUR.
         This constant used to be one string, so the moment the ramp shipped the amber
         COUNT and the amber WINDOW would have started measuring one step in four and
         passing harder the darker the catalogue got — a gate that goes quiet exactly
         when the thing it guards grows. The set IS the ramp: --loud-1 (=--loud) /
         --loud-2 / --loud-3 / --loud-4 (=--loud-edge). Nothing is relaxed here; the
         scope is restored to what it was measuring before the palette grew
         (v7.1 §0.2 — re-measure, never relax). */
      const RAMP = ['rgb(255, 179, 0)', 'rgb(219, 146, 0)', 'rgb(179, 116, 0)', 'rgb(138, 90, 0)'];
      const isRamp = (c) => RAMP.includes(c);
      let amberArea = 0;
      let amberNodes = 0;
      for (const el of document.querySelectorAll('*')) {
        if (!isRamp(getComputedStyle(el).backgroundColor)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        amberArea += r.width * r.height;
        amberNodes += 1;
      }

      /* The sticky chrome. `.chrome` is a PLAIN GLOBAL class on the header for exactly
         this kind of reach (globals.css already targets it for the focus-ring
         override), so this does not depend on a CSS-Modules hash that changes with
         every build — the failure mode where a gate silently selects nothing. */
      const chrome = document.querySelector('.chrome');
      const sticky = chrome && getComputedStyle(chrome).position === 'sticky';
      const stickyH = sticky ? chrome.getBoundingClientRect().height : 0;

      return {
        pageArea,
        imageArea, imgs, imgsZero,
        imagePct: pageArea ? +((imageArea / pageArea) * 100).toFixed(2) : null,
        amberArea, amberNodes,
        amberPct: pageArea ? +((amberArea / pageArea) * 100).toFixed(2) : null,
        chromeFound: Boolean(chrome),
        sticky,
        stickyH: +stickyH.toFixed(1),
        stickyPct: +((stickyH / window.innerHeight) * 100).toFixed(2),
        viewportH: window.innerHeight,
      };
    });

    /* ---- 11 + 13 + 14 + 15 + 16 + 17 + 18: THE v4.1-FIX ASSERTIONS ----
       One pass, taken AFTER the scroll above so every lazy image has decoded and every
       box is real. Everything here is measured off the RENDERED page: a class name is
       never the subject, because the whole lesson of the v4.1 critique is that eight
       defects sat inside legal tokens and clean class names. */
    const fix = await page.evaluate(
      ({ longestPrice, t1SentenceChars, amberWindowCeil, t5MaxRoles, bandEdges, bandFills }) => {
        /* v7.1 §1.2 — AMBER IS FOUR VALUES NOW, AND THE GATE HAS TO SEE ALL FOUR.
           This constant used to be one string, so the moment the ramp shipped the amber
           COUNT and the amber WINDOW would have started measuring one step in four and
           passing harder the darker the catalogue got — a gate that goes quiet exactly
           when the thing it guards grows. The set IS the ramp: --loud-1 (=--loud) /
           --loud-2 / --loud-3 / --loud-4 (=--loud-edge). Nothing is relaxed here; the
           scope is restored to what it was measuring before the palette grew
           (v7.1 §0.2 — re-measure, never relax). */
        const RAMP = ['rgb(255, 179, 0)', 'rgb(219, 146, 0)', 'rgb(179, 116, 0)', 'rgb(138, 90, 0)'];
        const isRamp = (c) => RAMP.includes(c);
        const visible = (el) => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const px = (v) => parseFloat(v) || 0;
        const transparent = (c) => c === 'transparent' || /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c);

        /* ---- 11: one price baseline per grid row, one height per card ---- */
        const cards = [...document.querySelectorAll('[data-scales="ProductCard"]')].map((el) => {
          const r = el.getBoundingClientRect();
          const price = el.querySelector('[class*="_price"]');
          return {
            // group by the card's own top in DOCUMENT space — a grid row is defined by
            // where its items start, and rounding to 1px absorbs sub-pixel track maths
            row: Math.round(r.top + window.scrollY),
            h: +r.height.toFixed(2),
            priceTop: price ? +(price.getBoundingClientRect().top + window.scrollY).toFixed(2) : null,
          };
        });
        const byRow = new Map();
        for (const c of cards) {
          if (!byRow.has(c.row)) byRow.set(c.row, []);
          byRow.get(c.row).push(c);
        }
        const rowFaults = [];
        for (const [row, group] of byRow) {
          if (group.length < 2) continue;
          const tops = group.map((c) => c.priceTop).filter((t) => t !== null);
          const spread = tops.length ? Math.max(...tops) - Math.min(...tops) : 0;
          const heights = [...new Set(group.map((c) => c.h))];
          // 0.5px, not 0: a grid track can land a card on a half pixel. 4px — the
          // measured defect — is nowhere near this tolerance.
          if (spread > 0.5) rowFaults.push({ row, n: group.length, priceSpread: +spread.toFixed(2) });
          else if (heights.length > 1) rowFaults.push({ row, n: group.length, heights });
        }

        /* ---- 12: the longest price in the artifact fits its slot ----
           THE REAL NODE, THE REAL FONT, THE REAL BOX. A canvas measureText() would be a
           second rendering of the same claim, and two derived artifacts agreeing proves
           nothing. Written, measured, restored — synchronously, so nothing paints. */
        let priceFit = null;
        const priceNode = document.querySelector('[data-verdict-price]');
        if (priceNode) {
          const parent = priceNode.parentElement;
          const before = priceNode.textContent;
          priceNode.textContent = longestPrice;
          /* A RANGE OVER THE TEXT, NOT THE ELEMENT'S BOX. The price is a <p> — a block —
             so `priceNode.getBoundingClientRect().width` is the CONTAINER's width and the
             assertion measured `328 fits in 328` and passed on nothing. That is the
             gate-selects-nothing failure wearing a plausible number. A Range measures the
             glyphs. */
          const range = document.createRange();
          range.selectNodeContents(priceNode);
          const need = range.getBoundingClientRect().width;
          const cs = getComputedStyle(parent);
          const have = parent.getBoundingClientRect().width
            - px(cs.paddingInlineStart) - px(cs.paddingInlineEnd)
            - px(cs.borderInlineStartWidth) - px(cs.borderInlineEndWidth);
          priceNode.textContent = before;
          priceFit = {
            string: longestPrice,
            glyphs: longestPrice.length,
            need: +need.toFixed(2),
            have: +have.toFixed(2),
            slack: +(have - need).toFixed(2),
            nowrap: getComputedStyle(priceNode).whiteSpace.includes('nowrap'),
          };
        }

        /* ---- 13: no --plate element may be a letterbox ----
           Matched on the COMPUTED background-image, so a fourth plate anywhere in the
           product is measured without editing this gate. */
        const plates = [];
        for (const el of document.querySelectorAll('*')) {
          if (!getComputedStyle(el).backgroundImage.includes('radial-gradient')) continue;
          if (!visible(el)) continue;
          const r = el.getBoundingClientRect();
          plates.push({
            where: String(el.className).split(' ')[0].slice(0, 40),
            w: +r.width.toFixed(1),
            h: +r.height.toFixed(1),
          });
        }
        const letterboxes = plates.filter((p) => Math.abs(p.w - p.h) > 1);

        /* ---- 14: a reserved indicator must be filled by a NON-HOVER state ----
           Two halves. First, every stylesheet rule that sets a non-transparent border
           colour under a state selector. Second, every interactive element that computes
           a transparent border ≥1px. An element in the second set with nothing in the
           first set matching it is a slot that no state on this page ever fills. */
        const STATE = /:target|:checked|:focus|\[aria-current|\[aria-pressed|\[aria-selected|\[aria-expanded|\[data-|\.is-|\.active|\[open\]/;
        const BORDER_PROPS = [
          'border', 'border-color', 'border-top', 'border-bottom', 'border-left', 'border-right',
          'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color',
          'border-block-end', 'border-block-end-color', 'border-block-start-color',
          'border-inline-start-color', 'border-inline-end-color', 'outline', 'outline-color',
        ];
        const fillerSelectors = [];
        /* TEST FOR A STYLE RULE **BEFORE** RECURSING, AND THIS COST A DEBUG CYCLE.
           Since CSS Nesting shipped, EVERY `CSSStyleRule` carries a `cssRules` property —
           an empty `CSSRuleList`, which is TRUTHY. So the obvious shape,
           `if (r.cssRules) { walk(r.cssRules); continue; }`, recurses into nothing and
           `continue`s past every single style rule: 246 rules in the sheet and
           `fillerRules: 0`, with no error and no empty selector to notice. A gate that
           selects nothing PASSES, which is worse than failing, and it would have reported
           "0 unfilled keylines" over 0 subjects for exactly the same reason the v3 gate
           once measured nothing through CSS-Modules-hashed class names. The
           `zero-state-border-rules-found` meta-assertion below is what caught it, and it
           stays for the next person. */
        const walkRules = (list) => {
          for (let i = 0; i < list.length; i += 1) {
            const r = list[i];
            if (r.selectorText && r.style) {
              let sets = false;
              for (const prop of BORDER_PROPS) {
                const v = r.style.getPropertyValue(prop);
                if (v && !transparent(v.trim()) && !/^\s*(0|none)\s*$/.test(v)) sets = true;
              }
              if (sets) fillerSelectors.push(r.selectorText);
            }
            // grouping rules (@media/@supports) AND nested style rules
            if (r.cssRules && r.cssRules.length) walkRules(r.cssRules);
          }
        };
        for (const sheet of document.styleSheets) {
          try { walkRules(sheet.cssRules); } catch { /* cross-origin sheet: nothing to read */ }
        }
        const nonHoverFillers = fillerSelectors
          .flatMap((s) => s.split(','))
          .map((s) => s.trim())
          .filter((s) => STATE.test(s) && !/:hover/.test(s));

        const unfilledKeylines = [];
        for (const el of document.querySelectorAll('a, button, summary, input, select, [role="button"], [role="tab"]')) {
          if (!visible(el)) continue;
          const cs = getComputedStyle(el);
          const sides = [
            ['top', cs.borderTopWidth, cs.borderTopColor],
            ['bottom', cs.borderBottomWidth, cs.borderBottomColor],
            ['left', cs.borderLeftWidth, cs.borderLeftColor],
            ['right', cs.borderRightWidth, cs.borderRightColor],
          ].filter(([, w, c]) => px(w) >= 1 && transparent(c));
          if (!sides.length) continue;
          const tokens = String(el.className).split(/\s+/).filter(Boolean);
          const filled = nonHoverFillers.some((sel) => tokens.some((t) => sel.includes(t)));
          if (!filled) {
            unfilledKeylines.push({
              tag: el.tagName.toLowerCase(),
              cls: tokens[0] ? tokens[0].slice(0, 40) : '(no class)',
              text: (el.textContent || '').trim().slice(0, 32),
              sides: sides.map(([s, w]) => `${s}:${w}`),
            });
          }
        }

        /* ---- 15 + 16: amber by COUNT and by WINDOW, never by document area ---- */
        const amberEls = [...document.querySelectorAll('*')].filter((el) => {
          if (!isRamp(getComputedStyle(el).backgroundColor)) return false;
          const r = el.getBoundingClientRect();
          return r.width >= 1 && r.height >= 1;
        });
        /* 15 — one --loud object per card, per offer row, per plate. The containers are
           found structurally (the card's own gate hook, the row's `data-row`, the plate's
           landmark), so a new surface has to opt IN to a budget rather than escape it. */
        const containers = [
          ...document.querySelectorAll('[data-scales="ProductCard"], [data-row], aside[aria-label]'),
        ];
        const overBudget = containers
          .map((c) => ({
            where: String(c.className).split(' ')[0].slice(0, 40) || c.tagName.toLowerCase(),
            n: amberEls.filter((a) => c.contains(a)).length,
          }))
          .filter((x) => x.n > 1);
        /* 16 — the densest 100vh window. Document-space rects, then slide the window to
           each amber object's top: the maximum is always achieved at one of them. */
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const boxes = amberEls.map((el) => {
          const r = el.getBoundingClientRect();
          return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, area: r.width * r.height };
        });
        let densest = 0;
        for (const b of boxes) {
          const winTop = b.top;
          const winBottom = winTop + vh;
          let sum = 0;
          for (const o of boxes) {
            const overlap = Math.min(o.bottom, winBottom) - Math.max(o.top, winTop);
            if (overlap <= 0) continue;
            // pro-rate by the visible fraction of the object's height
            sum += o.area * (overlap / Math.max(1, o.bottom - o.top));
          }
          densest = Math.max(densest, sum);
        }
        const amberWindowPct = +((densest / (vw * vh)) * 100).toFixed(3);

        /* ---- 17: the type ladder, as three numbers ---- */
        const t1Sentences = [];
        const roles = {};
        const sizes = {};
        const t7Nodes = [];
        const t8Nodes = [];
        let textNodes = 0;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const seen = new Set();
        let n2;
        while ((n2 = walker.nextNode())) {
          const t = (n2.textContent || '').trim();
          if (!t) continue;
          const el = n2.parentElement;
          if (!el || seen.has(el) || !visible(el)) continue;
          seen.add(el);
          const cs = getComputedStyle(el);
          const fs = Math.round(parseFloat(cs.fontSize));
          textNodes += 1;
          sizes[fs] = (sizes[fs] || 0) + 1;
          const role = `${fs}|${cs.fontWeight}|${cs.textTransform}`;
          roles[role] = (roles[role] || 0) + 1;
          if (fs === 12 && t.length > t1SentenceChars) {
            /* a declared single-line truncating caption is not a paragraph, whatever its
               source string measures — the breadcrumb's current crumb is the case. */
            const oneLine = cs.whiteSpace.includes('nowrap') && cs.textOverflow === 'ellipsis';
            if (!oneLine) {
              t1Sentences.push({
                cls: String(el.className).split(' ')[0].slice(0, 40),
                chars: t.length,
                text: t.slice(0, 60),
              });
            }
          }
          if (fs === 44) {
            t7Nodes.push({
              cls: String(el.className).split(' ')[0].slice(0, 40),
              isVerdict: el.hasAttribute('data-verdict-price'),
            });
          }
          /* A32 — the same shape as 17c, one step up the ladder. `inW1` is what
             makes this the REWORDED assertion rather than the one in §8.2: the
             test is containment in the page's own W1 group, not a hardcoded
             route. */
          if (fs === 56) {
            t8Nodes.push({
              cls: String(el.className).split(' ')[0].slice(0, 40),
              inW1: Boolean(el.closest('[data-w="1"]')),
            });
          }
        }
        const t5Roles = Object.keys(roles).filter((r) => r.startsWith('26|'));
        const t1Share = textNodes ? +(((sizes[12] || 0) / textNodes) * 100).toFixed(1) : 0;

        /* ---- 18 + 18b: the hero row's two panels share a TOP edge, and the plate's
                height is its own content's height (v7 §2.4) ---- */
        let hero = null;
        const shot = document.querySelector('[data-scales="product-shot"]');
        const verdict = document.querySelector('[data-verdict-price]');
        if (shot && verdict) {
          const plate = verdict.closest('aside');
          if (plate) {
            const box = plate.getBoundingClientRect();
            hero = {
              shotTop: +shot.getBoundingClientRect().top.toFixed(1),
              plateTop: +box.top.toFixed(1),
            };
            hero.delta = +Math.abs(hero.shotTop - hero.plateTop).toFixed(1);
            /* 18b's four numbers. `plateSlack` stays NULL if the plate has no laid-out
               children, so a plate that measures nothing FAILS rather than reporting a
               comfortable 0 — the same meta-assertion this file opens with. */
            const cs = getComputedStyle(plate);
            const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
            const kids = [...plate.children]
              .map((el) => el.getBoundingClientRect())
              .filter((r) => r.width > 0 && r.height > 0);
            hero.plateH = +box.height.toFixed(1);
            hero.plateKids = kids.length;
            hero.padding = pad;
            hero.contentSpan = kids.length
              ? +(Math.max(...kids.map((r) => r.bottom)) - Math.min(...kids.map((r) => r.top))).toFixed(1)
              : null;
            hero.plateSlack =
              hero.contentSpan === null ? null : +(box.height - hero.contentSpan - pad).toFixed(1);
          }
        }

        return {
          rowFaults, cards: cards.length,
          /* the two meta-assertions for this pass: a product page WITHOUT a verdict price
             node means assertion 12 measured nothing, and a stylesheet walk that found no
             state rules at all means assertion 14 measured nothing. Both must fail loudly
             rather than pass silently. */
          isProductPage: Boolean(document.querySelector('[data-scales="product-shot"]')),
          priceFit,
          plates: plates.length, letterboxes,
          unfilledKeylines, fillerRules: nonHoverFillers.length,
          amberNodes: amberEls.length, overBudget, amberWindowPct,
          textNodes, sizes, roles, t1Share, t1Sentences, t5Roles, t7Nodes, t8Nodes,
          hero,
          ...(() => {
            /* ---- 27: the ramp tracks the data, and stays out of the plate ---- */
            const nodes = [...document.querySelectorAll('[data-gap-band]')];
            const mismatched = [];
            const inPlate = [];
            /* re-bin a percentage against the ARTIFACT's edges. `edges` is
               [0,5,10,20,50]; the last bin is open-ended. */
            const binOf = (v) => {
              let i = 0;
              for (let k = 1; k < bandEdges.length; k += 1) if (v >= bandEdges[k]) i = k;
              return i;
            };
            for (const el of nodes) {
              const band = Number(el.dataset.gapBand);
              const raw = el.dataset.gapPct;
              const bg = getComputedStyle(el).backgroundColor;
              const where = String(el.className).split(' ')[0].slice(0, 40) || el.tagName.toLowerCase();
              if (raw !== undefined && bandEdges) {
                const expect = binOf(parseFloat(raw));
                if (expect !== band) mismatched.push({ where, band, pct: raw, expect, why: 'declared-band-is-not-the-band-its-own-number-falls-in' });
              }
              /* a node that paints nothing (the spread bar's root) passes here and
                 is caught by the plate scan below instead. */
              if (bandFills.includes(bg) && bg !== bandFills[band]) {
                mismatched.push({ where, band, bg, expect: bandFills[band], why: 'fill-is-not-the-declared-band' });
              }
            }
            /* THE PLATE (§1.4.1). Anything inside an --ink surface painting a ramp
               value that is not --loud is the ramp entering the one place it
               inverts. Scoped by the rendered ground, not by a class name. */
            const INK = 'rgb(0, 40, 50)';
            for (const el of document.querySelectorAll('*')) {
              const bg = getComputedStyle(el).backgroundColor;
              if (!bandFills.slice(2).includes(bg)) continue;
              let p = el.parentElement;
              while (p) {
                if (getComputedStyle(p).backgroundColor === INK) {
                  inPlate.push({ where: String(el.className).split(' ')[0].slice(0, 40), bg });
                  break;
                }
                p = p.parentElement;
              }
            }
            return { rampNodes: nodes.length, rampMismatched: mismatched, rampInPlate: inPlate };
          })(),
        };
      },
      {
        longestPrice: LONGEST_PRICE,
        t1SentenceChars: T1_SENTENCE_CHARS,
        amberWindowCeil: AMBER_WINDOW_CEIL,
        t5MaxRoles: T5_MAX_ROLES,
        bandEdges: BAND_EDGES,
        bandFills: BAND_FILLS,
      },
    );

    /* ---- 19 + 20 + 21 + 22 + 23 + 24 + 25: THE v5 ASSERTIONS ----
       One pass. Everything is measured off the RENDERED page in the REAL typeface at
       the REAL size — the whole point of assertion 19 is that the declared unit is
       not the thing being claimed. */
    const v5 = await page.evaluate(
      ({ minLen, ref }) => {
        const visible = (el) => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const px = (v) => parseFloat(v) || 0;
        const root = document.querySelector('[data-prose]');

        /* ---- 19: characters per line, measured, never derived from `ch` ----
           THE REFERENCE SPAN IS INJECTED INTO THE SUBJECT ELEMENT so it inherits the
           subject's computed font — the same technique assertion 12 uses for the
           longest price, and for the same reason: a canvas measureText() would be a
           SECOND RENDERING of the same claim, and two derived artifacts agreeing
           proves nothing. Written, measured, removed — synchronously, nothing paints. */
        const prose = [];
        if (root) {
          for (const el of root.querySelectorAll('p, li, dd, blockquote')) {
            const text = (el.textContent || '').trim();
            if (text.length < minLen || !visible(el)) continue;
            const span = document.createElement('span');
            span.textContent = ref;
            span.style.whiteSpace = 'pre';
            span.style.position = 'absolute';
            span.style.visibility = 'hidden';
            el.appendChild(span);
            const advance = span.getBoundingClientRect().width / ref.length;
            el.removeChild(span);
            const cs = getComputedStyle(el);
            const w = el.getBoundingClientRect().width
              - px(cs.paddingInlineStart) - px(cs.paddingInlineEnd)
              - px(cs.borderInlineStartWidth) - px(cs.borderInlineEndWidth);
            prose.push({
              cls: String(el.className).split(' ')[0].slice(0, 40) || el.tagName.toLowerCase(),
              width: +w.toFixed(1),
              advance: +advance.toFixed(4),
              chars: +(w / advance).toFixed(1),
              text: text.slice(0, 48),
            });
          }
        }

        /* ---- 20: a paragraph gap must exceed its own leading ---- */
        const gaps = [];
        if (root) {
          for (const el of root.querySelectorAll('p')) {
            const prev = el.previousElementSibling;
            if (!prev || prev.tagName !== 'P' || !visible(el)) continue;
            const cs = getComputedStyle(el);
            const gap = px(cs.marginBlockStart);
            const leading = px(cs.lineHeight) || px(cs.fontSize) * 1.2;
            if (gap < leading) {
              gaps.push({
                cls: String(el.className).split(' ')[0].slice(0, 40),
                gap: +gap.toFixed(2),
                leading: +leading.toFixed(2),
              });
            }
          }
        }

        /* ---- 21: no prose link is distinguished by colour alone ---- */
        const bareLinks = [];
        if (root) {
          for (const a of root.querySelectorAll('a')) {
            if (!visible(a)) continue;
            if (getComputedStyle(a).textDecorationLine.includes('underline')) continue;
            bareLinks.push({ text: (a.textContent || '').trim().slice(0, 40), href: a.getAttribute('href') });
          }
        }

        /* ---- 22: h1 > h2 > h3, and it stops ---- */
        const deepHeadings = [];
        const skips = [];
        if (root) {
          // the page's own h1 lives in the head block, OUTSIDE the prose region, so
          // the ladder inside [data-prose] legitimately starts at h2. Seed with 1.
          let prevLevel = 1;
          for (const h of root.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
            const level = Number(h.tagName[1]);
            if (level > 3) deepHeadings.push({ tag: h.tagName.toLowerCase(), text: (h.textContent || '').slice(0, 40) });
            if (level > prevLevel + 1) skips.push({ from: prevLevel, to: level, text: (h.textContent || '').slice(0, 40) });
            prevLevel = level;
          }
        }

        /* ---- 23: amber, as background OR as colour ----
           TWO SCOPES, NOT ONE, AND THE FIRST RUN PROVED WHY. §6.1 reads
           `if (isDoc || consentPresent) { …scan… }` over an unnamed `root`. Taken as
           "the whole document, whenever the gate is present" it fires on the HOME
           PAGE — where the gate is present on every first visit and the 24 amber gap
           chips are the correct, mandated design. The rule's own name says what the
           scopes are: amber on a DOCUMENT SURFACE, or amber IN THE CONSENT GATE. So
           the document scan is gated on isDoc, and the gate scan is unconditional and
           element-scoped. That is stricter where it matters and silent where the
           design says amber belongs. */
        /* v7.1 §1.2 — AMBER IS FOUR VALUES NOW, AND THE GATE HAS TO SEE ALL FOUR.
           This constant used to be one string, so the moment the ramp shipped the amber
           COUNT and the amber WINDOW would have started measuring one step in four and
           passing harder the darker the catalogue got — a gate that goes quiet exactly
           when the thing it guards grows. The set IS the ramp: --loud-1 (=--loud) /
           --loud-2 / --loud-3 / --loud-4 (=--loud-edge). Nothing is relaxed here; the
           scope is restored to what it was measuring before the palette grew
           (v7.1 §0.2 — re-measure, never relax). */
        const RAMP = ['rgb(255, 179, 0)', 'rgb(219, 146, 0)', 'rgb(179, 116, 0)', 'rgb(138, 90, 0)'];
        const isRamp = (c) => RAMP.includes(c);
        const amberIn = (scope) => [...scope.querySelectorAll('*')].filter((el) => {
          const cs = getComputedStyle(el);
          return isRamp(cs.backgroundColor) || isRamp(cs.color);
        }).map((el) => String(el.className).split(' ')[0].slice(0, 40) || el.tagName.toLowerCase());
        const amberDoc = amberIn(document.body);

        /* ---- 24 + 25: the consent gate ----
           `.consent` is a PLAIN GLOBAL class for the same reason `.chrome` is — a
           CSS-Modules hash changes every build and this gate must still select it. */
        const gate = document.querySelector('.consent');
        const amberGate = gate ? amberIn(gate) : [];
        let consent = null;
        if (gate) {
          const r = gate.getBoundingClientRect();
          const acts = [...gate.querySelectorAll('[data-consent-action]')].map((el) => {
            const cs = getComputedStyle(el);
            const b = el.getBoundingClientRect();
            return {
              action: el.getAttribute('data-consent-action'),
              w: +b.width.toFixed(2),
              props: {
                height: cs.height,
                backgroundColor: cs.backgroundColor,
                color: cs.color,
                fontSize: cs.fontSize,
                fontWeight: cs.fontWeight,
                borderRadius: cs.borderTopLeftRadius,
                borderColor: cs.borderTopColor,
              },
            };
          });
          /* 26 — THE BAR MAY NOT COVER THE NUMBER THE PAGE EXISTS TO SHOW.
             The price is read at its DOCUMENT position and compared with the bar's
             VIEWPORT position, unscrolled: the bar is `position: fixed`, so on
             first paint — which is the only moment 88% of this product's traffic
             ever sees — the two coordinate systems coincide, and that is the
             moment the defect lives in. A product page with no verdict price is
             reported as `null` and caught by assertion 12's own "measured
             nothing" guard rather than silently passing here. */
          const priceEl = document.querySelector('[data-verdict-price]');
          const priceBox = priceEl ? priceEl.getBoundingClientRect() : null;
          consent = {
            h: +r.height.toFixed(1),
            pct: +((r.height / window.innerHeight) * 100).toFixed(2),
            viewportH: window.innerHeight,
            bodyOverflow: getComputedStyle(document.body).overflow,
            role: gate.getAttribute('role'),
            top: +r.top.toFixed(1),
            priceBottom: priceBox ? +(priceBox.bottom + window.scrollY).toFixed(1) : null,
            /* the reserved strip §5.4-2 adds, so a run can show that the document
               end is reachable rather than only that the fold is clean */
            bodyPadEnd: getComputedStyle(document.body).paddingBlockEnd,
            acts,
          };
        }

        return { prose, gaps, bareLinks, deepHeadings, skips, amberDoc, amberGate, consent };
      },
      {
        minLen: PROSE_MIN_LEN,
        /* Real es-CR legal prose, so the average advance is measured over the
           character distribution this product actually renders — not over an
           alphabet sample, which would over-weight the letters Spanish uses least. */
        ref: 'Los precios que publicamos son de contado e incluyen el impuesto, y cada oferta guarda la hora exacta en que se leyó.',
      },
    );

    out.measured[key] = {
      isDoc,
      prose: v5.prose.length
        ? {
          subjects: v5.prose.length,
          chars: v5.prose.map((p) => p.chars),
          advance: v5.prose[0].advance,
        }
        : null,
      consent: v5.consent
        ? {
          h: v5.consent.h,
          pct: v5.consent.pct,
          top: v5.consent.top,
          priceBottom: v5.consent.priceBottom,
          bodyPadEnd: v5.consent.bodyPadEnd,
        }
        : null,
      scales: { count: scales.count }, rows, seps: { checked: seps.checked }, charts, overflowX, composition,
      ladder: { textNodes: fix.textNodes, sizes: fix.sizes, t1Share: fix.t1Share, t5Roles: fix.t5Roles },
      plates: { count: fix.plates, letterboxes: fix.letterboxes.length },
      amber: { nodes: fix.amberNodes, densest100vhPct: fix.amberWindowPct },
      /* REPORTED, so a run that selects nothing is visible rather than silently
         green. `nodes: 0` on /brechas or a category page means the band
         attributes stopped shipping and assertion 27 is measuring air — the
         failure mode this file already carries meta-assertions for elsewhere. */
      ramp: { nodes: fix.rampNodes, mismatched: fix.rampMismatched.length, inPlate: fix.rampInPlate.length },
      price: fix.priceFit,
      hero: fix.hero,
      keylines: { interactiveReservedUnfilled: fix.unfilledKeylines.length, nonHoverFillerRules: fix.fillerRules },
    };

    /* ---- 11 ---- */
    if (fix.rowFaults.length) {
      fail({
        rule: 'cards-in-a-grid-row-do-not-share-a-price-baseline-or-a-height',
        at: key,
        cases: fix.rowFaults.slice(0, 6),
        note: 'B3 — a reserved slot shorter than its rendered content puts a mixed row on two baselines',
      });
    }

    /* ---- 12 ---- */
    if (fix.isProductPage && !fix.priceFit) {
      fail({
        rule: 'verdict-price-node-not-found-on-a-product-page',
        at: key,
        note: 'assertion 12 measured nothing. [data-verdict-price] is the gate hook and it must exist on both templates.',
      });
    }
    if (!fix.fillerRules) {
      fail({
        rule: 'zero-state-border-rules-found-in-any-stylesheet',
        at: key,
        note: 'assertion 14 measured nothing — the CSSRuleList walk is broken again (it is not iterable; index it)',
      });
    }
    if (fix.priceFit) {
      if (!fix.priceFit.nowrap) {
        fail({
          rule: 'verdict-price-may-wrap',
          at: key,
          note: 'B5 — without nowrap the failure mode is a MID-NUMBER wrap (₡10.599. / 900), not an overflow',
        });
      }
      if (fix.priceFit.slack < 0) {
        fail({
          rule: 'longest-artifact-price-does-not-fit-the-verdict-slot',
          at: key,
          ...fix.priceFit,
          note: 'the artifact now contains a price the 44px slot cannot hold. This is a design decision, not a token nudge.',
        });
      }
    }

    /* ---- 13 ---- */
    if (fix.letterboxes.length) {
      fail({
        rule: 'a---plate-element-is-not-square',
        at: key,
        cases: fix.letterboxes.slice(0, 6),
        note: 'B7 — one plate recipe: aspect-ratio 1, width 100%, a cap, margin-inline auto',
      });
    }
    /* v5 §6.0 — SCOPED, NOT BYPASSED. A document surface renders no product
       photograph and that is correct; the "must measure something" guard moves to
       assertion 19 below, which fails a [data-prose] region with no prose in it. */
    if (!fix.plates && !isDoc) {
      fail({ rule: 'zero---plate-elements-selected', at: key, note: 'a gate that measures nothing must fail' });
    }

    /* ---- 14 ---- */
    if (fix.unfilledKeylines.length) {
      fail({
        rule: 'reserved-indicator-never-filled-by-a-non-hover-state',
        at: key,
        cases: fix.unfilledKeylines.slice(0, 6),
        note: 'B4 — a keyline track whose only filler is :hover indicates nothing at rest and nothing on touch',
      });
    }

    /* ---- 15 + 16 ---- */
    if (fix.overBudget.length) {
      fail({
        rule: 'more-than-one---loud-object-on-one-card-row-or-plate',
        at: key,
        cases: fix.overBudget.slice(0, 6),
        note: 'N2a — the width-independent invariant that protects "loud stays loud"',
      });
    }
    /* ---- 27: the amber ramp (v7.1 §8.3) ---- */
    if (fix.rampMismatched.length) {
      fail({
        rule: 'a-gap-object-does-not-render-the-band-its-own-number-falls-in',
        at: key,
        cases: fix.rampMismatched.slice(0, 8),
        note: 'v7.1 §8.3 — a ramp that does not track the data is decoration wearing a semantic palette',
      });
    }
    if (fix.rampInPlate.length) {
      fail({
        rule: 'a-ramp-step-other-than---loud-is-painted-inside-an---ink-surface',
        at: key,
        cases: fix.rampInPlate.slice(0, 6),
        note: 'v7.1 §1.4.1 — --loud-4 is 2.63 on --ink; the ramp inverts on a dark ground. The plate span is --loud at every gap size',
      });
    }
    if (fix.amberWindowPct / 100 > AMBER_WINDOW_CEIL) {
      fail({
        rule: 'amber-exceeds-2.5pct-of-the-densest-100vh-window',
        at: key,
        pct: fix.amberWindowPct,
        ceiling: AMBER_WINDOW_CEIL * 100,
        nodes: fix.amberNodes,
        note: 'N2b — measured at the worst window, so a longer page cannot dilute it',
      });
    }

    /* ---- 17 ---- */
    if (fix.t1Sentences.length) {
      fail({
        rule: 'a-12px-node-carries-a-sentence',
        at: key,
        cases: fix.t1Sentences.slice(0, 8),
        note: `B8a — the floor keeps three roles (ribbon flag, gap chip, eyebrow/caption). Anything over ${T1_SENTENCE_CHARS} chars is prose and belongs at --t2.`,
      });
    }
    if (fix.t5Roles.length > T5_MAX_ROLES) {
      fail({
        rule: 't5-carries-more-than-two-roles',
        at: key,
        roles: fix.t5Roles,
        note: 'B8b — §1.2 authorised two (the h2 and the card price). A third is the drift the ladder was closed to prevent.',
      });
    }
    if (fix.t7Nodes.length > 1 || fix.t7Nodes.some((n3) => !n3.isVerdict)) {
      fail({
        rule: 't7-is-not-exclusively-the-verdict-price',
        at: key,
        nodes: fix.t7Nodes,
        note: 'B8c — 44px is the best/only price and nothing else, ever',
      });
    }
    /* ---- A32 (v7.2 §8.2, REWORDED by the designer's Wave-H critique §6.7) ----
       56px is a ROLE — "this page's one answer" — and not a style, so the moment
       a second one appears the reservation has become decoration.

       IT IS "AT MOST ONCE PER PAGE, INSIDE THAT PAGE'S data-w=1", NOT §8.2's
       "exactly once on `/` and nowhere else in the product". The original wording
       collides with `GapStrip.module.css`'s own intended --t8 on /brechas and
       would freeze that component out of its own type forever — a gate that
       forbids something correct is a gate that will be relaxed later, which is
       worse than not writing it. This form keeps the reservation intact and lets
       /brechas take 56 the day /brechas has a W1 group to put it in.

       The containment test is what carries the rule: --t8 outside the W1 group is
       a 56px glyph that is not the page's answer, which is the exact drift the
       reservation exists to prevent. */
    if (fix.t8Nodes.length > 1 || fix.t8Nodes.some((n3) => !n3.inW1)) {
      fail({
        rule: 't8-appears-more-than-once-per-page-or-outside-the-w1-group',
        at: key,
        nodes: fix.t8Nodes,
        note: 'A32 — 56px is at most once per page, and only inside that page\'s [data-w="1"]',
      });
    }

    /* ---- 18 ----
       v7 §2.4 — THIS ASSERTION NOW MEASURES THE TOP EDGE, AND THE CHANGE IS A
       DESIGN RULING RATHER THAN A GATE BEING LOOSENED TO LET A BUILD THROUGH.

       IT USED TO ASSERT AN IDENTICAL **BOTTOM**, at ≥1024, with a 1px tolerance. That
       encoded v4.1-fix N5, which made the verdict plate `block-size: 100%` so it would
       fill the hero row and end level with the photo plate. The consequence was that the
       plate's HEIGHT CAME FROM THE PHOTOGRAPH BESIDE IT rather than from its own
       content, and on T4 — 88% of the catalogue, three regions on the plate instead of
       five — that rendered a ~90px HOLE inside the darkest and most-looked-at object in
       the product. v7 §2.4: "the plate's height becomes its content's height,
       top-aligned to the photo, NEVER DERIVED FROM IT."

       So the alignment the design claims has changed, and the assertion follows it
       rather than being deleted or having its tolerance widened to 90px. Everything
       else about it is unchanged — same pair of elements, same 1px tolerance, same
       "measured nothing" guard, and the same reason for existing: a 1px miss reads as a
       rendering fault, which is worse than a 9px miss reading as "not aligned".

       IT ALSO WIDENS FROM ≥1024 TO ≥768, AND THAT IS THE PROOF THE NEW RULE IS THE
       BETTER ONE. The old scope was a workaround: at 768–1023 the plate's content needed
       306px against the shot's 260px square, so a shared BOTTOM was unreachable at that
       band and it had to be excluded. A shared TOP is reachable at every width where the
       two are side by side, because it is a property of the row rather than of the
       contents — the exclusion disappears instead of being carried forward. Below 768
       the two are no longer in one row at all (v7 T4-1), so the assertion correctly
       stops applying there. */
    if (fix.hero && width >= 768 && fix.hero.delta > 1) {
      fail({
        rule: 'hero-row-panels-do-not-top-align',
        at: key,
        ...fix.hero,
        note: 'v7 §2.4 — the plate is content-height and TOP-aligned to the photo; a 1px miss reads as a rendering fault',
      });
    }

    /* ---- 18b ----
       v7 §2.4, THE OTHER HALF — AND 18 CANNOT SUBSTITUTE FOR IT.

       18 asserts a shared TOP, which is a property of the ROW: the hero runs
       `align-items: start`, so both children get an identical top for free. The rule
       §2.4 actually states is about the plate's HEIGHT — "the plate's height becomes
       its content's height, top-aligned to the photo, NEVER DERIVED FROM IT" — and
       that is what N5's `align-self: stretch; block-size: 100%` broke, with a ~90px
       hole on 88% of the catalogue as the consequence.

       Under `stretch` a grid item shares BOTH edges, so the regression 18 exists to
       prevent PASSES 18 with a top delta of 0.0. The designer ran that regression rather than
       asserting it (critique-v7-wave1 §1.3), which is how a gate that reports a real
       number while measuring something CSS hands it for free gets caught. Repointing
       18 was right; leaving §2.4 guarded by only 18 was not, and Wave 2 reopens this
       component to carry the leaderboard bars.

       `plateSlack = plateH − contentSpan − (padTop + padBottom)`, 1px tolerance, same
       widths and the same node pair as 18. It measures 0.0 on both templates at both
       gated widths today, so it passes on landing — the point is that it cannot keep
       passing if the height ever comes from the photograph again. */
    if (fix.hero && width >= 768) {
      if (fix.hero.plateSlack === null) {
        fail({
          rule: 'verdict-plate-content-measured-nothing',
          at: key,
          ...fix.hero,
          note: 'a plate with no laid-out children cannot report slack — this must fail, not report 0',
        });
      } else if (fix.hero.plateSlack > 1) {
        fail({
          rule: 'verdict-plate-is-not-content-height',
          at: key,
          ...fix.hero,
          note: 'v7 §2.4 — the plate’s height is its own content’s height, never the photo’s',
        });
      }
    }

    if (!scales.count && !isDoc) {
      fail({ rule: 'zero-data-scales-nodes-selected', at: key, note: 'a gate that measures nothing must fail, not pass' });
    }

    /* ==================== v5 §6.1 — ASSERTIONS 19 … 25 ==================== */

    /* ---- 19 ---- */
    if (isDoc && !v5.prose.length) {
      fail({
        rule: 'zero-prose-nodes-on-a-document-surface',
        at: key,
        note: 'THE RELOCATED ZERO-NODE META-ASSERTION — a gate that measures nothing must fail',
      });
    }
    for (const p of v5.prose) {
      if (p.chars > PROSE_MAX_CHARS) {
        fail({
          rule: 'prose-line-exceeds-75-characters',
          at: key,
          chars: p.chars,
          cls: p.cls,
          width: p.width,
          advance: p.advance,
          note: 'DESIGN.md §5. `ch` over-reports by 1.556× in this typeface — 68ch is 106 characters, not 68.',
        });
      }
      if (width >= PROSE_FLOOR_FROM && p.chars < PROSE_MIN_CHARS) {
        fail({
          rule: 'prose-line-below-45-characters',
          at: key,
          chars: p.chars,
          cls: p.cls,
          note: 'asserted at ≥390 only — at 320 the viewport governs and 40.1 characters is ACCEPTED',
        });
      }
    }

    /* ---- 20 ---- */
    if (v5.gaps.length) {
      fail({
        rule: 'paragraph-gap-below-its-line-height',
        at: key,
        cases: v5.gaps.slice(0, 6),
        note: '24 against a 22.4 line box is 1.07×. At --s2 the gap is 0.71× the leading and the paragraphs read as one block.',
      });
    }

    /* ---- 21 ---- */
    if (v5.bareLinks.length) {
      fail({
        rule: 'prose-link-not-underlined-at-rest',
        at: key,
        cases: v5.bareLinks.slice(0, 6),
        note: 'SC 1.4.1 — inside a paragraph an unmarked link is distinguished from body text BY HUE ALONE',
      });
    }

    /* ---- 22 ---- */
    if (v5.deepHeadings.length) {
      fail({
        rule: 'document-heading-below-h3',
        at: key,
        cases: v5.deepHeadings.slice(0, 6),
        note: 'if a legal page needs an h4, the document is badly structured, not badly styled',
      });
    }
    if (v5.skips.length) {
      fail({ rule: 'document-heading-level-skipped', at: key, cases: v5.skips.slice(0, 6) });
    }

    /* ---- 23 ---- */
    if (isDoc && v5.amberDoc.length) {
      fail({
        rule: 'amber-on-a-document-surface',
        at: key,
        n: v5.amberDoc.length,
        where: v5.amberDoc.slice(0, 6),
        note: 'AMBER MEANS MONEY YOU KEEP, PRODUCT-WIDE (tokens.css N1). A methodology is not money.',
      });
    }
    if (v5.amberGate.length) {
      fail({
        rule: 'amber-in-the-consent-gate',
        at: key,
        n: v5.amberGate.length,
        where: v5.amberGate.slice(0, 6),
        note: 'a consent choice is not money. The tempting fourth place for amber is a louder `Aceptar`, and this assertion is why that temptation costs a build instead of a review comment.',
      });
    }

    /* ---- 24 ----
       EVERY WIDTH, ON EVERY ROUTE, AND WITH NO CONSENT COOKIE IN THE CONTEXT —
       measure.mjs opens a fresh context per width, so the first-visit state is the
       state under test by construction. A gate that is missing there is a gate that
       measured nothing, which passes, which is worse than failing. */
    if (!v5.consent) {
      fail({
        rule: 'consent-gate-not-found-with-no-consent-cookie',
        at: key,
        note: '.consent is a plain global class for exactly this reason; a gate that measures nothing must fail',
      });
    } else {
      const budget = consentPxBudget(width);
      if (v5.consent.h > budget) {
        fail({
          rule: 'consent-gate-exceeds-its-px-budget',
          at: key,
          h: v5.consent.h,
          budget,
          note: 'a raw px cap alone passes on a tall desktop viewport, which is why the ratio below runs too',
        });
      }
      if (v5.consent.h / v5.consent.viewportH > CONSENT_PCT_CEIL) {
        fail({
          rule: 'consent-gate-exceeds-17pct-of-viewport',
          at: key,
          pct: v5.consent.pct,
          ceiling: CONSENT_PCT_CEIL * 100,
        });
      }
      if (v5.consent.bodyOverflow === 'hidden') {
        fail({
          rule: 'consent-gate-blocks-the-page',
          at: key,
          note: 'it is a bar, not a cookie wall — the document stays scrollable underneath it',
        });
      }
      if (v5.consent.role === 'dialog') {
        fail({
          rule: 'consent-gate-announces-itself-as-a-dialog',
          at: key,
          note: 'it does not block the page, so role="dialog" misannounces. role="region".',
        });
      }

      /* ---- 25: REJECT IS NOT HARDER THAN ACCEPT ----
         THE ASSERTION IN THIS FILE MOST LIKELY TO ROT. It is exactly the rule a later
         "conversion" tweak walks back by four pixels and one shade at a time, and
         nothing else we own would notice. */
      /* ---- 26 v7 §5.4-3 — THE CONSENT BAR MAY NOT OCCLUDE THE FIRST PRICE ----
         MEASURED TWICE, TEN DAYS APART, UNCHANGED: on 2026-08-01 (v6 §4.4.1) and
         again on 2026-08-11, T4 at 390 put the first price at y 675–721 with the
         bar starting at 717. Four pixels. On T1 the price ran 751–797 and was
         entirely behind it. That is 88% of this product's landing pages, on a
         phone, arriving from a mobile Google result, with no price on the first
         fold — the single largest measured defect on the site, and it survived two
         design passes because nothing in the gate stack could see it: the bar was
         inside its height budget, inside its viewport ratio, both buttons were
         identical, and the page did not overflow. Every existing assertion passed.

         IT IS ASSERTED AT EVERY WIDTH, NOT ONLY AT 390. §5.4-3 states it at 390 on
         T1 and T4 because that is where it was measured, but the rule is not about
         390 — a bar that covers the price at 320, or on a short laptop viewport,
         is the same defect, and pinning the assertion to the width where it was
         found is how a gate ends up testing the one case somebody already fixed. */
      if (v5.consent.priceBottom !== null && v5.consent.priceBottom > v5.consent.top) {
        fail({
          rule: 'consent-gate-occludes-the-first-price',
          at: key,
          priceBottom: v5.consent.priceBottom,
          consentTop: v5.consent.top,
          overlap: +(v5.consent.priceBottom - v5.consent.top).toFixed(1),
          note: 'v7 §5.4-3 — a consent bar that covers the number the page exists to show is a defect, not a nit',
        });
      }

      const acc = v5.consent.acts.find((a) => a.action === 'granted');
      const rej = v5.consent.acts.find((a) => a.action === 'denied');
      if (!acc || !rej) {
        fail({
          rule: 'consent-gate-does-not-offer-two-equal-actions',
          at: key,
          found: v5.consent.acts.map((a) => a.action),
        });
      } else {
        for (const prop of Object.keys(acc.props)) {
          if (acc.props[prop] !== rej.props[prop]) {
            fail({
              rule: 'reject-is-not-styled-identically-to-accept',
              at: key,
              prop,
              accept: acc.props[prop],
              reject: rej.props[prop],
            });
          }
        }
        const spread = Math.abs(acc.w - rej.w) / Math.max(acc.w, rej.w);
        if (spread > CONSENT_WIDTH_TOLERANCE) {
          fail({
            rule: 'reject-button-differs-in-width-by-more-than-8pct',
            at: key,
            accept: acc.w,
            reject: rej.w,
            note: 'labels differ in length; treatment may not',
          });
        }
      }
    }
    if (scales.bands.length) fail({ rule: 'scales-node-outside-declared-band', at: key, cases: scales.bands.slice(0, 8) });
    if (scales.ctm.length) fail({ rule: 'svg-user-space-is-not-1to1-css-px', at: key, cases: scales.ctm.slice(0, 8) });
    if (scales.bars.length) fail({ rule: 'proportional-bar-disagrees-with-its-data', at: key, cases: scales.bars.slice(0, 8) });

    if (rows.count) {
      if (rows.heights.length !== 1) {
        fail({ rule: 'row-heights-not-uniform', at: key, heights: rows.heights, count: rows.count });
      } else if (rows.token !== null && rows.heights[0] !== rows.token) {
        fail({ rule: 'row-height-not-token', at: key, measured: rows.heights[0], token: rows.token });
      }
      if (rows.overflow.length) {
        fail({ rule: 'row-content-overflows-box', at: key, cases: rows.overflow.slice(0, 6) });
      }
    }

    if (seps.hits.length) fail({ rule: 'separator-at-line-boundary', at: key, cases: seps.hits.slice(0, 8) });
    if (charts.hits.length) fail({ rule: 'chart-labels-collide', at: key, cases: charts.hits.slice(0, 8) });
    if (overflowX.scrollWidth > width + 1) {
      fail({ rule: 'document-overflows-viewport', at: key, ...overflowX });
    }

    /* ---- the v4.1 assertions ---- */
    const c = composition;

    /* THE STICKY-CHROME CEILING — every width. A chrome that is not found at all is a
       gate selecting zero nodes, which passes and is worse than failing. */
    if (!c.chromeFound) {
      fail({ rule: 'sticky-chrome-not-found', at: key, note: '.chrome is a global class for exactly this reason; a gate that measures nothing must fail' });
    } else if (c.sticky && c.stickyH / c.viewportH > STICKY_CEIL) {
      fail({
        rule: 'sticky-chrome-exceeds-12pct-of-viewport',
        at: key,
        height: c.stickyH,
        viewport: c.viewportH,
        pct: c.stickyPct,
        note: 'paid on every pixel of scroll, not once',
      });
    }

    /* THE PHOTOGRAPHY FLOOR IS A CLAIM ABOUT A BROWSE SURFACE, NOT ABOUT EVERY PAGE.
       §7.2 states it as "T1 image area", and the reason generalises: T1, T2 and the
       search results are card grids whose whole job is to show 24 products, so 14% is a
       floor they must clear. A PRODUCT PAGE CANNOT AND SHOULD NOT — it renders one shot
       plus a 4-card similar rail (measured 4.36% and 5.16%), and "add photographs to a
       product page until it hits 14%" is not a correction anybody asked for; it would
       be padding.

       The test is STRUCTURAL rather than a pathname list, so a route added later is
       classified correctly without editing this gate: a browse surface renders MORE
       ProductCards than a similar-products rail can hold (`similarTo`'s limit is 4).
       Browse surfaces render 24, product pages exactly 4. */
    const isBrowseGrid = scales.cards > 4;

    if (width === DESIGN_W && isBrowseGrid) {
      /* Guarded by the zero-size count first: if the images are present but undecoded,
         the area figure is a measurement of a loading state and asserting on it would
         be asserting on nothing. */
      if (c.imgsZero > 0) {
        fail({
          rule: 'images-rendered-at-zero-size',
          at: key,
          zero: c.imgsZero,
          of: c.imgs,
          note: 'the photography floor cannot be measured on undecoded images — a page of empty squares would otherwise fail for the wrong reason, or pass for one',
        });
      } else if (c.imageArea / c.pageArea < IMAGE_FLOOR) {
        fail({
          rule: 'image-area-below-14pct',
          at: key,
          pct: c.imagePct,
          floor: IMAGE_FLOOR * 100,
          images: c.imgs,
          note: 'THE CHROMA CORRECTION HAS REGRESSED. v4 built 7.05%, zap runs ~14%. The fix is bigger photographs, never more hues — and after v4.1-fix B6 removed the 24 solid card CTAs, this assertion is the ONLY thing standing behind the chroma claim.',
        });
      }

      /* THE AMBER PAGE-AREA CEILING USED TO BE ASSERTED HERE AND IS DELETED (N2). The
         metric fell as the page grew, so it rewarded length. Its replacements — an object
         count per card/row/plate, and a densest-100vh window — run at EVERY width rather
         than only at the design width, which is the other half of the correction: the
         2.28% reading that started this was taken at 320, a width the old rule never
         looked at. `composition.amberPct` is still MEASURED and reported; it is simply no
         longer a gate. */
    }

    await ctx.close();
  }
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
