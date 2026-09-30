/* `Dónde comprar` (§4.5-6) — the branch list, grouped by cantón.

   NO MAP IN v4, and that is a decision with three reasons rather than a shortcut:
   a Maps embed is a third-party script on the critical path, it needs an API key
   with an owner, and 6 of our 8 chains are not geocoded at all. zap's version
   renders a live Google map with ~40 pins because they have the coverage to fill
   it; we do not, and a map with two chains' pins on it advertises the gap instead
   of hiding it. THE LIST IS THE HONEST VERSION AND IT COSTS NOTHING.

   ONE SPEC ITEM DOWNGRADED, FLAGGED. §T3 asks for `region select → city select →
   list`. `Branch` carries `canton` and `address` but NO REGION/PROVINCE field, and
   only 98 of Monge's 146 branches and 136 of Gollo's 181 even carry a cantón. Two
   selects over one populated field would be a control that filters nothing, so the
   panel groups by cantón and states the coverage. Adding provinces is an engine
   change, not a UI change.

   NO PER-BRANCH STOCK, EVER. spec-v2 §7 forbids the claim: no chain publishes
   inventory per branch, so the panel says where the shops are and explicitly does
   not say whether the unit is in one. That sentence is the difference between this
   panel and a lie. */

import { cleanBranch, LUGAR } from '@/lib/display';
import type { Branch, Enriched } from '@/lib/types';
import p from './primitives.module.css';
import s from './BranchPanel.module.css';

/* v4.1-FIX B8 — `VISIBLE_CANTONES = 8` IS DELETED. THE PANEL IS A CLOSED DISCLOSURE.

   Measured: the branch list rendered 120 of the ~165 twelve-pixel text nodes on a
   product page — 60 cantón headings at 12/600 plus 60 comma-joined branch lists at
   12/400 — and the panel measured 1299px tall at 390 on T3, 24% of a 5.445px page,
   against 544px for the offer table that is the page's PRIMARY region. THE PAGE'S
   VERTICAL BUDGET WAS ALLOCATED INVERSELY TO VALUE, in the smallest type available.

   Showing 8 cantones and offering 138 more was the worst of both: it paid the full
   scanning cost of a reference list AND still needed the disclosure. So the disclosure
   carries all of it, at every width, and the summary states the FULL count so nothing is
   hidden without saying how much.

   THE CRITIQUE ASKED FOR THIS AT ≤767 ONLY. Taken at every width, and the reason is
   that a width-dependent version needs the lead list rendered ALONGSIDE the disclosure
   and hidden by a media query — which either duplicates 8 cantones per chain in the HTML
   or makes the summary's count a lie at one of the two widths. One closed disclosure is
   strictly less code than either, and the desktop panel had the same
   budget-versus-value problem in absolute pixels. FLAGGED as a deviation.

   Crawlability is unaffected: a native <details> keeps every branch name in the HTML,
   keyboard-reachable and openable with JavaScript off. Copy beyond the counts is the copywriter's. */

/** The chains that sell this product, each with its own branches, grouped by
 *  cantón. Composed from the artifact — there is no chain list in this file. */
