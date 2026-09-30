/* Privacy policy page (Ley 8968 + Reglamento 37554-JP, Costa Rica). */

import type { Metadata } from 'next';
import Link from 'next/link';

import { Doc, DocFix, DocSec, DocTable } from '@/components/Doc';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, SITE_NAME } from '@/lib/seo';

const TITLE = 'Política de Privacidad';
const LEDE =
  'Qué información recoge vale.cr, para qué la usa, con quién se comparte y cómo puede usted ejercer sus derechos.';

export const metadata: Metadata = {
  title: TITLE,
  description: LEDE,
  alternates: { canonical: '/privacidad' },
  openGraph: {
    type: 'article', url: '/privacidad', title: TITLE, description: LEDE,
    locale: 'es_CR', siteName: SITE_NAME,
  },
};

const SECTIONS = [
  { id: 'responsable', label: 'Responsable' },
  { id: 'que-recogemos', label: 'Qué recogemos' },
  { id: 'con-quien', label: 'Con quién se comparte' },
  { id: 'transferencia', label: 'Transferencia internacional' },
  { id: 'arco', label: 'Derechos ARCO' },
  { id: 'conservacion', label: 'Conservación' },
  { id: 'cambios', label: 'Cambios' },
];

export default function Privacidad() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'Inicio', path: '/' },
            { name: TITLE, path: '/privacidad' },
          ]),
        ]}
      />
      <Doc title={TITLE} lede={LEDE} sections={SECTIONS}>
        <DocSec id="responsable" title="Quién es responsable de este sitio">
          <p>
            vale.cr es un proyecto operado por <b>AK Studio</b>, con domicilio en{' '}
            {/* NOT bolded, unlike the placeholder it
                replaces: the bold was a warning marker to stop it shipping
                unnoticed, and carrying it over would emphasise the address above
                the entity name beside it for no reason. */}
            65P9+5P, Santa Cruz, Provincia de Guanacaste, Costa Rica, y correo de
            contacto <a href="mailto:hola@vale.cr">hola@vale.cr</a>.
          </p>
          <p>
            Esta política aplica a todo lo que ocurre en vale.cr. Si tiene dudas sobre cómo
            tratamos sus datos, puede escribirnos al correo indicado arriba.
          </p>
        </DocSec>

        <DocSec id="que-recogemos" title="Qué información recogemos y para qué">
          <p>
            vale.cr no le pide que se registre. No hay cuentas, no hay formulario de suscripción y
            no guardamos ninguna lista de correos.
          </p>
          <p>
            Lo único que recogemos hoy es <b>información de analítica web</b>, a través de Google
            Analytics 4 (GA4). Esto incluye:
          </p>
          <ul>
            <li>Su dirección IP (procesada de forma que no la identifica directamente).</li>
            <li>El tipo de dispositivo y navegador que usa.</li>
            <li>Las páginas que visita dentro de vale.cr y cuánto tiempo pasa en cada una.</li>
            <li>Cómo llegó al sitio (por ejemplo, desde un buscador o un enlace directo).</li>
          </ul>
          <p>
            Usamos esta información para entender qué productos y categorías se consultan más, y
            para saber si el sitio funciona bien. No la usamos para identificarlo a usted como
            persona, ni la cruzamos con ninguna otra base de datos.
          </p>
          <p>
            GA4 solo empieza a recoger esta información <b>después de que usted acepta</b> el aviso
            de cookies. Puede ver el detalle de qué se activa en la{' '}
            <Link href="/cookies">Política de Cookies</Link>.
          </p>
          <p>
            Los datos de productos y precios que publicamos (nombres de modelos, precios, tiendas)
            no son datos personales suyos: son información pública sobre productos, tomada de los
            sitios de las cadenas.
          </p>

          {/* THE TABLE IS EVIDENCE, SO IT ESCAPES THE 44ch MEASURE AND FILLS THE
              COLUMN (§2.2). Being precise about what is actually collected is
              what sizes the whole obligation. */}
          <DocTable
            caption="Qué se recoge y qué no"
            head={['Dato', '¿Se recoge?', 'Nota']}
            rows={[
              [
                'Datos de producto y precio',
                'Sí',
                'No son datos personales suyos: son información pública sobre productos.',
              ],
              [
                'Analítica GA4 (cookies, IP, dispositivo)',
                'Solo si usted acepta',
                'Es toda la información personal que tratamos hoy.',
              ],
              ['Cuentas o inicio de sesión', 'No', 'No existen en vale.cr.'],
              ['Correo o boletín', 'No', 'No guardamos ninguna lista de correos.'],
              [
                'Formulario de contacto',
                'No',
                'No hay formulario. El contacto es por correo directo.',
              ],
            ]}
          />
        </DocSec>

        <DocSec id="con-quien" title="A quién le compartimos esta información">
          <p>
            El único destinatario de sus datos de analítica es <b>Google</b>, como proveedor del
            servicio Google Analytics 4. Google procesa esta información en servidores que pueden
            estar fuera de Costa Rica, incluyendo Estados Unidos.
          </p>
          <p>
            No vendemos, alquilamos ni compartimos su información con ninguna cadena, anunciante ni
            tercero distinto de Google.
          </p>
        </DocSec>

        <DocSec id="transferencia" title="Transferencia internacional de datos">
          <p>
            Como GA4 es un servicio de Google, la información que recoge se transfiere y procesa
            fuera de Costa Rica. Google publica sus propias políticas y garantías sobre cómo protege
            esa información; puede consultarlas directamente en el sitio de Google.
          </p>
        </DocSec>

        <DocSec id="arco" title="Sus derechos (derechos ARCO)">
          <p>Como persona usuaria, usted tiene derecho a:</p>
          {/* AN <ol>, NOT PROSE. Four enumerated rights that the law itself
              enumerates — and the section ends with HOW to exercise them, which is
              a real link and not an abstraction (§5.1). */}
          <ol>
            <li>
              <b>Acceso</b> — saber qué información suya tenemos, si la hay.
            </li>
            <li>
              <b>Rectificación</b> — pedir que corrijamos información suya que esté incorrecta.
            </li>
            <li>
              <b>Cancelación</b> — pedir que eliminemos su información.
            </li>
            <li>
              <b>Oposición</b> — pedirnos que dejemos de tratar su información de una forma
              específica.
            </li>
          </ol>
          <p>
            Como no manejamos cuentas ni formularios, hoy la información que podríamos tener sobre
            usted es la que Google Analytics asocia a su navegador o dispositivo, no un registro con
            su nombre.
          </p>
          <p>
            Para ejercer cualquiera de estos derechos, escríbanos a{' '}
            <a href="mailto:hola@vale.cr">hola@vale.cr</a>. Le responderemos indicando qué
            encontramos y qué acción tomamos. También puede usar la página de{' '}
            <Link href="/contacto">contacto</Link>.
          </p>
        </DocSec>

        <DocSec id="conservacion" title="Cuánto tiempo guardamos la información">
          <p>
            Los datos de analítica en GA4 se conservan según el período de retención configurado en
            esa herramienta — eventos durante <b>2 meses</b> y datos de usuario durante{' '}
            <b>14 meses</b>. Después de ese período, Google los elimina o los anonimiza
            automáticamente.
          </p>
          <p>
            No mantenemos una base de datos propia con información personal de personas usuarias.
          </p>
        </DocSec>

        <DocSec id="cambios" title="Cambios a esta política">
          <p>
            Si cambiamos lo que recogemos o cómo lo usamos, actualizamos esta página y la fecha de
            arriba. Si el cambio es importante, se lo avisaremos también en el aviso de cookies.
          </p>
        </DocSec>

        <DocFix />
      </Doc>
    </>
  );
}
