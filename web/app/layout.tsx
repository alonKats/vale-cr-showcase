import type { Metadata, Viewport } from 'next';

import { Analytics } from '@/components/Analytics';
import { CompareTray } from '@/components/CompareTray';
import { Consent } from '@/components/Consent';
import { JsonLd } from '@/components/JsonLd';
import { ServiceWorker } from '@/components/ServiceWorker';
import { SiteFooter } from '@/components/SiteFooter';
import { TopBar } from '@/components/TopBar';
import { AppProvider } from '@/lib/app-store';
import { COOKIE_NAME, POLICY_VERSION } from '@/lib/consent';
import {
  organizationJsonLd,
  SITE_NAME,
  SITE_URL,
  siteDescription,
  siteTitle,
  siteJsonLd,
} from '@/lib/seo';
import { retailerNames } from '@/lib/types';
import { serverCatalog } from '@/lib/server-catalog';
import { buildStats } from '@/lib/stats.server';

import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/plus-jakarta-sans';
import './tokens.css';
import './globals.css';

const boot = serverCatalog();

export const metadata: Metadata = {
  // Every canonical, sitemap entry and OG url in the app is relative and resolved
  // against this. One env var moves the whole site to its real host.
  metadataBase: new URL(SITE_URL),
  title: {
    // 66 characters until 2026-08-29, so Google cut it at "…y electrónica en" and
    // the site LOST "Costa Rica" in the one market it serves. Built from the
    // retailer count now, never hardcoded — see siteTitle in lib/seo.ts.
    default: siteTitle(retailerNames(boot.meta.retailers)),
    template: `%s · ${SITE_NAME}`,
  },
  // retailerNames(), never `.join()` on meta.retailers: the array is objects, and
  // joining it printed "[object Object]" into the description of 8.701 built pages
  // with tsc green throughout (lib/types.ts).
  description: siteDescription(retailerNames(boot.meta.retailers), boot.products.length),
  alternates: { canonical: '/' },
  manifest: '/manifest.webmanifest',
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'default' },
  openGraph: { type: 'website', locale: 'es_CR', siteName: SITE_NAME, url: '/' },
};

export const viewport: Viewport = {
  // The one literal colour outside tokens.css, and it cannot be anything else:
  // `theme-color` paints browser chrome, so it is a meta tag and a var() there
  // resolves to nothing. v4 value is --deep (#02565F) — the header's own tier-1
  // colour, so the OS chrome continues the bar instead of contradicting it. It was
  // --paper (#FAF7F2) in v3; that token no longer exists.
  themeColor: '#02565F',
  width: 'device-width',
  initialScale: 1,
};

/* The chrome, the top bar and the tray live in the layout, so moving between the home
   page and the results never unmounts them.

   v4: `main` carries no measure and needs none — every screen carries its own 1200
   `pg.shell`, and the full-bleed hairline bands v3 needed a full-width `main` for are
   gone with --s6 / --s7. Section separation is now 24px + a --line hairline INSIDE the
   shell (§2.2).

   THE PRODUCT OVERLAY IS GONE. `@modal/(.)producto/[slug]` intercepted every
   in-app product click and opened the product as a sheet over the preserved
   list; a plain page-to-page navigation reads better and was preferred.

   Nothing about addressability changes — `ProductLink` was always a real
   `<a href="/producto/…">`, so the canonical URL, middle-click, open-in-new-tab
   and every crawler already saw the truth. What is lost is the preserved scroll
   position behind the overlay; what is gained is one rendering per URL instead
   of two, and the route tree loses a parallel slot it no longer feeds. */

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const stats = buildStats();
  const { cats } = boot;

  return (
    <html lang="es-CR">
      <body>
        {/* ==========================================================================
            CONSENT MODE v2 — THE DEFAULT, AND IT HAS TO BE FIRST.

            Ley 8968 requires EXPRESS consent before analytics fires, and that
            obligation is discharged by the TAG, not by the banner. A banner that
            sets cookies before the click is worse than no banner, because it
            documents intent to comply while not complying.

            So the default is DENIED and it is set here, synchronously, before any
            tag can load — the banner only ever sends an `update`. That ordering is
            what makes "no analytics before consent" true BY CONSTRUCTION rather than
            by timing, which is the difference between a mechanism and a race.

            The stored-grant replay is the other half: a returning visitor who
            already accepted is measured without being asked again, and one who
            refused is never re-asked. A banner that re-nags a refusal arguably
            invalidates the "free" quality of consent under Ley 8968.

            NOTHING HERE LOADS A TAG. GTM gates the tag against this signal; with
            no container published this is inert and correct.
            ========================================================================== */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'window.dataLayer=window.dataLayer||[];' +
              'function gtag(){dataLayer.push(arguments)}' +
              "gtag('consent','default',{'analytics_storage':'denied','ad_storage':'denied'," +
              "'ad_user_data':'denied','ad_personalization':'denied','wait_for_update':500});" +
              `try{var m=document.cookie.match(/(?:^|;\\s*)${COOKIE_NAME}=([^;]*)/);` +
              'if(m){var c=JSON.parse(decodeURIComponent(m[1]));' +
              `if(c&&c.v===${POLICY_VERSION}&&c.c==='granted')` +
              "gtag('consent','update',{'analytics_storage':'granted'})}}catch(e){}",
          }}
        />
        {/* FIRST IN THE TAB ORDER, though it renders at the bottom of the screen.
            Appended at the end of the body it would sit behind the chrome's search
            input, six nav links and the whole page — keyboard users get a legal
            decision last. This is the honest order. */}
        {/* THE TAG ITSELF, AFTER THE CONSENT-MODE DEFAULTS ABOVE AND NOT BEFORE.
            The shim declares `gtag` and sets `analytics_storage: denied` with a
            500ms `wait_for_update`; this component then loads the library, which
            drains the queue under whatever consent state the shim established.
            Reversed, the library would boot with no defaults and the first
            pageview would be recorded before the visitor's stored refusal replays.

            BOTH IDS COME FROM THE ENVIRONMENT AND ARE ABSENT BY DEFAULT, so
            `next dev`, a local production build and every preview deployment send
            nothing. Only production has been given the id. See the file header for
            the twenty-day outage this component's absence from master caused. */}
        <Analytics />
        <Consent />
        <JsonLd data={[siteJsonLd(), organizationJsonLd(boot.cats, boot.meta)]} />
        <AppProvider>
          {/* TIER 2 CARRIES THE CATEGORIES, not verticals: zap dispatches between
              phones, appliances, fashion and cosmetics there, and we have exactly one
              vertical. A vertical switcher for a single vertical is furniture. */}
          <TopBar freshShort={stats.freshShort} cats={stats.cats} />
          <main>{children}</main>
          <SiteFooter
            cats={boot.cats}
            retailers={boot.meta.retailers}
            freshLong={stats.freshLong}
            fx={stats.fx}
          />
          <CompareTray />
          <ServiceWorker />
        </AppProvider>
      </body>
    </html>
  );
}
