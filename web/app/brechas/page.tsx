/* ==========================================================================
   `/brechas` — DÓNDE MÁS VARÍA EL PRECIO EN COSTA RICA (v6.1 §4)

   THE ONE PAGE ON THIS SITE THAT SOMEBODY MIGHT LINK TO. Every other route
   answers a query about a product; this one publishes a measurement of Costa
   Rican retail that exists nowhere else, from an artifact we already hold. A
   price DROP is a claim about time and needs fourteen days of observations; a
   price SPREAD is a claim about one day and needs one. We have 502 comparable
   products today, so this ships two weeks before `/bajaron` can.

   ---- THE FIVE HONESTY GUARDS, AND WHERE EACH ONE LIVES (§4.5) ----

   1. THE DENOMINATOR IS ON THE PAGE, above the first leaderboard, in the same
      type as the rest of the standfirst. 3.752 of 4.254 products are sold by one
      chain, so there is nothing to compare; this page is about the 502 that are.
      Without that sentence a reader concludes Costa Rican retail varies by 80%
      IN GENERAL, which is not what the artifact says and is not what we mean.
   2. `parejo` NEVER APPEARS and neither does a single-offer product. Enforced in
      `lib/gaps.server.ts`, not here — a view can forget a filter.
   3. IT IS A MEASUREMENT, NEVER AN ACCUSATION. The title is `Dónde más varía el
      precio`, not `los precios más abusivos`, and the sentence "una brecha es la
      diferencia entre precios publicados el mismo día; no dice que una cadena
      sea más cara en general" is carried at the top rather than in the method
      block. The difference between "where prices vary most" and "who rips you
      off" is the whole difference between an outreach asset and a takedown.
   4. THE PAGE RANKS PRODUCTS, NEVER CHAINS. There is no per-retailer
      aggregate on this page, no "which chain overcharges most" table, and no
      sort option that would produce one. A column that scored chains would be a
      different product with its own legal exposure, and it is not built.
   5. IT IS DATED FROM THE DATA (`meta.generated_at`), never from the clock. A
      prerendered page that stamps itself with a wall clock keeps asserting a
      freshness it cannot know.

   ---- WHAT MAKES IT AN ANSWER-ENGINE TARGET RATHER THAN A PAGE ----
   Prerendered, in the sitemap, server-rendered, no JS gate, and every figure
   composed from the artifact. Nothing here waits for `products.json` to reach a
   browser, so a crawler with JavaScript disabled reads the same twenty rows and
   the same fourteen category facts a person does.

   NOT BUILT HERE, DELIBERATELY: the §4.4 OG card (a `80%` statistic over a dated
   caption). That is v6 Wave 2.2 — an export-time renderer pushing to R2 — and
   inventing a one-off image pipeline for one route would be the opposite of the
   sequencing that document sets. Flagged in the build report, not faked.
   ========================================================================== */

import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumb } from '@/components/Breadcrumb';
import { docStyles as d, DocTable } from '@/components/Doc';
import { GapBoard, gapStyles as g } from '@/components/GapBoard';
import { GapStrip } from '@/components/GapStrip';
import { JsonLd } from '@/components/JsonLd';
import pg from '@/components/Page.module.css';
import p from '@/components/primitives.module.css';
import { ProductLink } from '@/components/ProductLink';
import { bandAttrs } from '@/lib/catalog';
import { crc, dec, diaLargo, mil, pct } from '@/lib/format';
import { buildGaps, MIN_FOR_MEDIAN, STRONG_GAP_PCT } from '@/lib/gaps.server';
import { breadcrumbJsonLd, chainSentence, productName, SITE_NAME } from '@/lib/seo';

const PATH = '/brechas';
const TITLE = 'Dónde más varía el precio en Costa Rica';

/** `13,8` — the Spanish decimal comma, through the one formatter. A percentage
 *  with one decimal is a measurement; the same number rounded is a headline. */
const pctDec = (n: number) => `${dec(n)}%`;

export function generateMetadata(): Metadata {
  const s = buildGaps();
  const description =
    `De ${mil(s.total)} productos, ${mil(s.comparable)} se venden en más de una cadena en Costa Rica. `
    + `Entre esos, la diferencia mediana entre el precio más alto y el más bajo del mismo modelo es de `
    + `${pctDec(s.medianPct)} y la mayor llega a ${pct(s.maxPct, false)}. Medido el `
    + `${diaLargo(s.generatedAt)}, categoría por categoría.`;

  return {
    title: { absolute: `${TITLE} · ${SITE_NAME}` },
    description,
    alternates: { canonical: PATH },
    openGraph: {
      type: 'article',
      url: PATH,
      title: TITLE,
      description,
      locale: 'es_CR',
      siteName: SITE_NAME,
    },
    twitter: { card: 'summary', title: TITLE, description },
  };
}