export function BranchPanel({
  product, branches,
}: {
  product: Enriched;
  branches: Branch[];
}) {
  const chains = product.sorted.map((o) => o.retailer);

  const perChain = chains.map((chain) => {
    const mine = branches.filter((b) => b.retailer === chain);
    const groups = new Map<string, string[]>();
    for (const b of mine) {
      const key = b.canton ?? 'Sin cantón publicado';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(cleanBranch(b.name));
    }
    return {
      chain,
      total: mine.length,
      groups: [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')),
    };
  });

  return (
    <div className={s.panel}>
      {perChain.map((c) => (
        <section className={s.chain} key={c.chain}>
          <h3 className={s.chainH}>
            {c.chain}
            {/* THE COUNT IS COMPOSED, never rounded and never padded. A chain with
                no directory says so — that is the state, not a hidden row. */}
            {/* v7 §5.2 C2 + §3 — THE ABSENCE GETS A MATERIAL WHERE THE COUNT GOES.
                A chain that publishes no directory used to be a 105px paragraph
                below this heading; it is now a HATCHED SWATCH sitting in the
                position the count occupies on every other row, plus one key at the
                foot of the panel. Same claim, and it becomes COUNTABLE and
                SCANNABLE — you can see at a glance how many chains are hatched,
                which a column of honest sentences cannot show you.

                THE HATCH MEANS EXACTLY ONE THING, PRODUCT-WIDE: *ninguna cadena lo
                publica* (§3.1 axis 1 — publication). It is never used for "we
                watched part of the window" (that is the dot meter, a filled
                proportion) and never for an editorial refusal (that is words). */}
            <span className={s.n}>
              {c.total ? ` · ${c.total} sucursales` : null}
            </span>
            {c.total ? null : (
              <>
                {' '}
                <span className={s.swatch} aria-hidden="true" />
                {/* THE SWATCH IS A MATERIAL, SO IT CARRIES NO ACCESSIBLE NAME AND THE
                    CLAIM IS SPELLED OUT FOR A SCREEN READER INSTEAD. A texture read
                    aloud as "image, hatch" states nothing; the sentence states the
                    fact, and it is the same fact the visual key states. */}
                <span className={p.sr}>{c.chain} no publica un directorio de sucursales.</span>
              </>
            )}
          </h3>

          {c.total ? (
            /* PROPORTION IS A CORRECTNESS PROBLEM HERE, not a taste one. A NATIVE
               `<details>`, not a JS disclosure: keyboard-reachable, screen-reader-correct
               and openable with JavaScript off, which matters because this content has to
               be crawlable. The summary STATES THE FULL COUNT — both counts, composed from
               the artifact, never rounded and never padded. */
            <details className={s.more}>
              <summary className={s.summary}>
                {/* A COMMA, NOT A `·`. measure.mjs asserts no separator may start, end, or
                    sit alone on a rendered line, and this summary wraps at 390. A comma
                    cannot read as debris at a line boundary. */}
                Ver las sucursales: {c.groups.length}{' '}
                {c.groups.length === 1 ? 'cantón' : 'cantones'}, {c.total} en total
              </summary>
              <ul className={s.groups}>
                {c.groups.map(([canton, names]) => (
                  <li className={s.group} key={canton}>
                    <p className={s.canton}>{canton}</p>
                    <p className={s.names}>{names.join(', ')}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ))}

      {/* ---- THE KEY: ONCE PER SURFACE, NEVER PER INSTANCE (§3.3) ----
           A hatch with no key is a removal wearing a design costume. Silence is not
           honesty, so every surface that renders the material renders its key
           exactly once — here, at the foot of the panel that carries it, at --t1.
           It is conditional on there BEING an instance: a key for a material that
           does not appear on this page would be furniture. */}
      {perChain.some((c) => !c.total) ? (
        <p className={s.key}>
          <span className={s.swatch} aria-hidden="true" />
          Ninguna cadena publica este dato
        </p>
      ) : null}

      {/* ---- TWO METHOD CLAIMS MOVE **IN** HERE FROM `Cómo comparamos` (v7 §5.2 C1).
           NEITHER IS WITHDRAWN, AND THAT MATTERS MORE THAN WHERE THEY SIT.

           v6.1 §5.3 cut the per-chain stock disclaimer FROM this panel on the
           grounds that `Cómo comparamos` on the same page carried it. C1 has now
           turned that block into four key/value rows, so the sentence has no home
           there any more — leaving it out would be a silent withdrawal of an
           honesty claim under cover of a layout cull, which is the one thing §5's
           own rule forbids ("every removed sentence either becomes a visible
           mechanism or was genuinely redundant"; neither applies to these two).

           They land HERE rather than anywhere else because §5.3's rule is that a
           claim sits beside the thing it qualifies, and this panel is the only
           object on the page that talks about SHOPS: it is what a reader is looking
           at when they wonder whether the unit is in one, and it is the only thing
           on the page that states a distance.

           spec-v2 §7 FORBIDS ANY IMPLICATION OF PER-BRANCH STOCK. That sentence
           is the difference between this panel and a lie, and it is the reason this
           is a restoration rather than a nice-to-have.

           NO COUNT IN THE SENTENCE. A hardcoded count once drifted from
           `meta.retailers`. A figure that adds no information for the
           reader and can drift is pure liability: interpolate a number when the
           reader uses it, delete it when they do not, never hardcode it. */}
      <p className={s.none}>
        La existencia es por cadena: ninguna publica inventario por sucursal, así que no le podemos
        confirmar que una tienda tenga la unidad. Las distancias se miden desde {LUGAR}, que es un
        supuesto.
      </p>
    </div>
  );
}
