import Link from 'next/link';

import { POLICY_STAMP } from '@/lib/consent';
import { Breadcrumb } from './Breadcrumb';
import d from './Doc.module.css';
import pg from './Page.module.css';

/* ==========================================================================
   THE SHARED TRUST-PAGE TEMPLATE (design-v5 §2)

   NO HERO. NO CENTRED ANYTHING. NO SECTION THAT EXISTS TO INTRODUCE THE NEXT
   SECTION. The page starts with its name, states when it took effect, and begins.
   That is the confident version and it is also the honest one — a trust page that
   warms you up is trying to sell you something.

   Everything here REUSES rather than re-declares: `pg.shell`, `pg.head`, `pg.h1`,
   `pg.sec`, `pg.secH`, `Breadcrumb`, and SpecTable's table idiom (ported into
   Doc.module.css because the markup is a real <table> here, not a 2-column grid).
   The only new declaration in the whole file set is a paragraph rhythm.
   ========================================================================== */

export interface DocSectionRef {
  id: string;
  /** the index label. Usually the h2 itself; shortened where the h2 is long. */
  label: string;
}

export function Doc({
  title, lede, sections, lead, stamp = true, children,
}: {
  title: string;
  lede: string;
  sections: DocSectionRef[];
  /** THE POLICY VERSION STAMP, and it is a claim rather than decoration.
   *  `POLICY_STAMP` is the SAME value the consent cookie records, so a page
   *  carrying it is asserting "this document is part of the policy you
   *  accepted". That is true of the six legal routes and FALSE of /comercios,
   *  which is a business page with no effective date and nothing to consent to.
   *  Printing it there would date-stamp a commercial pitch as a legal
   *  instrument. Defaults true so every existing caller is unchanged. */
  stamp?: boolean;
  /** /metodologia only: the claims table, which comes BEFORE the prose (§3). */
  lead?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={pg.shell}>
      <Breadcrumb trail={[{ name: 'Inicio', path: '/' }, { name: title }]} />
      <div className={pg.head}>
        <h1 className={pg.h1}>{title}</h1>
        {/* THE VERSION STRING IS REQUIRED BY THE CONSENT RECORD (§4.5): the cookie
            stores which policy version was accepted, so the version on the page and
            the version in the cookie are ONE value, read from one constant. */}
        {stamp ? <p className={d.stamp}>{POLICY_STAMP}</p> : null}
        {/* ONE sentence saying what this page is. Never a warm-up. */}
        <p className={pg.lede}>{lede}</p>
      </div>

      <div className={d.doc}>
        {/* ONE element, two layouts — a --fill panel above the document below
            1024, a 200px sticky column beside it above. A distinct landmark name:
            "Categorías", "Ruta" and "Explorar por categoría" are taken. */}
        <nav className={d.index} aria-label="Secciones de esta página">
          <p className={d.indexK}>En esta página</p>
          <ul className={d.indexList}>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        {/* `.prose` CARRIES THE TABLE IDIOM, so the lead card needs it too — the
            claims table is a grid SIBLING of the article, not a descendant, and
            without this its th/td rules (the --t1 uppercase column headers, the
            alternating rows, the <768 stacking) simply do not apply. It renders as
            an unstyled table and nothing errors. `data-prose` stays on the article
            alone: that is the GATE HOOK, and the lead card carries no prose for
            assertion 19 to measure. */}
        {lead ? <div className={`${d.lead} ${d.prose}`}>{lead}</div> : null}

        {/* `data-prose` is the gate hook AND the structural classifier: measure.mjs
            §6.0 reads it to tell a document surface from a product surface, so the
            zero-node meta-assertions relocate rather than weaken. */}
        <article className={`${d.paper} ${d.prose}`} data-prose>
          {children}
        </article>
      </div>
    </div>
  );
}

/** One `.sec` — 24px + a --line hairline on every section after the first, which
 *  is v4's section rhythm verbatim. The `id` is what the index links to and what
 *  the 108px scroll-margin clears. */
export function DocSec({
  id, title, children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={pg.sec} aria-labelledby={id}>
      <h2 id={id} className={pg.secH}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A `.wide` evidence table. `head` is THE source of both renders: the `<th>` at
 *  ≥768 and the `td::before` key at <768 read the same array, so the stacked view
 *  can never drift from the column it describes. */
export function DocTable({
  caption, head, rows, figureCol,
}: {
  caption: string;
  head: string[];
  rows: React.ReactNode[][];
  /** index of the column that carries figures — tabular numerals */
  figureCol?: number;
}) {
  return (
    <div className={`${d.wide} ${d.tableWrap}`}>
      <table>
        <caption className={d.cap}>{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={i}>
              {cells.map((c, j) => (
                <td
                  // eslint-disable-next-line react/no-array-index-key
                  key={j}
                  data-k={head[j]}
                  className={j === figureCol ? d.figure : undefined}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** THE CLOSING BLOCK, ON ALL SIX PAGES. A visible route to report a wrong price
 *  is asked for by consumer law, and a documented correction process is itself
 *  a defence. One component closes it everywhere.
 *
 *  the copywriter's register throughout these pages is `usted`, not voseo, so this is
 *  "¿Encontró un error?" rather than the spec's "¿Encontraste un error?". */
export function DocFix({ href = '/contacto', label = 'Escríbanos' }: { href?: string; label?: string }) {
  return (
    <div className={d.fix}>
      <p>
        <b>¿Encontró un error?</b> Escríbanos y lo corregimos.{' '}
        {href.startsWith('mailto:') ? (
          <a href={href}>{label}</a>
        ) : (
          <Link href={href}>{label}</Link>
        )}
      </p>
    </div>
  );
}

export { d as docStyles };
