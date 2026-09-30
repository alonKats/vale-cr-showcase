/* COMERCIOS — the merchant programme page.

   Self-hosting retailer product photography is the category norm (the
   established comparison sites do it); what sits underneath it there is a
   commercial arrangement, usually a merchant data feed. A feed supplied by the
   retailer is the cleanest licence for the product data and images shown, so
   this page invites one.

   NO FORM. A form stores personal data and creates a data-protection
   obligation; a `mailto:` with a prefilled template collects the same
   information, stores nothing on our side, and needs no endpoint, no spam
   pipeline and nothing to secure.

   EVERY NUMBER IS COMPOSED FROM THE ARTIFACT via buildStats(). A merchant
   pitch is exactly where an out-of-date claim is most expensive. */

import type { Metadata } from 'next';
import Link from 'next/link';

import { Doc, DocSec, docStyles as d } from '@/components/Doc';
import { JsonLd } from '@/components/JsonLd';
import { mil } from '@/lib/format';
import { breadcrumbJsonLd, SITE_NAME } from '@/lib/seo';
import { buildStats } from '@/lib/stats.server';

const TITLE = 'Para comercios';
const LEDE =
  'Si su cadena aparece en vale.cr, usted puede decidir con qué datos aparece. ' +
  'Leemos catálogos públicos todos los días; una conexión directa es más exacta ' +
  'para usted y para quien compara.';

export const metadata: Metadata = {
  title: TITLE,
  description: LEDE,
  alternates: { canonical: '/comercios' },
  openGraph: {
    type: 'article', url: '/comercios', title: TITLE, description: LEDE,
    locale: 'es_CR', siteName: SITE_NAME,
  },
};

const SECTIONS = [
  { id: 'que-es', label: 'Qué es vale.cr' },
  { id: 'como-conectarse', label: 'Cómo conectarse' },
  { id: 'que-necesitamos', label: 'Qué necesitamos' },
  { id: 'reglas', label: 'Nuestras reglas' },
  { id: 'empezar', label: 'Empezar' },
];

/** The prefilled intake. This IS the form — the fields a submission needs, in a
 *  body the merchant can edit before sending. No endpoint, no storage. */
const INTAKE = [
  'Nombre del comercio:',
  'Sitio web:',
  'Persona de contacto y cargo:',
  'Correo y teléfono:',
  'Categorías que le interesan:',
  '',
  '¿Cómo prefiere conectarse?',
  '  ( ) Ya leemos su catálogo público — solo quiero revisar/corregir datos',
  '  ( ) Quiero enviar un feed de catálogo (formato y frecuencia a coordinar)',
  '  ( ) Todavía no sé, quiero conversarlo',
  '',
  '¿Algo que debamos corregir hoy?',
].join('\n');

const MAILTO =
  'mailto:comercios@vale.cr'
  + '?subject=' + encodeURIComponent('Comercios — solicitud de conexión')
  + '&body=' + encodeURIComponent(INTAKE);

