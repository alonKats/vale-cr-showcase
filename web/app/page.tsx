/* T1. The category rail is composed HERE, on the server, and handed to the screen as
   a node: it reads the build-time catalogue and it is the first thing above the fold,
   so it must not wait for products.json to land in the browser.

   v7.2 §1.2 / H1 — AND THE PRODUCT RAILS ARE NOW COMPOSED HERE TOO. `HomeScreen` is
   no longer a client screen: it takes the build-time catalogue itself and renders
   every rail into the HTML. `serverCatalog()` is memoised per build and the layout has
   already called it, so passing the whole object costs one map lookup rather than a
   copy — and it is the same object, with the same ranking, that `/categoria/[slug]`
   renders from.

   v3 also passed a `hero` node — the `Bodegon` still life. IT IS DELETED, and nothing
   replaces it: zap's home page has no hero at all, it opens on the category rail, and
   that is the whole posture change v4 exists for. */

import { HomeScreen } from '@/components/HomeScreen';
import { buildGaps } from '@/lib/gaps.server';
import { serverCatalog } from '@/lib/server-catalog';
import { buildStats } from '@/lib/stats.server';

export default function Home() {
  const stats = buildStats();
  /* v7.2 §3.2 — THE SAME memoised `buildGaps()` /brechas renders from, so the
     plate's product and the strip's axis maximum are one computation. `byPct[0]`
     — the widest-PERCENTAGE gap — is therefore literally the strip's right-hand
     end. `byCrc[0]` would put a 32% product above an axis labelled `máximo 80%`. */
  return (
    <HomeScreen
      stats={stats}
      cat={serverCatalog()}
      gaps={buildGaps()}
    />
  );
}
