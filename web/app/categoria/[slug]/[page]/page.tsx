/* CATEGORY LANDING, PAGES 2..N — 86 of them, statically generated.

   THIS ROUTE IS WHAT MAKES THE PAGINATION REAL. §T2 asks for numbered pages with a
   real `<a href>` each, and the reason is not aesthetics: the 2.178-URL indexable
   architecture depends on every product being reachable from a category page with
   JavaScript disabled, and 24 cards on one page would leave 502 of a 526-product
   category unreachable. It is also what made `VirtualRows.tsx` (65 lines of
   windowing) deletable — a requirement elsewhere made it redundant.

   Page 1 lives at `/categoria/[slug]` and has NO `/1` twin: a second address for a
   canonical page is duplicate content for free. Every page here self-canonicalises,
   so a crawler that reaches page 7 indexes page 7 rather than being redirected back
   to a page that does not contain what it found. */

import type { Metadata } from 'next';

import { CategoryScreen, pageCount } from '@/components/CategoryScreen';
import { JsonLd } from '@/components/JsonLd';
import { PAGE_SIZE } from '@/components/Pagination';
import {
  brandCategoryPath,
  breadcrumbJsonLd, categoryJsonLd, categoryPath, categoryTitle, chainSentence,
} from '@/lib/seo';
import { buildBrands } from '@/lib/brands.server';
import { serverCatalog } from '@/lib/server-catalog';
import { retailerNames } from '@/lib/types';

export const dynamicParams = false;

/** Every page of every category, known at build time. Anything else is a 404 rather
 *  than a render — `/categoria/laptops/99` is not a page, and serving an empty grid
 *  there would be an indexable empty page. */
export function generateStaticParams() {
  const cat = serverCatalog();
  const out: { slug: string; page: string }[] = [];
  for (const c of cat.cats) {
    const n = pageCount((cat.byCategory.get(c.id) ?? []).length);
    // from 2: page 1 is the canonical `/categoria/[slug]`
    for (let i = 2; i <= n; i += 1) out.push({ slug: c.id, page: String(i) });
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}): Promise<Metadata> {
  const { slug, page } = await params;
  const cat = serverCatalog();
  const profile = cat.catMap.get(slug);
  const items = cat.byCategory.get(slug) ?? [];
  if (!profile) return {};

  const n = Number(page);
  const names = retailerNames(cat.meta.retailers);
  const from = (n - 1) * PAGE_SIZE + 1;
  const to = Math.min(n * PAGE_SIZE, items.length);

  return {
    /* The page number is IN the title, and the description names the window. Two
       paginated pages with identical titles are two pages Google has to choose
       between, and it will choose one. */
    /* THE PAGE NUMBER REPLACES THE MODEL COUNT rather than trailing it. Appended,
       `Congeladores y frigobares en Costa Rica — 45 modelos — página 2` runs to
       87 characters and Google shows neither the count nor the page. The count
       belongs to page 1; what page 2 needs to say is that it is page 2. */
    title: { absolute: `${profile.label} en Costa Rica — página ${n}` },
    description:
      `Modelos ${from} a ${to} de ${items.length} de ${profile.label.toLowerCase()} en Costa Rica, ` +
      `con el precio más bajo de cada uno. Precios de contado con IVA.`,
    alternates: { canonical: `${categoryPath(slug)}/${n}` },
    robots: { index: true, follow: true },
  };
}

export default async function CategoriaPaginaPage({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}) {
  const { slug, page } = await params;
  const cat = serverCatalog();
  const profile = cat.catMap.get(slug)!;
  const items = cat.byCategory.get(slug) ?? [];
  const n = Number(page);

  return (
    <>
      <JsonLd
        data={[
          // the products THIS page links, not the whole category
          categoryJsonLd(profile, items.slice((n - 1) * PAGE_SIZE, n * PAGE_SIZE)),
          breadcrumbJsonLd([
            { name: 'Inicio', path: '/' },
            { name: profile.label, path: categoryPath(slug) },
            { name: `Página ${n}`, path: `${categoryPath(slug)}/${n}` },
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
        page={n}
        chains={chainSentence(retailerNames(cat.meta.retailers))}
        comparable={items.filter((x) => x.band !== 'solo').length}
      />
    </>
  );
}
