/* THE CANONICAL PRODUCT PAGE — 737 of them, statically generated, no client
   JavaScript required to read a single word of it.

   This is the route the commercial plan rests on: the money keywords are
   long-tail product queries ("precio refrigeradora Samsung RF29 Costa Rica")
   and until this existed the app had exactly two indexable URLs for 737
   products. It is also the URL the in-app overlay puts in the address bar, so
   there is one address per product and no duplicate-content twin.

   Everything below is composed from the artifact by lib/seo.ts. The honesty
   rules apply here twice over — see the header of that file for why no US
   rating ever reaches the JSON-LD. */

import type { Metadata } from 'next';

import { Breadcrumb } from '@/components/Breadcrumb';
import { Detail } from '@/components/Detail';
import { DetailActs } from '@/components/DetailActs';
import { JsonLd } from '@/components/JsonLd';
import pg from '@/components/Page.module.css';
import { similarTo } from '@/lib/catalog';
import {
  breadcrumbJsonLd, categoryPath, productDescription, productHeading, productImages,
  productJsonLd, productName, productPath, productTitle,
  SITE_NAME,
} from '@/lib/seo';
import { buildGaps } from '@/lib/gaps.server';
import { serverCatalog } from '@/lib/server-catalog';

// Every slug is known at build time; anything else is a 404, not a render.
export const dynamicParams = false;

export function generateStaticParams() {
  return serverCatalog().products.map((p) => ({ slug: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = serverCatalog().byId.get(slug);
  if (!p) return {};

  const title = productTitle(p);
  const description = productDescription(p);
  const images = productImages(p);
  const url = productPath(p.id);

  return {
    // absolute: the title already carries the brand, the model, the price, the
    // chain and the country — a " · Vale" suffix would only cost pixels in
    // the SERP.
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      locale: 'es_CR',
      siteName: SITE_NAME,
      // The engine self-hosts retailer photography as WebP at 160/320/640. The
      // widest is the share image; there is no separately authored 1200×630
      // card, and inventing one would be a picture of nothing.
      images: images.length ? [{ url: images[images.length - 1] }] : undefined,
    },
    twitter: {
      card: images.length ? 'summary_large_image' : 'summary',
      title,
      description,
      images: images.length ? [images[images.length - 1]] : undefined,
    },
  };
}

export default async function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = serverCatalog();
  const product = cat.byId.get(slug)!;
  const profile = cat.catMap.get(product.category);

  return (
    <>
      {/* `productJsonLd` returns null for a product with no image: `image` is
          required for a merchant listing, so that node would be invalid rather
          than merely thin (Search Console, 2026-08-29). `.filter(Boolean)`
          drops it and the breadcrumb still ships. See lib/seo.ts. */}
      <JsonLd
        data={[
          productJsonLd(product, cat.meta),
          breadcrumbJsonLd([
            { name: 'Inicio', path: '/' },
            { name: product.catLabel, path: categoryPath(product.category) },
            { name: productHeading(product), path: productPath(product.id) },
          ]),
        ].filter((n): n is NonNullable<typeof n> => n !== null)}
      />

      {/* v4: every page carries the 1200 shell. The full-bleed band sections v3
          separated with 96px of air are gone, so `main` no longer needs to be
          full-width for a hairline to reach the viewport edge. */}
      <div className={pg.shell}>
        {/* The standalone frame the overlay does not need: the crawlable trail from
            this page to its category, and the two controls that need a browser. */}
        <div className={pg.secHead}>
          <Breadcrumb
            trail={[
              { name: 'Inicio', path: '/' },
              { name: profile?.label ?? product.catLabel, path: categoryPath(product.category) },
              { name: productHeading(product) },
            ]}
          />
          <DetailActs id={product.id} name={productName(product)} />
        </div>
      </div>

      {/* `<article>` LEAVES THE SHELL. `Detail` opens on a
          full-bleed --hero band carrying the dot field, and inside a 1280 shell
          that band stopped at the container edge — the one thing on the page that
          is supposed to reach the viewport was the one thing that could not.

          It is structural rather than a `100vw` break-out on purpose: `100vw`
          includes the scrollbar, so the classic `margin-inline: calc(50% - 50vw)`
          trick buys a full-bleed band and a horizontal scrollbar with it. A
          `box-shadow`/`clip-path` bleed avoids that but paints only a flat
          colour, and this band's whole point is the PATTERN.

          So `Detail` is full-width now and re-applies the shell per region — see
          `.hdr` and `.sec` in Product.module.css. */}
      <article>
          <Detail
            product={product}
            nearest={cat.nearest}
            branches={cat.branches}
            /* ONE ranking function, shared with the overlay — see similarTo(). */
            similar={similarTo(product, cat.byCategory.get(product.category) ?? [])}
            fx={cat.meta.fx_rate_crc_usd}
            now={Date.parse(cat.meta.generated_at)}
            history={cat.history[product.id]}
            /* v7 §10.1 — the price-history meter's DENOMINATOR, read off the
               artifact's own observation window. It was a constant 7 while the
               window was 10, and 92 pages printed `8 de 7` / `9 de 7`. */
            windowDays={cat.meta.price_history?.observation_window?.distinct_days}
            /* §2.1 — the spread bar's catalogue-wide axis. `buildGaps()` is used
               rather than reading `meta` directly BECAUSE it is the function that
               asserts the published axis against a recomputed one: touching it
               here means the check runs on the first product page of the build,
               not only if /brechas happens to be built. It is cached per build. */
            axisMaxPct={buildGaps().axisMaxPct}
            profile={profile}
            frame="page"
          />
      </article>
    </>
  );
}