export default function Brechas() {
  const s = buildGaps();
  const day = diaLargo(s.generatedAt);

  /* THE `Por categoría` TABLE — the block this page exists to have cited.
     Fourteen rows of Costa Rican retail facts that are published nowhere else,
     each one linked to the page that proves it.

     THE SPARSE ANSWER (§4.6): a category with fewer than five comparable
     products gets a dash in the median column and a stated footnote, never a
     median computed from three observations. The row still renders — the count
     and the widest spread are facts whatever the sample size — because dropping
     the category would be the same overclaim pointed the other way. */
  const rows: React.ReactNode[][] = s.cats.map((c) => [
    <Link key="cat" href={`/categoria/${c.id}`}>
      {c.label}
    </Link>,
    <span key="n" className={p.num}>
      {mil(c.comparable)} de {mil(c.total)}
    </span>,
    <span key="med" className={p.num}>
      {c.medianPct === null ? '—' : pctDec(c.medianPct)}
    </span>,
    <span key="strong" className={p.num}>
      {mil(c.strong)}
    </span>,
    /* THE CATEGORY TABLE'S GAP COLUMN TAKES THE RAMP (v7.1 §10 W7). Fourteen
       superlatives in one column, ordered by nothing in particular — so the
       colour is the only thing that lets a reader see, without arithmetic, that
       the widest spread in `Cocinas` is a different ORDER of fact from the
       widest in `Tablets`. It is the third adjacency surface after the strip and
       the two leaderboards.

       THE WORD TRAVELS WITH THE NUMBER, as it does on every other amber object
       in this product — a bare amber `80%` reads as a discount, and nobody can
       save 80%. Here the column heading is the noun (`La más grande`), so the
       word is carried for assistive tech through the existing `p.sr` primitive
       rather than printed a fourteenth time inside a narrow cell. */
    c.top ? (
      <span key="top" className={g.topCell}>
        <ProductLink id={c.top.id}>{productName(c.top)}</ProductLink>
        <span className={g.gap} {...bandAttrs(c.top)}>
          <span className={p.sr}>brecha </span>
          {pct(c.top.gapPct, false)}
        </span>
      </span>
    ) : (
      <span key="top">—</span>
    ),
  ]);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: 'Inicio', path: '/' },
            { name: 'Brechas', path: PATH },
          ]),
        ]}
      />

      <div className={pg.shell}>
        <Breadcrumb trail={[{ name: 'Inicio', path: '/' }, { name: 'Brechas' }]} />

        <div className={pg.head}>
          <h1 className={pg.h1}>{TITLE}</h1>
          {/* DATED FROM THE ARTIFACT. It is the difference between a measurement
              and an advertisement, and it is the one thing no competitor in this
              market puts on a page like this. */}
          <p className={d.stamp}>Precios leídos el {day}</p>
          <p className={pg.lede}>
            Cuando dos cadenas publican el mismo número de modelo, casi nunca cobran lo mismo. Esto es
            qué tan grande es esa diferencia hoy.
          </p>
        </div>

        <div className={pg.sec}>
          {/* THE THREE KPI BOXES ARE GONE AND ALL THREE FIGURES SURVIVED
              (v7 §2.3, specced v7.1 §3.4). They were three identical 421×37
              boxes asserting `525 · 14,2% · 80%` side by side; the strip states
              the same three with their RELATIONSHIP visible — 525 is the
              headline, the median is a POSITION on the axis, and the maximum is
              not an annotation at all, it is the axis's own right-hand end.

              It also does a second job no card can: it is the ramp's legend.
              Five bins, adjacent, in gap order, pale to dark, with the largest
              bin drawn in neutral because it is the one where nothing is wrong.
              Every amber object elsewhere in the product is decodable after it.

              This is a COMPOSITION change riding in a colour wave, and it is
              stated in the build report rather than smuggled: a strip that
              teaches the ramp underneath three boxes that restate its three
              figures would be the fourth statement of the same numbers. */}
          <GapStrip gaps={s} />

          {/* TWO COLUMNS AT ≥1024 — the prose measure is 44ch and the shell is
              1360, so the only honest way to spend that width is sideways. The
              wrapper exists for the grid; neither sentence changed. */}
          <div className={g.guards}>
            {/* GUARD 1 — THE DENOMINATOR. Without this sentence the tables below
                read as cherry-picked, and a reader walks away believing that
                Costa Rican retail varies by 80% in general. */}
            <p className={g.guard}>
              De los <b>{mil(s.total)}</b> productos que publicamos, <b>{mil(s.solo)}</b> los vende
              una sola cadena, así que no hay nada con qué compararlos. Esta página habla de los{' '}
              <b>{mil(s.comparable)}</b> que sí, y de esos, <b>{mil(s.strong)}</b> tienen una
              diferencia de {STRONG_GAP_PCT}% o más.
            </p>

            {/* GUARD 3 — MEASUREMENT, NOT ACCUSATION. */}
            <p className={g.guard}>
              Una brecha es la diferencia entre precios publicados el mismo día. No dice que una
              cadena sea más cara en general, ni que alguien esté cobrando de más: dice que ese día,
              por ese modelo, el precio no era el mismo en todas partes.
            </p>
          </div>
        </div>

        <GapBoard
          id="por-porcentaje"
          title="La brecha más grande en porcentaje"
          note="ordenado por diferencia porcentual"
          items={s.byPct}
        />

        <GapBoard
          id="en-colones"
          title="La brecha más grande en colones"
          note="las mismas cifras, ordenadas por diferencia en colones"
          items={s.byCrc}
        />

        <section className={pg.sec} aria-labelledby="por-categoria">
          <div className={pg.secHead}>
            <h2 className={pg.secH} id="por-categoria">
              Por categoría
            </h2>
            <p className={pg.secN}>{mil(s.cats.length)} categorías, medidas el {day}</p>
          </div>
          {/* `d.prose` CARRIES THE TABLE IDIOM (Doc.module.css) and nothing else
              this page needs — the th/td rules, the alternating rows and the <768
              stacking are declared under that scope. It is the class, NOT the
              `data-prose` attribute: the attribute is measure.mjs's document
              classifier, and a document surface may carry no amber at all, which
              is correct for a policy page and wrong for a page whose subject is
              the gap chip. Reusing the class costs zero new CSS; adopting the
              attribute would cost the leaderboards. */}
          <div className={d.prose}>
            {/* THE CAPTION IS ≤60 CHARACTERS ON PURPOSE. `Doc`'s caption is a --t1
                eyebrow, and measure.mjs fails a 12px node carrying a sentence — the
                first wording measured 61 and failed at all thirteen widths. The
                floor's third role is a caption; a caption is not a sentence. */}
            <DocTable
              caption="Comparables, mediana y la mayor brecha por categoría"
              head={['Categoría', 'Comparables', 'Mediana', `Brecha ≥${STRONG_GAP_PCT}%`, 'La más grande']}
              rows={rows}
            />
          </div>
          {/* ONE FOOTNOTE, TWO WITHHELD COLUMNS. The sparse rows now dash BOTH the
              median and the superlative (The designer Tier-2 §3), and the sentence that was
              already here says so — a second footnote for the second column would
              imply two different reasons, and there is one. */}
          {s.sparse.length ? (
            <p className={g.foot}>
              {chainSentence(s.sparse.map((c) => c.label))}{' '}
              {s.sparse.length === 1 ? 'tiene' : 'tienen'} menos de {MIN_FOR_MEDIAN} productos
              comparables: no publicamos ni la mediana ni la brecha más grande con tan pocas
              observaciones.
            </p>
          ) : null}
        </section>

        <section className={pg.sec} aria-labelledby="como-se-mide">
          <div className={pg.secHead}>
            <h2 className={pg.secH} id="como-se-mide">
              Cómo se mide
            </h2>
          </div>
          <div className={g.method}>
            <p>
              Leemos todos los días el precio de contado que cada cadena publica en su propio sitio,
              con el IVA incluido. Cuando dos o más cadenas publican <b>el mismo número de modelo</b>,
              el producto se puede comparar. La brecha es el precio más alto menos el más bajo,
              dividido entre el más bajo, entre precios leídos <b>el mismo día</b>.
            </p>
            <p>
              Solo aparecen aquí los productos con una brecha de 5% o más. Por debajo de eso las
              cadenas están cobrando prácticamente lo mismo y no marcamos a ninguna como la barata.
              Los productos que vende una sola cadena no aparecen: no hay una segunda cifra que
              restar.
            </p>
            {/* THE TWO EXAMPLES ARE READ OFF THE BOARDS, never typed. A sentence
                that names "una cocina" is a sentence that outlives the day the
                widest spread moves to another category — the same class of stale
                claim as a hardcoded chain count. */}
            <p>
              Las dos listas de arriba son <b>los mismos diez datos ordenados de dos maneras</b>. Una
              brecha de {pct(s.byPct[0].gapPct, false)} sobre un producto de{' '}
              {crc(s.byPct[0].lo.price_crc)} y una de {crc(s.byCrc[0].gapCrc)} sobre otro de{' '}
              {crc(s.byCrc[0].lo.price_crc)}: las dos son ciertas, y ninguna es «la más grande» sin
              decir antes en qué. Por eso publicamos las dos en vez de escoger una.
            </p>
            <p>
              Esta página compara <b>productos, no cadenas</b>. No publicamos un ranking de cuál
              cadena cobra más: una cadena puede ser la más barata en un modelo y la más cara en el
              siguiente, y un promedio sobre catálogos distintos no diría nada cierto sobre ninguna.
            </p>
            <p>
              Todas las cifras salen del catálogo del {day}. El método completo, con lo que no
              hacemos y lo que no sabemos, está en <Link href="/metodologia">cómo comparamos</Link>.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
