/* ONE LEADERBOARD, RENDERED TWICE (v6.1 §4.3).
   ==========================================================================

   `/brechas` carries two boards — the widest spread in PERCENT and the widest
   spread in COLONES — and they are the same component with the same cells in the
   same order. THE ONLY DIFFERENCE IS THE ORDER OF THE ARRAY, and that is the
   design: a single merged "biggest gaps" list has to answer "biggest by what?",
   and every answer to that is an editorial claim a reader can contest. Two
   honest orderings of the same ten facts produce two quotable numbers instead of
   one arguable one.

   So EVERY ROW CARRIES BOTH FIGURES ON BOTH BOARDS. If the % board hid the
   colones, the reader would have to take our word that the two rankings differ;
   showing both lets them see for themselves that an 80% gap on a ₡155.390 stove
   and a ₡975.000 gap on an 8K television are both true and that neither is "the
   biggest". If a future change makes the boards show different cells, the point
   of having two of them is gone.

   NO CHAIN IS RANKED HERE, and there is no per-retailer aggregate anywhere on
   this page (§4.5). The `Flag` names the chain with the LOWEST price on one
   product, which is a fact about that product; a column that scored chains would
   be a different product with its own legal exposure, and it is not built.

   Server-rendered, no state, no handlers — `/brechas` is an answer-engine target
   first and a human page second, so nothing on it may be JS-gated. */

import Link from 'next/link';

import { bandAttrs } from '@/lib/catalog';
import { crc, pct } from '@/lib/format';
import { cardIdentity } from '@/lib/display';
import { categoryPath } from '@/lib/seo';
import type { Enriched } from '@/lib/types';
import { Flag } from './Flag';
import pg from './Page.module.css';
import p from './primitives.module.css';
import { ProductLink } from './ProductLink';
import s from './GapBoard.module.css';
import { Price, Thumb } from './ui';

/** The plate is 64px at ≥1024, 56 at 768–1023 and 112 at ≤767 — so the browser
 *  should choose the 160 derivative almost everywhere and the 320 one at DPR 2 on
 *  a phone. Declared here rather than at the call site: one row shape, one
 *  policy, same reasoning as `ProductCard`'s `SIZES`. */
const SIZES = '(max-width: 767px) 112px, (max-width: 1023px) 56px, 64px';

function GapRow({ product, rank, eager }: { product: Enriched; rank: number; eager: boolean }) {
  return (
    <li
      className={s.row}
      data-row
      data-scales="gap-row"
      data-band-min="296"
      data-band-max="1360"
    >
      <span className={s.rank}>{rank}</span>

      <span className={s.thumb}>
        <Thumb product={product} sizes={SIZES} eager={eager} />
      </span>

      <span className={s.who}>
        <ProductLink id={product.id} className={s.name}>
          {cardIdentity(product)}
        </ProductLink>
        {/* the category is a LINK, not a label: this row is also a route into the
            head-term page, and a leaderboard that dead-ends at ten products
            wastes the only inbound attention this page is built to earn */}
        <Link href={categoryPath(product.category)} className={s.cat}>
          {product.catLabel}
        </Link>
      </span>

      <span className={s.money}>
        {/* THE ROW CARRIES TWO COLÓN FIGURES AND NEITHER MAY BE READ AS THE OTHER
            (The designer Tier-2 §1). They shipped as two unlabelled spans, so a reader — or
            a screen reader, which said "…194.600 colones, brecha 80%, 155.390
            colones…" — could quote the GAP as the stove's PRICE. On the one page
            built to be quoted by a journalist that is a misquote we caused.

            THE PRICE TAKES THE HIDDEN LABEL AND THE GAP TAKES THE VISIBLE ONE, and
            that split is deliberate: `desde` is NOT free to use as a generic price
            label here — `variantNote()` reserves it for a folded colour-variant
            offer, where it means "this is a floor, not a price". Spending the word
            on every row would empty it of the one meaning it has. So the visible
            word goes on the figure that has none of its own, and the price is
            labelled for assistive tech only.

            `p.sr` (the existing visually-hidden primitive), NOT `aria-label`: ARIA
            1.2 prohibits `aria-label` on a generic `<span>`, browsers do not
            reliably expose it, and hidden text is announced everywhere, survives
            translation and does not replace the figure it introduces. Flagged in
            the build report as a deviation from the letter of the critique. */}
        <span className={p.sr}>Precio más bajo: </span>
        {/* through `Price`, never `crc()` directly: a folded colour-variant offer
            must print its "desde" prefix or the figure is a floor being shown as
            a price */}
        <Price offer={product.lo} className={s.p} />
      </span>

      <span className={s.gapCell}>
        {/* THE ROW'S ONE --loud OBJECT. The word travels with the number — a bare
            amber `80%` reads as a discount, and nobody can save 80%; they can pay
            the lower of two published prices. */}
        <span className={s.gap} {...bandAttrs(product)}>
          brecha {pct(product.gapPct, false)}
        </span>
        {/* the unit travels with the figure, in the figure's own type, so the
            number cannot be lifted out of the row and quoted as a price */}
        <span className={s.gapCrc}>
          {crc(product.gapCrc)}
          <span className={s.gapU}> de diferencia</span>
        </span>
      </span>

      <span className={s.chain}>
        <Flag product={product} />
      </span>
    </li>
  );
}

export function GapBoard({
  id, title, note, items,
}: {
  id: string;
  title: string;
  /** what the ordering IS, stated beside the heading — the same contract T1's
   *  rails keep ("Dónde hay más diferencia" over a rail sorted by gap). A ranking
   *  whose key is not named is an opinion presented as an arrangement. */
  note: string;
  items: Enriched[];
}) {
  return (
    <section className={pg.sec} aria-labelledby={id}>
      <div className={pg.secHead}>
        <h2 className={pg.secH} id={id}>
          {title}
        </h2>
        <p className={pg.secN}>{note}</p>
      </div>
      <ol className={s.rows}>
        {items.map((x, i) => (
          <GapRow key={x.id} product={x} rank={i + 1} eager={i < 4} />
        ))}
      </ol>
    </section>
  );
}

export { s as gapStyles };
