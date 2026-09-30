/* POLÍTICA DE COOKIES — the page the consent gate's "Más detalles" link opens,
   and where the choice can be changed later.

   The by-name cookie table is a factual inventory (name,
   provider, purpose, duration), and its FIRST ROW IS `vale_consent` ITSELF — the
   cookie that records the decision. That row is what makes the denied state's
   sentence ("this site keeps exactly one cookie") true and checkable.

   THE TABLE NEVER HIDES WHEN CONSENT IS DENIED (§5.2). A cookie policy that
   shows nothing when nothing is set teaches the reader nothing about what
   accepting would do. */

import type { Metadata } from 'next';
import Link from 'next/link';

import { ConsentReopen, ConsentState } from '@/components/Consent';
import { Doc, DocFix, DocSec, DocTable, docStyles as d } from '@/components/Doc';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd, SITE_NAME } from '@/lib/seo';

const TITLE = 'Política de Cookies';
const LEDE =
  'Qué cookies guarda vale.cr, cuáles dependen de su consentimiento y cómo cambiar su elección en cualquier momento.';

export const metadata: Metadata = {
  title: TITLE,
  description: LEDE,
  alternates: { canonical: '/cookies' },
  openGraph: {
    type: 'article', url: '/cookies', title: TITLE, description: LEDE,
    locale: 'es_CR', siteName: SITE_NAME,
  },
};

const SECTIONS = [
  { id: 'que-son', label: 'Qué son las cookies' },
  { id: 'estado', label: 'Su estado actual' },
  { id: 'categorias', label: 'Las categorías que usamos' },
  { id: 'ga4', label: 'Qué guarda GA4' },
  { id: 'retirar', label: 'Cómo retirar su consentimiento' },
];

export default function Cookies() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'Inicio', path: '/' },
            { name: TITLE, path: '/cookies' },
          ]),
        ]}
      />
      <Doc title={TITLE} lede={LEDE} sections={SECTIONS}>
        <DocSec id="que-son" title="Qué son las cookies, en corto">
          <p>
            Una cookie es un archivo pequeño que un sitio guarda en su navegador. Sirve para
            recordar cosas entre una visita y otra: por ejemplo, si usted ya aceptó un aviso o cómo
            llegó al sitio.
          </p>
          <p>
            vale.cr usa cookies solo para una cosa: medir cuánta gente visita el sitio y qué páginas
            revisa. No usamos cookies para mostrarle publicidad, ni para armarle un perfil, ni para
            venderle nada.
          </p>
        </DocSec>

        <DocSec id="estado" title="Su estado actual">
          {/* THE LIVE LINE — read from the cookie in the browser, never guessed on
              the server. It is the one sentence on these six pages that is a
              measurement rather than a statement. */}
          <ConsentState />
          <DocTable
            caption="Cada cookie, por nombre"
            head={['Cookie', 'Proveedor', 'Para qué', 'Duración']}
            rows={[
              [
                <code key="vc">vale_consent</code>,
                'vale.cr',
                'Recuerda si usted aceptó o rechazó el aviso, y la versión de la política que aceptó.',
                'Un año',
              ],
              [
                <code key="ga">_ga</code>,
                'Google Analytics 4',
                'Distingue una visita de otra. Solo se guarda si usted acepta.',
                'Dos años',
              ],
              [
                <code key="gaid">_ga_&lt;ID&gt;</code>,
                'Google Analytics 4',
                'Mantiene el estado de la sesión. Solo se guarda si usted acepta.',
                'Dos años',
              ],
            ]}
          />
        </DocSec>

        <DocSec id="categorias" title="Las categorías que usamos">
          <DocTable
            caption="Categorías de cookies"
            head={['Categoría', '¿La usamos?', 'Para qué']}
            rows={[
              [
                'Necesarias / técnicas',
                'Sí',
                'Recordar si usted aceptó o rechazó el aviso de cookies.',
              ],
              [
                'Analítica (Google Analytics 4)',
                'Solo si usted acepta',
                'Contar visitas, ver qué categorías y productos se consultan más, medir si el sitio carga bien.',
              ],
              [
                'Publicidad / remarketing',
                'No',
                'No las usamos. No hay publicidad en vale.cr.',
              ],
              [
                'Redes sociales',
                'No',
                'No hay botones ni pixeles de redes sociales que dejen cookie.',
              ],
            ]}
          />
        </DocSec>

        <DocSec id="ga4" title="Qué guarda Google Analytics 4">
          <p>
            Si usted acepta el aviso, GA4 guarda cookies e identificadores en su navegador para
            poder distinguir una visita de otra y saber, por ejemplo, si usted volvió al sitio otro
            día. Esa información se procesa según lo descrito en la{' '}
            <Link href="/privacidad">Política de Privacidad</Link>, incluyendo el envío a servidores
            de Google fuera de Costa Rica.
          </p>
          <p>
            Si usted rechaza el aviso, GA4 no se activa: no se guarda esa cookie y no le enviamos
            información a Google.
          </p>
        </DocSec>

        <DocSec id="retirar" title="Cómo retirar su consentimiento">
          <p>Su elección queda guardada en su navegador. Si en algún momento quiere cambiarla, puede hacerlo:</p>
          <ul>
            <li>
              Desde el enlace <b>Preferencias de cookies</b> en el pie de página de vale.cr, que
              reabre el aviso.
            </li>
            <li>Borrando las cookies de este sitio directamente en la configuración de su navegador.</li>
          </ul>
          <p>
            Retirar el consentimiento no le quita acceso a ninguna parte del sitio. vale.cr funciona
            igual, con o sin analítica activada — la analítica es para nosotros, no para que el
            sitio le funcione a usted.
          </p>
          <p>
            <ConsentReopen className={d.reopen} />
          </p>
        </DocSec>

        <DocFix />
      </Doc>
    </>
  );
}
