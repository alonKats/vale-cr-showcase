import Script from 'next/script';

/* Google analytics tags — GA4 directly, or GTM, but NEVER both measuring GA4.

   ---- WHY THIS IS A COMPONENT AND NOT A SNIPPET IN layout.tsx ----

   Two rules have to hold, and both are the kind that get broken silently:

   1. NO DOUBLE COUNTING. If the hardcoded GA4 snippet is on the page AND a GA4
      tag is configured inside GTM, every pageview fires twice. Sessions, users
      and engagement all inflate, nothing errors, and the historical data stays
      wrong forever — you cannot retroactively halve it. So GTM, when present,
      OWNS GA4 exclusively: set NEXT_PUBLIC_GTM_ID and the direct GA4 tag stops
      rendering, whatever NEXT_PUBLIC_GA_ID says. The rule is enforced here
      rather than written in a runbook, because a runbook is not a mechanism.

   2. NO DATA FROM PLACES THAT ARE NOT THE SITE. Both ids come from env vars and
      are absent by default, so `next dev`, a local production build and any
      preview deployment send nothing. Only an environment that has explicitly
      been given the id reports. This is the same discipline as SITE_URL in
      lib/seo.ts: a measurement that quietly includes localhost traffic is worse
      than no measurement, because you will trust it.

   The ids are not secrets — a measurement id ships in the page source of every
   site that uses it. They are env vars for the reasons above, not for secrecy.

   ---- ON `afterInteractive` ----

   Google's own snippet is `async` in <head>. `afterInteractive` is the Next
   equivalent that does not block the first paint: the tag loads after hydration.
   For a site whose entire argument is 2.170 statically-rendered pages that must
   read fast, analytics does not get to be in the critical path. Pageviews are
   still recorded — gtag queues the calls in `dataLayer` before the library
   arrives. */

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

export function Analytics() {
  /* GTM first, and it is exclusive. See rule 1. */
  if (GTM_ID) {
    return (
      <Script id="gtm" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>
    );
  }

  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