export default function Comercios() {
  const s = buildStats();

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'Inicio', path: '/' },
            { name: TITLE, path: '/comercios' },
          ]),
        ]}
      />
      <Doc title={TITLE} lede={LEDE} sections={SECTIONS} stamp={false}>
        <DocSec id="que-es" title="Qué es vale.cr">
          <p>
            vale.cr compara el precio de contado del <b>mismo número de modelo</b> entre
            cadenas de Costa Rica. Hoy publicamos <b>{mil(s.total)} modelos</b> en{' '}
            <b>{s.cats.length} categorías</b>, leídos en {s.retailers.length} cadenas:{' '}
            {s.retailers.join(', ')}.
          </p>
          <p>
            De esos, <b>{mil(s.comparable)}</b> aparecen en más de una
            cadena, que son los únicos que se pueden comparar por número de modelo. {s.freshShort}.
          </p>
          <p>
            No vendemos productos, no cobramos comisión y no tenemos carrito. Cuando
            alguien decide comprar, sale de aquí hacia el sitio de la cadena.
          </p>
        </DocSec>

        <DocSec id="como-conectarse" title="Cómo conectarse">
          <p>
            Su catálogo público ya se lee. Conectarse no cambia si aparece —
            cambia <b>con qué exactitud</b> aparece, y le da un canal para corregir.
          </p>
          <dl className={d.dl}>
            <dt>Revisión y corrección</dt>
            <dd>
              Le mandamos lo que estamos leyendo de su catálogo y usted nos dice qué está
              mal: modelos mal identificados, productos descontinuados, precios que no
              corresponden. Sin ningún trabajo técnico de su parte.
            </dd>

            <dt>Feed de catálogo</dt>
            <dd>
              Usted nos entrega el catálogo en el formato que ya tenga —CSV, XML, JSON o
              un endpoint— con SKU, número de modelo, precio, existencia y foto. Es más
              exacto que leer una página, se actualiza a la frecuencia que usted defina, y
              es la forma en que su fotografía de producto se publica{' '}
              <b>con su permiso explícito</b> en vez de leída del sitio.
            </dd>

            <dt>Conversar primero</dt>
            <dd>
              Si no está seguro de qué le conviene, escríbanos y lo vemos. No hay contrato
              para tener la conversación.
            </dd>
          </dl>
        </DocSec>

        <DocSec id="que-necesitamos" title="Qué necesitamos de su lado">
          <p>Lo mínimo para que una comparación sea honesta:</p>
          <ul>
            <li><b>Número de modelo del fabricante.</b> Es la única llave que permite comparar dos productos y decir que son el mismo.</li>
            <li><b>Precio de contado con IVA incluido</b>, el mismo que ve un cliente en su sitio.</li>
            <li><b>Existencia</b> a nivel de cadena. No pedimos inventario por sucursal.</li>
            <li><b>Fotografía del producto</b>, si quiere que aparezca la suya.</li>
          </ul>
          <p>
            No pedimos exclusividad, no pedimos datos de sus clientes y no pedimos
            márgenes ni costos.
          </p>
        </DocSec>

        <DocSec id="reglas" title="Nuestras reglas, y no cambian por pagar">
          <p>
            Esto es lo que nos diferencia y conviene decirlo antes de que lo pregunte:
          </p>
          <ul>
            <li>
              <b>El orden no se compra.</b> El producto más barato aparece primero porque
              es el más barato. No vendemos posición, ni destacados, ni «recomendado».
              Nuestra{' '}
              <Link href="/metodologia">metodología</Link> es pública y cualquiera puede
              verificarla.
            </li>
            <li>
              <b>No ocultamos que otra cadena está más barata.</b> Si su precio no es el
              mejor, se ve. Un comparador que esconde eso no le sirve a nadie y deja de
              ser un comparador.
            </li>
            <li>
              <b>Publicamos cuándo leímos cada precio.</b> Cada oferta lleva su hora real
              de lectura, no la hora en que se armó la página.
            </li>
            <li>
              <b>Nunca inventamos un dato.</b> Si no lo tenemos, decimos que no lo
              tenemos.
            </li>
          </ul>
        </DocSec>

        <DocSec id="empezar" title="Empezar">
          <p>
            Escriba a <a href="mailto:comercios@vale.cr">comercios@vale.cr</a>. Le contesta
            directamente la persona que hace vale.cr, no un equipo de soporte.
          </p>
          <p>
            {/* A PROSE LINK, NOT A BUTTON, and that is the template's rule rather
                than a compromise. `Doc` is deliberately CTA-free ("no section that
                exists to introduce the next section"), and a button dropped into its
                prose CANNOT keep its colour: `.btn` and `.btnSolid` are separate
                rules at (0,1,0) each, while `.prose a` is (0,1,1) and wins. The
                result measured rgb(11,87,200) on rgb(0,40,50) = 2.38:1 — the exact
                ratio the pairs file cites as the reason --act-on-dark exists.
                Overriding it would mean adding a declaration to beat the template;
                the template is right and the button was imported from a surface
                where it belongs. */}
            <a href={MAILTO}>Escribir con la plantilla ya lista</a>
          </p>
          <p className={d.cap}>
            Ese enlace abre su cliente de correo con las preguntas ya escritas; usted las
            edita antes de enviar. <b>No hay formulario en esta página a propósito:</b> un
            formulario guardaría sus datos en nuestros servidores y eso crea obligaciones
            bajo la Ley 8968 que hoy no necesitamos asumir. Su correo llega a una bandeja,
            no a una base de datos.
          </p>
        </DocSec>
      </Doc>
    </>
  );
}
