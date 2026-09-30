/* ==========================================================================
   CÓMO COMPARAMOS — the one trust route that is a PRODUCT page.

   THE ONE BOLD MOVE: the claims table comes FIRST, before any prose, at the full
   880 column. That single inversion of the shared template is what makes this page
   read as a product page instead of fine print, and it costs nothing but ordering.

   NO STAT ROW. "Make it look important" has exactly one generic answer (a hero
   with three big numbers under it), and that is the generic look in this
   market; copying it would make the differentiator page look like the sites it
   differentiates from. So the numbers go in the right-hand column of a table
   whose left-hand column is a claim we make on the site.

   EVERY FIGURE IN THE THIRD COLUMN IS READ FROM buildStats() AT BUILD TIME. NOT
   ONE DIGIT IS TYPED INTO THIS FILE. That is the project's oldest honesty rule
   ("every count composed from the artifact"), and it is what stops this page
   becoming stale marketing copy the day the catalogue changes. It is grep-asserted:

     grep -nE ">[^<]*[0-9]{2,}[^<]*<" app/metodologia/page.tsx   # must return nothing

   ONE PARAGRAPH IS NOT RENDERED: the per-adapter description of how each
   chain's catalogue is read. The price mechanism is described at the level of
   public catalogues read daily, which is accurate and sufficient. Everything
   else ships: the claims table, the matching, the frequency, "qué significa
   verificado" and "qué no hacemos".
   ========================================================================== */

import type { Metadata } from 'next';
import Link from 'next/link';

import { Doc, DocFix, DocSec, DocTable } from '@/components/Doc';
import { JsonLd } from '@/components/JsonLd';
import pg from '@/components/Page.module.css';
import { TrustBand } from '@/components/TrustBand';
import { EEUU } from '@/components/ui';
import { IVA_PCT } from '@/lib/display';
import { dec, mil } from '@/lib/format';
import { MIN_CURVE_DAYS } from '@/lib/history';
import { breadcrumbJsonLd, chainSentence, SITE_NAME } from '@/lib/seo';
import { serverCatalog } from '@/lib/server-catalog';
import { buildStats } from '@/lib/stats.server';
import { retailerNames } from '@/lib/types';

const TITLE = 'Cómo comparamos';
const LEDE =
  'Cada afirmación que hace este sitio, el mecanismo que la produce y el dato que la respalda hoy.';

export const metadata: Metadata = {
  title: TITLE,
  description:
    'Cómo lee vale.cr los precios de las cadenas, cómo empareja modelos por número exacto, cada cuánto actualiza y qué significa «verificado» — con el dato de hoy junto a cada afirmación.',
  alternates: { canonical: '/metodologia' },
  openGraph: {
    type: 'article', url: '/metodologia', title: TITLE, description: LEDE,
    locale: 'es_CR', siteName: SITE_NAME,
  },
};

const SECTIONS = [
  { id: 'que-leemos', label: 'Qué leemos' },
  { id: 'emparejar', label: 'Cómo emparejamos modelos' },
  { id: 'frecuencia', label: 'Cada cuánto actualizamos' },
  { id: 'verificado', label: 'Qué significa «verificado»' },
  { id: 'comparables', label: 'Por qué muchos no se comparan' },
  { id: 'eeuu', label: 'Las reseñas de EE. UU.' },
  { id: 'no-hacemos', label: 'Qué no hacemos' },
  { id: 'no-sabemos', label: 'Lo que no sabemos' },
  { id: 'errores', label: 'Si algo no cuadra' },
];

