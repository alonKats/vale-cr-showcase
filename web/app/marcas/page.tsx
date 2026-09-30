/* THE BRAND INDEX. Small, and it exists for the same reason `/categorias` does:
   the brand hubs need a parent that resolves so their breadcrumb trail is true,
   and the 36 hubs need one crawlable page that links to all of them. */

import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumb } from '@/components/Breadcrumb';
import pg from '@/components/Page.module.css';
import { buildBrands } from '@/lib/brands.server';
import { mil } from '@/lib/format';
import { serverCatalog } from '@/lib/server-catalog';
import { brandPath } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Marcas — precios comparados en Costa Rica',
  description:
    'Todas las marcas que comparamos en Costa Rica, con la cantidad de modelos de '
    + 'cada una. Precios de contado con IVA incluido, leídos a diario.',
  alternates: { canonical: '/marcas' },
};

export default function Marcas() {
  const brands = buildBrands(serverCatalog());
  return (
    <>
      <div className={pg.shell}>
        <Breadcrumb trail={[{ name: 'Inicio', path: '/' }, { name: 'Marcas' }]} />
      </div>
      <div className={pg.band}>
        <div className={`${pg.shell} ${pg.head}`}>
          <h1 className={pg.h1}>Marcas en Costa Rica</h1>
          <p className={pg.lede}>
            Las {brands.length} marcas con suficientes modelos para comparar por número
            de modelo exacto. Precios de contado con IVA incluido.
          </p>
        </div>
      </div>
      <div className={`${pg.shell} ${pg.pageEnd}`}>
        <section className={pg.sec}>
          <ul className={pg.linkGrid}>
            {brands.map((b) => (
              <li key={b.slug}>
                <Link href={brandPath(b.slug)}>
                  <span>{b.label}</span>
                  <span className={pg.linkGridN}>{mil(b.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
