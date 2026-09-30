/* TÉRMINOS DE USO — the Ley 7472 disclaimers, plus scope and jurisdiction. The longest of the six pages, and the only
   one where the index rail's long-list state (max-height + internal scroll) is
   real.

   The chain list is COMPOSED from the artifact (`meta.retailers`), never typed —
   the day a ninth chain is added, this page names it without an edit. That is the
   project's oldest honesty rule applied to a legal page, where it matters most:
   a non-affiliation disclaimer that omits a chain we actually read is worse than
   no disclaimer. */

import type { Metadata } from 'next';
import Link from 'next/link';

import { Doc, DocFix, DocSec } from '@/components/Doc';
import { JsonLd } from '@/components/JsonLd';
import { IVA_PCT } from '@/lib/display';
import { breadcrumbJsonLd, chainSentence, SITE_NAME } from '@/lib/seo';
import { serverCatalog } from '@/lib/server-catalog';
import { retailerNames } from '@/lib/types';

const TITLE = 'Términos de Uso';
const LEDE =
  'Qué es vale.cr, qué puede esperar del sitio y qué no. Están escritos para leerse, no solo para archivarse.';

export const metadata: Metadata = {
  title: TITLE,
  description: LEDE,
  alternates: { canonical: '/terminos' },
  openGraph: {
    type: 'article', url: '/terminos', title: TITLE, description: LEDE,
    locale: 'es_CR', siteName: SITE_NAME,
  },
};

const SECTIONS = [
  { id: 'que-es', label: 'Qué es vale.cr' },
  { id: 'precios-cambian', label: 'Los precios cambian' },
  { id: 'contado', label: 'De contado, con IVA' },
  { id: 'no-vendemos', label: 'No vendemos nada' },
  { id: 'sin-relacion', label: 'Sin relación con las cadenas' },
  { id: 'marcas', label: 'Marcas e imágenes' },
  { id: 'eeuu', label: 'Referencias de EE. UU.' },
  { id: 'errores', label: 'Si encuentra un error' },
  { id: 'metodologia', label: 'Cómo funciona la comparación' },
];

export default function Terminos() {
  const chains = chainSentence(retailerNames(serverCatalog().meta.retailers));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'Inicio', path: '/' },
            { name: TITLE, path: '/terminos' },
          ]),
        ]}
      />
      <Doc title={TITLE} lede={LEDE} sections={SECTIONS}>
        <DocSec id="que-es" title="Qué es vale.cr">
          <p>
            vale.cr lee precios publicados por cadenas en Costa Rica y los junta por número de
            modelo, para que usted vea en un solo lugar dónde cuesta menos un producto. Hoy cubrimos{' '}
            {chains}.
          </p>
        </DocSec>

        <DocSec id="precios-cambian" title="Los precios cambian, y los nuestros tienen fecha">
          <p>
            Cada precio que mostramos tiene un momento exacto en que lo leímos. Un producto puede
            tener varias tiendas con precios leídos en momentos distintos — en ese caso, mostramos
            la fecha del más antiguo, no del más reciente, para no dar una sensación de actualidad
            que no tenemos para todo el conjunto.
          </p>
          <p>
            Las cadenas cambian sus precios sin avisarnos. El precio que usted vea en vale.cr es el
            que leímos en ese momento, no necesariamente el que está en la tienda ahora mismo.
            Confirme el precio final en el sitio de la cadena antes de comprar.
          </p>
        </DocSec>

        <DocSec id="contado" title="Los precios son de contado, con IVA incluido">
          <p>
            Todos los precios que publicamos son <b>de contado</b> e <b>incluyen el {IVA_PCT}% de
            IVA</b>. No mostramos el total en cuotas ni con financiamiento — ese número es distinto y
            depende de las condiciones de crédito de cada cadena, que no controlamos ni verificamos.
          </p>
        </DocSec>

        <DocSec id="no-vendemos" title="vale.cr no vende nada">
          <p>
            No somos una tienda. No procesamos compras, no cobramos, no garantizamos que un producto
            esté en existencia, y no tenemos ningún rol en la entrega ni en la garantía del producto.
            Cuando usted hace clic para ir a una tienda, la compra ocurre en esa tienda, bajo los
            términos de esa tienda.
          </p>
        </DocSec>

        <DocSec id="sin-relacion" title="No tenemos relación con las cadenas que comparamos">
          <p>
            vale.cr no está afiliado, patrocinado ni pagado por {chains}, ni por ninguna otra cadena.
            Leemos sus precios públicos igual que lo haría cualquier persona comprando en línea. No
            recibimos comisión por ninguna venta.
          </p>
        </DocSec>

        <DocSec id="marcas" title="Marcas e imágenes">
          <p>
            Las marcas, nombres de producto e imágenes que aparecen en vale.cr pertenecen a sus
            respectivos dueños — fabricantes y cadenas. Las usamos únicamente para identificar el
            producto que estamos comparando, no como respaldo ni asociación con esas marcas.
          </p>
        </DocSec>

        <DocSec id="eeuu" title="Las referencias a Estados Unidos son solo eso: una referencia">
          <p>
            Cuando mostramos una reseña o una calificación de un producto en Estados Unidos, es de un{' '}
            <b>modelo similar</b>, no de la unidad exacta que se vende en Costa Rica. Lo marcamos así
            cada vez que aparece. No es la calificación de este producto en Costa Rica, porque ese
            dato simplemente no existe.
          </p>
        </DocSec>

        <DocSec id="errores" title="Si encuentra un error">
          <p>
            Los precios en vale.cr salen de un proceso automático de lectura, y ese proceso puede
            fallar: una tienda cambia su página, un precio se lee mal, un modelo se empareja con el
            equivocado. Si ve algo que no cuadra, avísenos en{' '}
            <Link href="/contacto">contacto</Link>. Revisamos cada reporte y corregimos lo que
            encontramos mal.
          </p>
        </DocSec>

        <DocSec id="metodologia" title="Cómo funciona la comparación — el detalle completo">
          <p>
            Este documento cubre lo legal. Si quiere entender de verdad cómo leemos los precios, cómo
            emparejamos modelos entre cadenas y qué significa «verificado» en este sitio, esa
            explicación completa está en <Link href="/metodologia">Cómo comparamos</Link>.
          </p>
        </DocSec>

        <DocFix />
      </Doc>
    </>
  );
}
