/* CATEGORY LANDING, PAGE 1 — six of them, statically generated.

   These carry the head terms ("refrigeradoras precios Costa Rica") that no individual
   product page can. The composition lives in `CategoryScreen`, shared verbatim with
   `[slug]/[page]/page.tsx`: two copies would drift, and the thing that would drift is
   the crawlable link surface the whole SEO architecture rests on. */

import type { Metadata } from 'next';

import { CategoryScreen } from '@/components/CategoryScreen';
import { JsonLd } from '@/components/JsonLd';
import { PAGE_SIZE } from '@/components/Pagination';
import {
  brandCategoryPath,
  breadcrumbJsonLd, categoryDescription, categoryJsonLd, categoryPath, categoryTitle,
  chainSentence,
  SITE_NAME,
} from '@/lib/seo';
import { buildBrands } from '@/lib/brands.server';
import { serverCatalog } from '@/lib/server-catalog';
import { retailerNames } from '@/lib/types';

export const dynamicParams = false;

export function generateStaticParams() {
  return serverCatalog().cats.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = serverCatalog();
  const profile = cat.catMap.get(slug);
  const items = cat.byCategory.get(slug) ?? [];
  if (!profile) return {};

  const names = retailerNames(cat.meta.retailers);
  const title = categoryTitle(profile, items.length, names);
  const description = categoryDescription(profile, items, names);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: categoryPath(slug) },
    openGraph: {
      type: 'website',
      url: categoryPath(slug),
      title,
      description,
      locale: 'es_CR',
      siteName: SITE_NAME,
    },
    twitter: { card: 'summary', title, description },
  };
}

export default async function CategoriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = serverCatalog();
  const profile = cat.catMap.get(slug)!;
  const items = cat.byCategory.get(slug) ?? [];

  return (
    <>
      <JsonLd
        data={[
          /* The ItemList describes the products THIS page links, not the whole
             category. An ItemList claiming 526 entries it does not link is padding,
             and it is exactly the kind of overstatement structured data gets
             republished for. */
          categoryJsonLd(profile, items.slice(0, PAGE_SIZE)),
          breadcrumbJsonLd([
            { name: 'Inicio', path: '/' },
            { name: profile.label, path: categoryPath(slug) },
          ]),
        ]}
      />
      <CategoryScreen
        brandLinks={buildBrands(cat)
          .filter((b) => b.pairs.some((pr) => pr.id === profile.id))
          .map((b) => ({
            label: b.label,
            path: brandCategoryPath(b.slug, profile.id),
            count: b.pairs.find((pr) => pr.id === profile.id)!.count,
          }))}
        profile={profile}
        items={items}
        page={1}
        chains={chainSentence(retailerNames(cat.meta.retailers))}
        comparable={items.filter((x) => x.band !== 'solo').length}
      />
    </>
  );
}
