/* T1 — THE HOME PAGE. v8, Figma 6:4. Composition order, top to bottom:

     chrome        (layout)  74px bar + 52px category strip, and the freshness
                             strip is suppressed on `/` — the hero's own trust
                             badges carry that claim, and printing the same
                             sentence twice above the fold reads as a bug
     hero          6:43      headline · paragraph · three badges · the photograph
     scroller      6:79      fifteen category tiles + Brechas
     rail 1        6:115     the best-evidenced category, 4 RailCards
     browse grid   6:245     the seven categories the chrome does NOT carry
     rail × 4      6:283…    the next four
     footer        (layout)

   ---- WHAT LEFT THIS PAGE, AND WHERE IT WENT ------------------------------
   `TrustBand` — four readings, the freshness distribution and the method note.
   The frame has no such band, and its content did not evaporate: the four
   standing disclosures (freshness, the FX basis, the assumed location, and that
   this site sells nothing) are in the footer on every page now, and the band
   itself still renders in full on /metodologia, where a reader who wants the
   distribution is already standing.

   `SiteMapBlock` — fourteen categories and eight chains as crawlable links. It
   is DELETED, not moved, and the SEO reasoning is worth stating because
   deleting a link block usually is a regression. It is not one here: the
   scroller above renders all fifteen categories as real `<Link>`s in the
   server-rendered HTML, the browsing grid renders seven of them again, and the
   footer renders eight categories plus six chains. Crawlable coverage went UP,
   not down, and /categorias remains the canonical index.

   ---- WHAT v4 SAID ABOUT THIS PAGE, AND WHY IT NO LONGER HOLDS ---------
   The v7.2 header of this file read: "WHAT T1 MUST NEVER GROW: a headline, a
   subhead, two buttons, three feature cards." The redesign draws a headline, a
   subhead, three trust badges and a photograph. That is not drift and it is not
   a workaround — it is the same person reversing his own call with a finished
   design, and the prohibition is deleted rather than left standing above code
   that contradicts it. */

import type { Gaps } from '@/lib/gaps.server';
import type { ServerCatalog } from '@/lib/server-catalog';
import type { BuildStats } from '@/lib/stats.server';
import { CategoryRail } from './CategoryRail';
import { Featured } from './Featured';
import { HeroBanner } from './HeroBanner';
import { OfflineBanner } from './States';

export function HomeScreen({
  stats, cat, gaps,
}: {
  stats: BuildStats;
  /** the build-time catalogue, read once per build and shared with every other
   *  server-rendered route. */
  cat: ServerCatalog;
  /** the same memoised `buildGaps()` /brechas renders from */
  gaps: Gaps;
}) {
  return (
    <>
      <HeroBanner />
      <OfflineBanner stamp={stats.freshLong} />
      {/* SERVER-RENDERED and first under the fold: it reads the build-time
          catalogue, so it must not wait for products.json to reach the browser. */}
      <CategoryRail stats={stats} />
      <Featured cat={cat} gaps={gaps} cats={stats.cats} />
    </>
  );
}
