/* ==========================================================================
   THE TITLE/CTR EXPERIMENT — the "adjust" link of the growth loop.

   The growth-loop plan, Loop A. the daily SEO read-out has been
   writing the same diagnosis every morning — "364 impressions and zero clicks,
   that is a TITLE/SNIPPET problem, the cheapest fix available in SEO" — and
   nothing acted on it. This is the thing that acts on it.

   ---- WHY THIS IS A CONTROLLED EXPERIMENT AND NOT A TITLE CHANGE ------------
   THE HELD-BACK HALF IS THE ENTIRE POINT. Impressions on this site are
   already climbing on their own — 13 → 364 over three weeks, with the query
   count going 2 → 38. Rewrite every title and watch CTR rise and you have
   learned NOTHING: the rise is exactly what the pre-existing trend predicts. A
   number moving after you touched something is not evidence that you moved it.

   So half the eligible pages keep the title they have. The comparison is
   treatment-vs-control IN THE SAME WEEK, on the same site, under the same
   crawl budget and the same seasonality — which is the only way to attribute
   a CTR change to the copy rather than to time.

   ---- THE ASSIGNMENT IS A PURE FUNCTION OF THE PRODUCT ID -------------------
   Not random, not stored, not a database. `fnv1a(id)` is deterministic across
   builds, machines and languages, so:

     · a page's arm NEVER changes between two deploys, which is what gives us
       the 21-day hold-down for free — there is no churn to suppress because
       there is no source of churn;
     · nothing has to be persisted, so there is no state to lose, migrate or
       disagree with;
     · and the split cannot drift as the catalogue grows. New products land in
       whichever arm their own id dictates, at the same ~50/50 ratio.

   A stored assignment would have been the obvious design and every one of
   those three properties would have had to be built and defended separately.

   ---- ELIGIBILITY IS NARROWER THAN THE CATALOGUE, ON PURPOSE ---------------
   ONLY `brecha` PRODUCTS ARE IN THE EXPERIMENT. The treatment title's whole
   argument is a saving — `ahorrá ₡155.390` — and a product only one chain
   sells has no saving to state. If the population included `solo` and `parejo`
   pages, the control arm would quietly fill up with pages that COULD NOT have
   received the treatment even in principle, and the two arms would no longer
   be comparable. That is the classic way an A/B test reports a real-looking
   difference that is entirely composition.

   `/experiment.json` therefore lists ONLY eligible pages, and the read-out in
   the daily SEO read-out scores only pages that appear in it. A page missing from that
   manifest is excluded from both arms rather than defaulted into one.

   ---- ACTIVATION IS A DATED COMMIT, NOT AN ENV VAR -------------------------
   `ACTIVE` is null until the experiment starts, and starting it is a one-line
   change to this file. That is deliberate: `startedOn` is DATA — every read-out
   is "CTR since the titles changed", and an env var flipped in a dashboard
   leaves no record of when that was. Git does.

   With `ACTIVE = null` the build is byte-identical to one where this file does
   not exist: `armOf()` returns 'control' for everything and `/experiment.json`
   reports `running: false`.
   ========================================================================== */

export type Arm = 'control' | 'treatment';

export interface Experiment {
  /** Also the hash salt — changing it RE-RANDOMISES every assignment, which is
   *  how a second experiment gets a fresh split rather than inheriting this
   *  one's. Never reuse an id with a different hypothesis. */
  id: string;
  /** The date the treatment titles actually reached production, ISO. Every
   *  read-out is measured from here, so it is set in the same commit that sets
   *  `ACTIVE` and never afterwards. */
  startedOn: string;
  /** Stated before the data arrives, so it cannot be edited to fit the result. */
  hypothesis: string;
}

export const TITLE_CTR_01: Experiment = {
  id: 'title-ctr-01',
  startedOn: '',
  hypothesis:
    'The control title states a price and a chain, which is what every retailer '
    + 'result on the SERP already states. It never mentions the comparison — the '
    + 'one thing this site has and they do not. Front-loading the saving should '
    + 'raise CTR on the eligible set relative to control.',
};

/* SET THIS TO `TITLE_CTR_01` AND FILL IN ITS `startedOn` TO START THE CLOCK.
   Both edits in one commit; the commit date and `startedOn` must agree. */
export const ACTIVE: Experiment | null = null;

/** FNV-1a, 32-bit, the reference implementation.
 *
 *  Chosen over anything cryptographic because it is short enough to be OBVIOUSLY
 *  identical if it ever has to be reimplemented, and fast enough to run over the
 *  whole catalogue on every build without being noticed.
 *
 *  `charCodeAt` makes this a UTF-16 code-unit hash. Product ids are engine-built
 *  ASCII slugs (`mabe-mmt18cdbwccm1`), so that is not currently reachable — but
 *  if ids ever carry non-ASCII, this function's output changes for those ids and
 *  their arms move. That would invalidate a running experiment, which is why the
 *  constraint is written down here rather than assumed. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Salted with the experiment id so a future experiment re-splits the catalogue
 *  instead of reusing this one's assignment — otherwise the same products would
 *  sit in the treatment arm forever and any per-product quirk would ride along
 *  with them into every result we ever measure. */
export function armOf(productId: string, exp: Experiment | null = ACTIVE): Arm {
  if (!exp) return 'control';
  return fnv1a(`${exp.id}:${productId}`) % 2 === 0 ? 'control' : 'treatment';
}
