/* CONTACTO — no form, deliberately. A form stores personal data and creates a
   data-protection obligation; a plain `mailto:` needs no endpoint, no storage,
   no spam pipeline and nothing to secure.

   THE ADDRESS IS NOT OBFUSCATED. JavaScript and HTML-entity tricks break screen
   readers and copy-paste for the sake of spam we do not have.

   The <dl> shape: the five reasons to write become the `Para qué` term. */

import type { Metadata } from 'next';
import Link from 'next/link';

import { Doc, DocFix, DocSec, docStyles as d } from '@/components/Doc';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, SITE_NAME } from '@/lib/seo';

const TITLE = 'Contacto — comparador de precios de Costa Rica';
const LEDE =
  'vale.cr lo hace una sola persona, así que le va a contestar directamente esa persona, no un equipo de soporte.';

export const metadata: Metadata = {
  title: TITLE,
  description: LEDE,
  alternates: { canonical: '/contacto' },
  openGraph: {
    type: 'article', url: '/contacto', title: TITLE, description: LEDE,
    locale: 'es_CR', siteName: SITE_NAME,
  },
};

const SECTIONS = [
  { id: 'escribanos', label: 'Escríbanos' },
  { id: 'no-hacemos', label: 'Lo que no hacemos' },
  { id: 'datos', label: 'Sus datos' },
];

export default function Contacto() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'Inicio', path: '/' },
            { name: TITLE, path: '/contacto' },
          ]),
        ]}
      />
      <Doc title={TITLE} lede={LEDE} sections={SECTIONS}>
        <DocSec id="escribanos" title="Escríbanos">
          <dl className={d.dl}>
            <dt>Correo</dt>
            <dd>
              <a href="mailto:hola@vale.cr">hola@vale.cr</a>
            </dd>

            <dt>Para qué</dt>
            <dd>
              <ul>
                <li>Un precio que ve en el sitio no cuadra con lo que dice la tienda.</li>
                <li>Encontró un producto emparejado con el modelo equivocado.</li>
                <li>
                  Quiere ejercer alguno de sus derechos sobre sus datos (vea la{' '}
                  <Link href="/privacidad">Política de Privacidad</Link>).
                </li>
                <li>Tiene una pregunta sobre cómo funciona la comparación.</li>
                <li>
                  Es de una de las cadenas que aparecen en el sitio y quiere hablar de algo puntual.
                </li>
              </ul>
            </dd>

            <dt>Plazo de respuesta</dt>
            <dd>
              Intentamos responder en un plazo razonable. Si el reporte es sobre un precio
              incorrecto, generalmente lo revisamos y corregimos antes de contestarle, para que la
              respuesta ya incluya la corrección.
            </dd>
          </dl>
        </DocSec>

        <DocSec id="no-hacemos" title="Lo que no hacemos por este canal">
          <p>
            No vendemos productos ni gestionamos compras — esas preguntas hay que hacerlas
            directamente en la tienda donde va a comprar. No damos soporte técnico de los productos
            que aparecen en el catálogo.
          </p>
        </DocSec>

        <DocSec id="datos" title="Sus datos">
          <p>
            Este es también el canal por el que llegan las solicitudes de acceso, rectificación,
            cancelación y oposición descritas en la{' '}
            <Link href="/privacidad">Política de Privacidad</Link>.
          </p>
        </DocSec>

        {/* the correction block points at the address itself here, rather than at
            this page — a page that tells you to visit itself is furniture */}
        <DocFix href="mailto:hola@vale.cr" label="hola@vale.cr" />
      </Doc>
    </>
  );
}
