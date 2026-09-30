/* ACERCA DE — a first-person statement in the same 44ch column as every other
   page: no hero, no stat row, no team grid. Every figure is composed from
   `buildStats()`, never typed, so the page cannot go stale when the catalogue
   changes. The business-model section states that there is none today. */

import type { Metadata } from 'next';
import Link from 'next/link';

import { Doc, DocFix, DocSec, docStyles as d } from '@/components/Doc';
import { JsonLd } from '@/components/JsonLd';
import { mil } from '@/lib/format';
import { breadcrumbJsonLd, chainSentence, SITE_NAME } from '@/lib/seo';
import { serverCatalog } from '@/lib/server-catalog';
import { buildStats } from '@/lib/stats.server';
import { retailerNames } from '@/lib/types';

const TITLE = 'Acerca de vale.cr';
const LEDE =
  'Quién opera este sitio, por qué existe y cómo se sostiene — un proyecto independiente, no una tienda y no una cadena.';

export const metadata: Metadata = {
  title: TITLE,
  description: LEDE,
  alternates: { canonical: '/acerca' },
  openGraph: {
    type: 'article', url: '/acerca', title: TITLE, description: LEDE,
    locale: 'es_CR', siteName: SITE_NAME,
  },
};

const SECTIONS = [
  { id: 'que-es', label: 'Qué es esto' },
  { id: 'quien', label: 'Quién lo hace' },
  { id: 'por-que', label: 'Por qué existe' },
  { id: 'sostiene', label: 'Cómo se sostiene' },
  { id: 'contacto', label: 'Cómo lo contacta' },
];

export default function Acerca() {
  const stats = buildStats();
  const chains = chainSentence(retailerNames(serverCatalog().meta.retailers));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'Inicio', path: '/' },
            { name: TITLE, path: '/acerca' },
          ]),
        ]}
      />
      <Doc title={TITLE} lede={LEDE} sections={SECTIONS}>
        <DocSec id="que-es" title="Qué es esto">
          <p>
            vale.cr lee los precios que publican {chains} en Costa Rica y los junta por número de
            modelo, para que usted vea en un solo lugar dónde cuesta menos.
          </p>
          <p>
            Hoy cubre {mil(stats.total)} productos. De esos, {mil(stats.comparable)} aparecen
            publicados en más de una cadena, así que son los únicos que en realidad se pueden
            comparar. Los otros {mil(stats.solo)} solo los publica una cadena — el sitio lo dice
            así, sin fingir una comparación que no existe.
          </p>
        </DocSec>

        <DocSec id="quien" title="Quién lo hace">
          <p>
            vale.cr es <b>un proyecto de AK Studio</b>. No es una tienda, no es una cadena, y no es
            un proyecto de ninguna de las cadenas que aparece en el sitio.
          </p>
        </DocSec>

        <DocSec id="por-que" title="Por qué existe">
          <p>
            Los comparadores que ya existen en Costa Rica no explican cómo ordenan los resultados.
            vale.cr sí lo explica — vea <Link href="/metodologia">Cómo comparamos</Link> para el
            detalle completo de cómo se leen los precios, cómo se emparejan los modelos y qué tan
            seguido se actualizan.
          </p>
        </DocSec>

        <DocSec id="sostiene" title="Cómo se sostiene">
          {/* THE PAGE'S ONE NON-PROSE OBJECT, and it is the no-commission position
              rather than a stat row. It escapes the measure because it is the
              thing the page is FOR, not because it is decorated. */}
          <div className={`${d.wide} ${d.fix}`}>
            <p>
              Ninguna de las cadenas nos paga, nos patrocina ni tiene ningún tipo de acuerdo con
              vale.cr. Leemos sus precios públicos igual que lo haría cualquier persona comparando
              antes de comprar. <b>Este sitio no vende productos ni cobra comisión.</b>
            </p>
          </div>
          {/* WAS a visible `[MODELO DE NEGOCIO: pendiente …]` placeholder, live to
              the public until 2026-08-10.

              The instinct behind it was right and the conclusion was wrong. It
              existed so that an unresolved question would not be dressed up as
              resolved — but that framing assumed only two options, publish the
              placeholder or fake an answer. There is a third: THE OPEN QUESTION
              BELONGS IN THE REPO; THE PAGE OWES THE READER A TRUE STATEMENT.

              And there is a true statement available, which is the part the
              placeholder obscured: today this site earns nothing. That is not a
              gap in the page, it is a FACT about the business, and on a page whose
              entire job is establishing independence it is the strongest sentence
              available. Monetisation is deliberately deferred; deferred is a
              decision, not a blank. If this changes and the sentence does not,
              the sentence becomes a lie. */}
          <p>
            Hoy vale.cr no genera ingresos: no cobramos a las cadenas, no vendemos publicidad y no
            usamos enlaces de afiliado. Si eso cambia, lo diremos en esta misma página y explicaremos
            cómo, porque cualquier forma de sostenimiento tiene que ser visible para que usted pueda
            juzgar si afecta lo que le mostramos.
          </p>
        </DocSec>

        <DocSec id="contacto" title="Cómo lo contacta">
          <p>
            Si encuentra un error, tiene una pregunta o representa a una de las cadenas, escriba a{' '}
            <Link href="/contacto">contacto</Link>.
          </p>
        </DocSec>

        <DocFix />
      </Doc>
    </>
  );
}
