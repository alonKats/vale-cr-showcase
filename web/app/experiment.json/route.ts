/* /experiment.json — the cohort manifest for the title/CTR experiment.
   ==========================================================================

   WHY THIS ENDPOINT EXISTS AT ALL, WHICH IS THE ONLY INTERESTING THING ABOUT IT.

   The read-out lives in the daily SEO read-out. The assignment lives in
   `lib/experiment.ts`. Those are different languages, so the obvious design is
   to write `fnv1a` twice — once in TypeScript for the build and once in Python
   for the analysis — and the two drift the first time anybody touches either.
   A read-out that scores pages into the wrong arms does not fail loudly; it
   produces a plausible number, and a plausible number is the worst available
   outcome for an experiment whose entire job is to be believed.

   So the arm is computed ONCE, in the build that actually renders the titles,
   and published as data. Python joins against this file and implements no hash
   at all.

   AND IT IS FETCHED FROM THE LIVE SITE, NOT READ OFF DISK. That is the second
   reason for a route rather than a build artifact in the repo: this file is
   emitted by the same build that emitted the titles, so what it reports is what
   PRODUCTION shipped — not what the local checkout believes production shipped.
   Those two have already disagreed once on this project, for twenty days, and
   the GA4 tag was the casualty (see `components/Analytics.tsx`). The manifest is
   deployed by the same `vercel --prod` that deploys the pages it describes, so
   they cannot come apart.

   ---- KEYED BY PATH -------------------------------------------------------
   Search Console reports pages as absolute URLs. Keying by path lets the
   read-out strip the origin and look up directly, so no id↔URL mapping has to
   exist on the Python side either.

   ---- ONLY ELIGIBLE PAGES APPEAR ------------------------------------------
   `solo` and `parejo` products are absent, not listed as 'control'. A page
   missing from `arms` is OUTSIDE the experiment and must be excluded from both
   arms — never defaulted into one. See the eligibility section of
   `lib/experiment.ts` for why that distinction is load-bearing. */
import { ACTIVE, armOf } from '@/lib/experiment';
import { inTitleExperiment } from '@/lib/seo';
import { serverCatalog } from '@/lib/server-catalog';

export const dynamic = 'force-static';

export function GET(): Response {
  /* The SAME `serverCatalog()` every page renders from, so `band` here is the
     band the page itself used. Recomputing eligibility from raw offers would be
     a second implementation of `enrich()` and is exactly the trap this file
     exists to avoid. */
  const { products } = serverCatalog();
  const eligible = products.filter(inTitleExperiment);

  const arms: Record<string, string> = {};
  let treatment = 0;
  for (const p of eligible) {
    const a = armOf(p.id);
    arms[`/producto/${p.id}`] = a;
    if (a === 'treatment') treatment += 1;
  }

  const body = {
    running: ACTIVE !== null,
    id: ACTIVE?.id ?? null,
    startedOn: ACTIVE?.startedOn ?? null,
    hypothesis: ACTIVE?.hypothesis ?? null,
    counts: {
      catalogue: products.length,
      eligible: eligible.length,
      treatment,
      control: eligible.length - treatment,
    },
    /* Empty while `ACTIVE` is null — every page is control, so there is nothing
       to score and the read-out correctly reports "not running" rather than
       inventing a 100/0 split. */
    arms: ACTIVE === null ? {} : arms,
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
