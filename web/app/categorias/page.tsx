/* /categorias — the hub the category breadcrumb finally has a middle tier for.
   ==========================================================================

   WHY THIS PAGE EXISTS, AND WHY IT IS NOT JUST A BREADCRUMB PROP.

   The three-level breadcrumb comes from the design comp:
   `Inicio › Electrodomésticos › Refrigeradoras`. That comp's middle tier was
   INVENTED — I wrote it into the prompt, and `Category` in this codebase has no
   parent, no group and no taxonomy above it. Worse, "Electrodomésticos" is
   simply false for four of the fourteen categories: laptops, celulares, tablets
   and smartwatches are not appliances.

   A BREADCRUMB SEGMENT THAT LINKS NOWHERE IS NOT A BREADCRUMB, IT IS A LABEL
   PRETENDING TO BE ONE — and `BreadcrumbList` schema with an item that 404s is a
   structured-data error pointed at Google. So rather than fake a tier, this adds
   a real one: a page that genuinely sits above every category, is genuinely
   reachable, and is worth landing on by itself.

   ---- WHAT IT IS WORTH BEYOND THE CRUMB ------------------------------------
   Fourteen categories currently have exactly one internal-link source between
   them: a disclosure inside the sticky chrome (`TopBar`'s "Todas las
   categorías") and the homepage's `SiteMapBlock`. Both are site furniture. This
   is one canonical, crawlable page that links to all fourteen with their counts
   — the shape of page that head terms like "comparador de precios Costa Rica"
   actually land on, and the natural target for the monthly price index in
   the growth-loop plan.

   ---- EVERY NUMBER IS DERIVED (§0.1) --------------------------------------
   `buildStats()` — the same call the homepage, the chrome and the rails use. No
   category is named here and no count is typed; add a category to the engine and
   it appears the same day with a true count beside it. */

import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumb } from '@/components/Breadcrumb';
import pg from '@/components/Page.module.css';
import s from './categorias.module.css';
import { mil } from '@/lib/format';
import { categoryPath, SITE_NAME, SITE_URL } from '@/lib/seo';
import { buildStats } from '@/lib/stats.server';

export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  const stats = buildStats();
  const title = `Categorías — ${mil(stats.total)} productos comparados en Costa Rica`;
  const description =
    `Las ${stats.cats.length} categorías que ${SITE_NAME} compara: `
    + `${stats.cats.map((c) => c.label.toLowerCase()).join(', ')}. `
    + `${mil(stats.total)} productos leídos a diario en ${stats.retailers.length} cadenas, `
    + `${mil(stats.comparable)} de ellos vendidos por más de una.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/categorias` },
    openGraph: { title, description, url: `${SITE_URL}/categorias`, type: 'website' },
  };
}

export default function Categorias() {
  const stats = buildStats();

  return (
    <div className={pg.shell}>
      <Breadcrumb trail={[{ name: 'Inicio', path: '/' }, { name: 'Categorías' }]} />

      <div className={pg.head}>
        <h1 className={pg.h1}>Todas las categorías</h1>
        <p className={pg.lede}>
          Precios de contado con IVA incluido, leídos a diario en las tiendas más grandes de Costa
          Rica. Comparamos por número de modelo.
        </p>
      </div>

      {/* A REAL `<a href>` PER CATEGORY, with no JavaScript — this page's only job
          is to be the one crawlable place every category is reachable from. */}
      <ul className={s.grid}>
        {stats.cats.map((c) => (
          <li key={c.id} className={s.cell}>
            {/* No count under the label. A grid of tiles each shouting a
                number is an inventory report; a shopper picking a category
                needs the category, and the count told them nothing they could
                act on. */}
            <Link href={categoryPath(c.id)} className={s.tile}>
              <span className={s.label}>{c.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
