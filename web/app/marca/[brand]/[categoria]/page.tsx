/* THE BRAND × CATEGORY PAGE — `Lavadoras y secadoras Samsung en Costa Rica`.

   THE HEAD TERM THIS SITE DID NOT HAVE. `/categoria/lavadoras` carries
   "lavadoras precios costa rica"; `/producto/samsung-wa20b3553gw-ap` carries a
   model number. Between them sits the query of a shopper who has settled on a
   BRAND but not a model — the most commercially-decided visitor the site can
   get — and nothing answered it. 57 of these pairs clear the floor and together
   they reach 74% of the catalogue.

   ---- IT REUSES `CategoryScreen` AND MUST KEEP DOING SO --------------------
   The whole crawlable link surface of this site is that component: every product
   as a real `<a href>`, the pager as real links, `dynamicParams = false`. A
   second copy of it here would drift from the original, and the thing that would
   drift is the SEO architecture itself. So this route is a thin wrapper that
   hands `CategoryScreen` a filtered item list and its own headings — the same
   call `/categoria/[slug]/[page]` makes.

   ---- WHY THERE IS NO PAGINATION ROUTE UNDER THIS ONE ---------------------
   Deliberate, and it is a `noindex`-free way of keeping the surface honest. The
   biggest pair is 229 products = 10 pages, and pages 2..10 of a brand slice are
   the definition of a thin, near-duplicate crawl path — they would triple the
   URL count for a listing nobody links to. Page 1 shows the first PAGE_SIZE and
   the pager is suppressed; the full set stays reachable through the category
   page, which IS paginated and IS linked from here. */

import type { Metadata } from 'next';

import { Breadcrumb } from '@/components/Breadcrumb';
import { CategoryScreen } from '@/components/CategoryScreen';
import { JsonLd } from '@/components/JsonLd';
import { buildBrands, brandCategoryItems, findBrand } from '@/lib/brands.server';
import { serverCatalog } from '@/lib/server-catalog';
import {
  brandCategoryDescription, brandCategoryPath, brandCategoryTitle, brandPath,
  breadcrumbJsonLd, categoryJsonLd, categoryPath,
} from '@/lib/seo';
import { retailerNames } from '@/lib/types';

export const dynamicParams = false;

export function generateStaticParams() {
  const cat = serverCatalog();
  return buildBrands(cat).flatMap((b) =>
    b.pairs.map((p) => ({ brand: b.slug, categoria: p.id })));
}

type Params = { params: Promise<{ brand: string; categoria: string }> };

function load(brandSlug: string, categoria: string) {
  const cat = serverCatalog();
  const brand = findBrand(cat, brandSlug);
  const profile = cat.catMap.get(categoria);
  if (!brand || !profile) return null;
  const items = brandCategoryItems(cat, brand.raw, categoria);
  return { cat, brand, profile, items };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { brand: b, categoria } = await params;
  const d = load(b, categoria);
  if (!d) return {};
  const chains = retailerNames(d.cat.meta.retailers);
  const path = brandCategoryPath(d.brand.slug, d.profile.id);
  return {
    title: { absolute: brandCategoryTitle(d.brand.label, d.profile, d.items.length, chains) },
    description: brandCategoryDescription(d.brand.label, d.profile, d.items, chains),
    alternates: { canonical: path },
    openGraph: { url: path },
  };
}

export default async function BrandCategory({ params }: Params) {
  const { brand: b, categoria } = await params;
  const d = load(b, categoria)!;
  const chains = retailerNames(d.cat.meta.retailers);

  return (
    <>
      <JsonLd
        data={[
          categoryJsonLd(d.profile, d.items),
          breadcrumbJsonLd([
            { name: 'Inicio', path: '/' },
            { name: d.brand.label, path: brandPath(d.brand.slug) },
            { name: d.profile.label, path: brandCategoryPath(d.brand.slug, d.profile.id) },
          ]),
        ]}
      />
      <CategoryScreen
        profile={d.profile}
        items={d.items}
        page={1}
        chains={chains.join(', ').replace(/, ([^,]*)$/, ' y $1')}
        /* the headings and the trail are the BRAND's, not the category's — the
           template is shared, the claims are not */
        heading={`${d.profile.label} ${d.brand.label} en Costa Rica`}
        trail={[
          { name: 'Inicio', path: '/' },
          { name: 'Marcas', path: '/marcas' },
          { name: d.brand.label, path: brandPath(d.brand.slug) },
          { name: d.profile.label },
        ]}
        /* pages 2..N of a brand slice are a thin crawl path — see the header */
        paginate={false}
        /* the one link out: the unfiltered category, which IS paginated */
        alsoSee={{ label: `Ver todas las ${d.profile.label.toLowerCase()}`, path: categoryPath(d.profile.id) }}
      />
    </>
  );
}
