/* THE BRAND HUB — `Samsung en Costa Rica`.

   Its job is threefold and only one of them is the head term:
     · it answers "samsung costa rica precios", which is a real query;
     · it is the PARENT the brand×category pages need for a breadcrumb that does
       not lie — a trail of `Inicio › Marcas › Samsung › Celulares` requires every
       segment to resolve, and a BreadcrumbList item that 404s is a structured-data
       error aimed at Google;
     · it is the internal link hub that makes the 57 pair pages discoverable
       without JavaScript.

   It lists PAIRS, not products. A hub that also listed products would compete
   with the pages it exists to send people to. */

import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumb } from '@/components/Breadcrumb';
import { JsonLd } from '@/components/JsonLd';
import pg from '@/components/Page.module.css';
import { buildBrands, findBrand } from '@/lib/brands.server';
import { mil } from '@/lib/format';
import { serverCatalog } from '@/lib/server-catalog';
import {
  brandCategoryPath, brandDescription, brandPath, brandTitle, breadcrumbJsonLd,
} from '@/lib/seo';

export const dynamicParams = false;

export function generateStaticParams() {
  return buildBrands(serverCatalog()).map((b) => ({ brand: b.slug }));
}

type Params = { params: Promise<{ brand: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { brand } = await params;
  const b = findBrand(serverCatalog(), brand);
  if (!b) return {};
  return {
    title: { absolute: brandTitle(b.label, b.total) },
    description: brandDescription(b.label, b.total, b.pairs.map((p) => p.label)),
    alternates: { canonical: brandPath(b.slug) },
    openGraph: { url: brandPath(b.slug) },
  };
}

export default async function BrandHub({ params }: Params) {
  const { brand } = await params;
  const b = findBrand(serverCatalog(), brand)!;
  /* the count under the heading is the SUM OF WHAT THIS PAGE LINKS TO, not
     `b.total` — a hub that says "312 productos" over links reaching 229 is
     counting products it is not offering a way to. */
  const reachable = b.pairs.reduce((n, p) => n + p.count, 0);

  return (
    <>
      <JsonLd
        data={[breadcrumbJsonLd([
          { name: 'Inicio', path: '/' },
          { name: 'Marcas', path: '/marcas' },
          { name: b.label, path: brandPath(b.slug) },
        ])]}
      />
      <div className={pg.shell}>
        <Breadcrumb
          trail={[
            { name: 'Inicio', path: '/' },
            { name: 'Marcas', path: '/marcas' },
            { name: b.label },
          ]}
        />
      </div>

      <div className={pg.band}>
        <div className={`${pg.shell} ${pg.head}`}>
          <h1 className={pg.h1}>{b.label} en Costa Rica</h1>
          <p className={pg.lede}>
            Comparamos {mil(reachable)} productos {b.label} por número de modelo exacto,
            con IVA incluido, en las principales cadenas del país.
          </p>
        </div>
      </div>

      <div className={`${pg.shell} ${pg.pageEnd}`}>
        <section className={pg.sec} aria-labelledby="pairs">
          <div className={pg.secHead}>
            <h2 className={pg.secH} id="pairs">Categorías con productos {b.label}</h2>
          </div>
          <ul className={pg.linkGrid}>
            {b.pairs.map((p) => (
              <li key={p.id}>
                <Link href={brandCategoryPath(b.slug, p.id)}>
                  <span>{p.label}</span>
                  <span className={pg.linkGridN}>{mil(p.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
