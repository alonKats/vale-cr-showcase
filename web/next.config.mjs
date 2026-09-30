/** @type {import('next').NextConfig} */
const nextConfig = {
  // Read-only data app: every route is statically generated at build time
  // (generateStaticParams + dynamicParams=false). No API routes, no DB, no auth.
  // Zero-config on Vercel.
  outputFileTracingRoot: import.meta.dirname,

  /* ONE CANONICAL HOST, ENFORCED IN TRANSPORT AND NOT ONLY IN A TAG.
     Measured 2026-08-09: https://www.vale.cr/ and every URL under it returned 200
     — a complete second copy of the site, 4.543 URLs, on a host we never intended
     to serve. The pages do carry <link rel="canonical"> pointing at the apex, so
     this was never going to split ranking; Google resolves that correctly. The cost
     is crawl budget, and on a domain first verified on 2026-08-05 that is the
     scarcest thing we have. As of today Google has crawled exactly one URL of ours
     (the homepage — every other page inspects as "URL is unknown to Google"), so
     letting a crawler spend half its allowance re-deriving that www is a duplicate
     is the most expensive thing on the site.

     A 308 answers the question once, at the edge, for the whole host. `has: host`
     matches the request's Host header, so the apex never matches its own rule and
     there is no loop. Vercel compiles this into its routing layer, which is why it
     still applies to a fully static export with no server to run. This lives here
     rather than in a Cloudflare Redirect Rule on purpose: the deploy is autonomous,
     and a redirect that exists only as dashboard state is invisible to the repo,
     absent from review, and silently lost the day the zone is rebuilt. */
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.vale.cr' }],
        destination: 'https://vale.cr/:path*',
        permanent: true,
      },
    ];
  },

  /* RESPONSE HEADERS. Audited 2026-09-01 before sharing the repo: the only
     security header the site sent was `strict-transport-security`. None of the
     four below is exotic and none of them costs anything, and their absence is
     the first thing any external reviewer greps for.

     Deliberately NOT here: a Content-Security-Policy. A real CSP for this app
     has to account for Next's inline bootstrap and the analytics loaded behind
     the consent gate, and a CSP written without exercising both paths is either
     so loose it asserts nothing or tight enough to break the page for real
     visitors — on a site with no server to roll back, mid-deploy. It is worth
     doing, with `Content-Security-Policy-Report-Only` first for a week; it is
     not worth doing blind in an audit pass.

     `permissions-policy` denies camera, microphone and geolocation because the
     app uses none of them — verified by grep, not assumed. Denying a feature you
     DO use is how a header like this becomes a bug, so it is the check that
     matters before copying anyone's boilerplate. */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // MIME sniffing turns a mis-typed .json into script in older engines.
          { key: 'x-content-type-options', value: 'nosniff' },
          // Nothing here is meant to be framed; a price page in someone else's
          // iframe is a clickjacking surface and an attribution loss at once.
          { key: 'x-frame-options', value: 'SAMEORIGIN' },
          // Send the origin cross-site, the full path same-site. Retailer
          // outbound links are the reason: they should see that traffic came
          // from vale.cr — that is the referral evidence — but not which
          // product page, which is our data.
          { key: 'referrer-policy', value: 'strict-origin-when-cross-origin' },
          { key: 'permissions-policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
