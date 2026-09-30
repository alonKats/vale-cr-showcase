/* THE PRODUCT CARDS — v8. Three variants; see ProductCard.module.css for why
   they are three components and not one with a skin prop.

     ProductCard  18:144  the category / search / refine grid
     RailCard     6:123   the home page's category rails
     MiniCard     17:247  "Modelos parecidos" on the product page

   ---- WHAT EVERY VARIANT REFUSES TO SAY -----------------------------------
   The reference site's card additionally carries a store rating, a review
   count, a free-shipping tick, a delivery-day tick and a buy button. All five
   stay deleted: there are no store ratings for any of our chains, no shipping
   feed, and no checkout. The redesign makes these cards LOUDER — bigger type, a
   filled badge, a photo well — without making them CLAIM more, and that
   distinction is the load-bearing one. "More like the reference" is exactly the
   pressure that reintroduces what was rejected, so the list is written down
   rather than merely intended.

   ---- THE HEART IS NOT BUILT -------------------------------------------
   18:149 floats a 28px favourite button over the photo of every grid card.
   There is no favourites store in this product — no auth, no session, no
   server-side per-visitor state — so the control would toggle nothing that
   survives a reload. It is omitted for the same reason `Ingresar` is omitted
   from the chrome, and the slot it would occupy is still laid out (`.over` is a
   space-between row), so building it later moves nothing else.

   ---- THE TWO GUARDS ON THE BADGE, INHERITED AND NOT RELAXED --------------
   A "MÁS BARATO EN <chain>" claim is only true when there is something to be
   cheaper THAN, and only meaningful when the chains actually disagree. So it is
   suppressed on a single-chain product (`nChains <= 1`) and on a `parejo` one
   (prices level within the band). Both guards were `Flag`'s; `Flag` is gone as
   a component because the redesign draws the badge three different ways, so the
   guards move here — into `cheapestIn()` — rather than being re-implemented per
   variant, which is how one of three copies drifts. */

import { cardIdentity } from '@/lib/display';
import { crc, pct } from '@/lib/format';
import type { Enriched } from '@/lib/types';
import { Icon } from './Icon';
import { ProductLink } from './ProductLink';
import s from './ProductCard.module.css';
import { Thumb } from './ui';

const SIZES = '(min-width: 1024px) 266px, (min-width: 640px) 220px, 45vw';

/** The chain to name in the badge, or null when naming one would be a claim the
 *  data does not support. THE ONLY PLACE THAT DECISION IS MADE. */
function cheapestIn(p: Enriched): string | null {
  if (p.nChains <= 1) return null;
  if (p.band === 'parejo') return null;
  return p.lo.retailer;
}

/* =========================================================================
   ProductCard · 18:144 — the grid
   ========================================================================= */

export function ProductCard({
  product, eager = false,
}: {
  product: Enriched;
  eager?: boolean;
}) {
  const win = cheapestIn(product);
  /* THE ROWS INCLUDE THE WINNER AND START WITH IT. 18:162 lists `Unimart
     ₡254.700` first and that figure IS the headline price, so this variant's
     list is "the cheapest chains, in order" rather than the home card's "who
     else sells it". Two is the drawn count; the rest are summarised. */
  const ROWS = 2;
  const rows = product.sorted.slice(0, ROWS);
  const extra = product.nChains - rows.length;

  return (
    <li className={`${s.card} ${s.grid}`}>
      <div className={s.gridMedia}>
        <Thumb product={product} sizes={SIZES} eager={eager} />
        <div className={s.over}>
          {/* the savings chip, and it is a PERCENTAGE because the home rails are
              ranked by percentage — a card that says "Ahorrá ₡40.000" beside a
              rail ordered by ratio invites the reader to compare two different
              quantities. Suppressed entirely when there is no real gap. */}
          {win && product.gapPct > 0 ? (
            <span className={s.gap}>Ahorrá {pct(product.gapPct, false)}</span>
          ) : (
            <span />
          )}
          {/* the favourite button belongs here — see the file header */}
        </div>
      </div>

      <div className={s.body}>
        <div>
          <h3 className={s.title}>
            <ProductLink id={product.id} className={s.hit}>
              {cardIdentity(product)}
            </ProductLink>
          </h3>
          {product.hasModel ? <p className={s.model}>{product.modelD}</p> : null}
        </div>

        <div>
          <p className={s.eyebrow}>Mejor precio de contado</p>
          <span className={s.price}>{crc(product.lo.price_crc)}</span>
        </div>

        <hr className={s.rule} />

        <ul className={s.rows}>
          {rows.map((o) => (
            <li key={o.retailer} className={s.row}>
              <span className={s.chain}>
                <span className={s.dot} aria-hidden="true" />
                {o.retailer}
              </span>
              <span className={s.rowPrice}>{crc(o.price_crc)}</span>
            </li>
          ))}
        </ul>
        {extra > 0 ? (
          <p className={s.more}>
            +{extra} {extra === 1 ? 'tienda más' : 'tiendas más'} · hasta{' '}
            {crc(product.hi.price_crc)}
          </p>
        ) : null}

        <span className={s.ctaOutline}>Ver detalle</span>
      </div>
    </li>
  );
}