export default function Metodologia() {
  const stats = buildStats();
  const chains = chainSentence(retailerNames(serverCatalog().meta.retailers));
  const comparablePct = dec((stats.comparable / stats.total) * 100, 1);

  /* THE CLAIMS TABLE. Row 6 is the page's best asset and nobody in this market
     publishes anything like it: "we re-read every featured price at export time and
     dropped N because it had moved" is a FALSIFIABLE operational claim, already
     computed by the engine and — until now — rendered nowhere.

     Row 8 is the empty state doing real work. The honest cell is "N días —
     todavía no se publica", never a dash, never a zero, never a hidden row. A
     methodology page that lists a capability it is not yet exercising, and says so,
     is worth more than one that lists only what it can do today. */
  const claims: React.ReactNode[][] = [
    [
      '«Precio verificado el …»',
      'Cada oferta guarda su propia hora de lectura. El sello es la fecha de esa lectura, nunca la de la página.',
      stats.freshShort,
    ],
    [
      '«Brecha N %»',
      'El precio más alto menos el más bajo, dividido entre el más bajo: entre cadenas, mismo modelo, mismo día.',
      <>{mil(stats.gap)} productos con brecha</>,
    ],
    [
      '«Más barato en una cadena»',
      'Sólo cuando la brecha supera el umbral de empate. Por debajo, el producto queda marcado como parejo y nada se marca como más barato.',
      <>{mil(stats.parejo)} marcados empate</>,
    ],
    [
      '«N de M comparables»',
      'Un producto es comparable cuando dos o más cadenas publican el mismo número de modelo.',
      <>
        {mil(stats.comparable)} de {mil(stats.total)}
      </>,
    ],
    [
      <>
        «Modelo similar en <EEUU key="us" />»
      </>,
      'Referencia externa. Nunca se presenta como calificación de este sitio.',
      '—',
    ],
    [
      '«Destacados»',
      'El motor vuelve a leer el precio de cada candidato en el momento de exportar y descarta los que se movieron.',
      <>
        {mil(stats.featuredChecked)} leídos, {mil(stats.featuredDropped)} descartados
      </>,
    ],
    [
      'Precios',
      'De contado, con IVA incluido. Las cuotas son otro número y no se muestran.',
      '—',
    ],
    [
      'Historial',
      <>
        La curva de precios se publica a partir de {MIN_CURVE_DAYS} días de lecturas.
      </>,
      <>
        {mil(stats.historyDays)} días — todavía no se publica
      </>,
    ],
  ];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'Inicio', path: '/' },
            { name: TITLE, path: '/metodologia' },
          ]),
        ]}
      />
      <Doc
        title={TITLE}
        lede={LEDE}
        sections={SECTIONS}
        lead={
          <DocTable
            caption="Cada afirmación, su mecanismo y el dato de hoy"
            head={['La afirmación', 'Cómo se produce', 'Dato de hoy']}
            rows={claims}
            figureCol={2}
          />
        }
      >
        <DocSec id="que-leemos" title="Qué leemos">
          <p>
            Leemos los precios que publican estas cadenas en sus propios sitios: {chains}. No
            llamamos a las tiendas, no negociamos nada con ellas y no vemos ningún precio que usted
            mismo no pudiera ver entrando a su página.
          </p>
          <p>
            Todos los precios que mostramos son <b>de contado</b> y ya <b>incluyen el {IVA_PCT}% de
            IVA</b>. Si una cadena solo publica el precio en cuotas, no lo mostramos como si fuera
            el precio de contado — en ese caso, el producto simplemente no aparece con precio hasta
            que encontremos la cifra correcta.
          </p>
        </DocSec>

        <DocSec id="emparejar" title="Cómo decidimos que dos productos son el mismo">
          <p>Esta es la parte donde más fácil es equivocarse, así que somos estrictos.</p>
          <p>
            Dos ofertas de tiendas distintas se juntan como «el mismo producto» solo cuando coinciden
            en <b>marca y número de modelo exacto</b> — no por nombre parecido, no por descripción
            similar, no por categoría y precio parecidos. El mismo número de modelo en dos cadenas es
            el mismo producto. Un refrigerador «parecido» de otra referencia no lo es, aunque se vea
            igual en la foto.
          </p>
          <p>
            Cuando el número de modelo no es claro en lo que publica la tienda, preferimos no
            emparejar antes que adivinar. Un producto sin comparación es honesto. Un producto
            emparejado mal es un error que le puede costar dinero a usted.
          </p>
        </DocSec>

        <DocSec id="frecuencia" title="Qué tan seguido actualizamos">
          <p>
            Cada precio individual tiene su propia fecha de lectura, visible en la ficha del
            producto. Cuando un precio pasa de cierta antigüedad, el sistema vuelve a leerlo — no
            esperamos a que alguien nos avise de que cambió.
          </p>
          <p>
            Cuando un producto aparece en más de una cadena, la fecha que le mostramos como
            «verificado» es la del precio <b>más viejo</b> de los que lo componen, no la del más
            reciente. Si leímos una cadena hace una hora y otra hace un día, decimos que el dato
            tiene un día de antigüedad. Preferimos quedarnos cortos en la fecha antes que sonar más
            actualizados de lo que en realidad estamos.
          </p>
          <p>
            Los productos que destacamos en la portada los volvemos a leer justo antes de
            publicarlos, no solo cuando se agregaron al catálogo. Si el precio cambió entre que lo
            elegimos y que lo publicamos, lo quitamos de la lista en lugar de mostrar un dato viejo.
          </p>
        </DocSec>

        <DocSec id="verificado" title="Qué significa «verificado» aquí">
          <p>
            «Verificado» en vale.cr quiere decir: leímos este precio directamente del sitio de la
            cadena, en la fecha que le mostramos, y lo volvemos a leer con regularidad. No quiere
            decir que llamamos a la tienda para confirmar existencia, ni que revisamos el precio en
            la tienda física, ni que el precio siga vigente en este momento exacto en que usted lo
            está viendo.
          </p>
        </DocSec>

        <DocSec id="comparables" title="Por qué la mayoría de productos no tiene con qué comparar">
          <p>
            De los {mil(stats.total)} productos que tenemos hoy,{' '}
            <b>
              {mil(stats.comparable)} ({comparablePct}%) están publicados por más de una cadena
            </b>{' '}
            — esos son los únicos donde realmente hay algo que comparar. Los otros{' '}
            <b>{mil(stats.solo)} solo los publica una cadena</b>. En esos casos se lo decimos así,
            sin inventar una comparación que no existe. Le mostramos la ficha técnica y, si hay,
            productos parecidos de la misma categoría, pero no un precio contra el que medirlo.
          </p>
          <p>
            Esto no es una limitación que escondemos: es simplemente lo que las cadenas publican hoy.
            Si una cadena empieza a publicar un modelo que antes no tenía, el producto pasa a la
            categoría de «sí se puede comparar» la próxima vez que actualizamos.
          </p>
        </DocSec>

        <DocSec id="eeuu" title="Las reseñas de Estados Unidos">
          <p>
            Cuando un producto no tiene reseñas en Costa Rica, a veces mostramos reseñas de un modelo
            similar vendido en Estados Unidos, siempre marcado como tal. No es la calificación de
            esta unidad ni de este mercado — es una referencia, nada más. Nunca la mezclamos ni la
            promediamos con datos de Costa Rica.
          </p>
        </DocSec>

        {/* THE PAGE'S SECOND-MOST-VALUABLE BLOCK, and it belongs in prose rather than
            in a badge. It states OUR position positively and does not name or
            characterise a competitor: the differentiator is that ours is PUBLISHED,
            and that reads stronger unaccompanied. */}
        <DocSec id="no-hacemos" title="Qué no hacemos">
          <ul>
            <li>No vendemos productos ni cobramos comisión.</li>
            <li>
              Ninguna de las cadenas nos paga, nos patrocina ni tiene ningún tipo de acuerdo con
              vale.cr.
            </li>
            <li>vale.cr no está afiliado ni es un proyecto de ninguna cadena.</li>
            <li>No hay posiciones pagadas ni resultados patrocinados.</li>
          </ul>
        </DocSec>

        <DocSec id="no-sabemos" title="Lo que no sabemos">
          <p>Para ser igual de claros sobre los límites:</p>
          <ul>
            <li>No sabemos si hay existencias en una sucursal específica.</li>
            <li>No sabemos el precio en cuotas o financiado, solo el de contado.</li>
            <li>
              No sabemos si hay una promoción temporal que la tienda no publicó en la misma página
              que leímos.
            </li>
            <li>
              No verificamos que el envío o la garantía funcionen como la tienda promete — eso es
              entre usted y la tienda.
            </li>
            <li>
              No sabemos si el precio cambió en los minutos entre nuestra última lectura y el momento
              en que usted entra al sitio.
            </li>
          </ul>
        </DocSec>

        <DocSec id="errores" title="Si algo no cuadra">
          <p>
            Los precios salen de un proceso automático, y un proceso automático puede equivocarse:
            una tienda cambia el formato de su página, un modelo se lee mal, dos productos se
            emparejan cuando no debían. Si ve algo así, cuéntenos en{' '}
            <Link href="/contacto">contacto</Link> — cada reporte lo revisamos contra el sitio de la
            tienda directamente.
          </p>
        </DocSec>

        <DocFix />
      </Doc>

      {/* REUSED VERBATIM. It is the one component (rather than prose) this page
          reuses and it is the right one: the page's closing object is a LIVE
          MEASUREMENT of our own freshness, rendered as proportional bars gated
          against data-pct. */}
      <div className={pg.shell}>
        <TrustBand stats={stats} />
      </div>
    </>
  );
}