/* =========================================================================
   RailCard · 6:123 — the home page
   ========================================================================= */

export function RailCard({
  product, eager = false,
}: {
  product: Enriched;
  eager?: boolean;
}) {
  const win = cheapestIn(product);
  /* THE ROWS ARE THE RIVALS — the winner is NOT among them. 6:123's badge names
     Monge and Monge does not appear in the three rows below it; the list is
     "who else sells this, and for how much". `sorted` is price-ascending and
     `lo` is `sorted[0]`, so the rivals are simply everything after the winner.

     THREE IS THE DRAWN COUNT and it is also the point at which a shopper has
     decided. The rest are not hidden — `hi` is on the product page, one click
     away, and the grid card summarises the range. */
  const RIVALS = 3;
  const rivals = product.sorted.slice(1, 1 + RIVALS);

  return (
    <li className={`${s.card} ${s.rail}`}>
      {win ? (
        <span className={s.badge}>
          <Icon name="arrow-down" size={12} />
          Más barato en {win}
        </span>
      ) : null}

      <span className={s.media}>
        <Thumb product={product} sizes={SIZES} eager={eager} />
      </span>

      <div>
        <p className={s.brand}>{product.brandD}</p>
        <h3 className={s.title}>
          <ProductLink id={product.id} className={s.hit}>
            {cardIdentity(product)}
          </ProductLink>
        </h3>
      </div>

      <div>
        <p className={s.eyebrow}>Mejor precio</p>
        <span className={s.price}>{crc(product.lo.price_crc)}</span>
      </div>

      {rivals.length ? (
        <>
          <hr className={s.rule} />
          <ul className={s.rows}>
            {rivals.map((o, i) => (
              <li
                key={o.retailer}
                /* the FIRST rival is the next-cheapest, and it is marked by
                   WEIGHT only — never green. See the module: green on a rival
                   is green on a strictly worse price. */
                className={`${s.row} ${i === 0 ? s.best : ''}`}
              >
                <span className={s.chain}>
                  <span className={s.dot} aria-hidden="true" />
                  {o.retailer}
                </span>
                <span className={s.rowPrice}>{crc(o.price_crc)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <hr className={s.rule} />
      <span className={s.cta}>Ver detalle</span>
    </li>
  );
}

/* =========================================================================
   MiniCard · 17:247 — "Modelos parecidos"
   ========================================================================= */

export function MiniCard({ product }: { product: Enriched }) {
  const win = cheapestIn(product);
  return (
    <li className={`${s.card} ${s.mini}`}>
      <span className={s.media}>
        <Thumb product={product} sizes="(min-width: 1024px) 262px, 45vw" />
      </span>
      {/* the caption is amber in 17:250 — --loud-ink, since amber as text on a
          white card is a banned pair. Rendered only when the claim holds. */}
      {win ? <p className={s.cap}>Más barato en {win}</p> : null}
      <h3 className={s.title}>
        <ProductLink id={product.id} className={s.hit}>
          {cardIdentity(product)}
        </ProductLink>
      </h3>
      <span className={s.price}>{crc(product.lo.price_crc)}</span>
      <span className={s.ctaOutline}>Ver detalle</span>
    </li>
  );
}
