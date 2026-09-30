/* T3'S PRIMARY REGION (§4.5-2). One row per chain — max 8, typically 2–3.

   zap's version is 32 rows deep and carries, per row: a chain logo, a store rating,
   two review links, a long description, shipping and delivery ticks and a
   `zapstore` buy button. EVERY ONE OF THOSE IS DELETED (The researcher §B/§C/§H/§I) and each
   deletion is a fabrication avoided rather than a feature dropped:

     store ratings + review counts  no ratings exist for any of our 8 chains
     shipping cost, delivery days   no feed
     per-branch stock               spec-v2 §7 forbids the claim outright
     `zap choice` (lavender ribbon)  a badge that looks earned but isn't is a trust
                                     liability in CR's consumer-protection climate
     sponsored rows, checkout,      no ad relationship, no marketplace
     buyer protection, 12 cuotas

   What each row DOES carry is the audit: the chain, THE CHAIN'S OWN PRODUCT TITLE
   (they differ, and showing the difference is what makes the comparison checkable),
   the SKU, the price, and the delta against the cheapest.

   THE `parejo` STATE LIVES HERE, and it is the rule that travelled from the deleted
   `Quiet` component: NOTHING IN A NEAR-TIE IS MARKED CHEAPEST. `Flag` enforces it
   itself so no caller can forget, and the delta column says `+₡0` honestly instead
   of dressing a ₡15 difference as a win.

   THE `filters` REGION IS NOT BUILT. §T3 keeps one of zap's three chips,
   `Cerca de mí`. Two things block it: it needs browser geolocation on consent,
   which has no design yet, and most chains are not geocoded (one publishes no
   branch directory at all). A chip that cannot filter is worse
   than no chip — and a 2–3 row table with a filter bar above it is precisely the
   sparse-instrument failure mode §5.3 names. THE NEAREST BRANCH IS ALREADY NAMED
   PER ROW, which is the honest version of the same information and costs nothing. */

import { crc, variantNote } from '@/lib/format';
import type { Enriched, NearestBranch } from '@/lib/types';
import { Flag } from './Flag';
import { Freshness } from './Freshness';
import p from './primitives.module.css';
import s from './OfferTable.module.css';
import { Pin, Price } from './ui';

export function OfferTable({
  product, nearest, now,
}: {
  product: Enriched;
  nearest: Map<string, NearestBranch>;
  /** Date.parse(meta.generated_at) — the ARTIFACT's export time, never the wall
   *  clock. A prerendered page must not freeze a wall-clock claim and keep
   *  asserting it, and the overlay must not disagree with the page it shares a
   *  URL with. */
  now: number;
}) {
  const { sorted, lo } = product;

  return (
    <div className={s.wrap}>
      <ul className={s.rows} data-offerlist>
        {sorted.map((o, i) => {
          const cheapest = i === 0;
          const delta = o.price_crc - lo.price_crc;
          const near = nearest.get(o.retailer);
          const v = variantNote(o);
          return (
            <li className={s.row} key={o.retailer} data-row>
              <div className={s.chain}>
                <span className={s.chainN}>{o.retailer}</span>
                {cheapest ? <Flag product={product} className={s.rowFlag} short /> : null}
              </div>

              {/* The chain's OWN title for this SKU. They differ between chains and
                  the difference is the audit — a reader checking whether we matched
                  the same product needs to see what each chain called it. 2 lines
                  max, gated by data-scales because this is the `1fr` column. */}
              <div className={s.who} data-scales="offer-title" data-band-min="80">
                <p className={s.title}>{product.cardT}</p>
                <p className={s.sku}>
                  {product.hasModel ? product.modelD : 'Modelo no publicado'}
                  {v.text ? <span className={s.variants}> · {v.text}</span> : null}
                </p>
                <p className={s.stamp}>
                  {near ? (
                    <>
                      <Pin size={12} className={s.pin} />
                      <span className={s.place}>{near.name}</span>
                    </>
                  ) : null}
                  <Freshness iso={o.scraped_at} now={now} className={s.fresh} />
                </p>
              </div>

              <div className={s.money}>
                {/* every colón figure goes through Price, so a folded
                    colour-variant offer can never be printed as if its cheapest
                    variant were the only price */}
                <Price offer={o} className={s.p} />
                <span className={cheapest ? s.deltaBase : s.delta}>
                  {cheapest ? 'El más bajo' : `+${crc(delta)}`}
                </span>
                {/* NO CUOTAS LINE. "12 instalments" is on the researcher's deleted list for T3
                    (§T3, deleted-as-a-block) and it is also the string that used to
                    put a `·` at a rendered line boundary inside a 140px column. Two
                    reasons, either sufficient. */}
              </div>

              {/* THIS REVERSES A v4 RULE, AND THE REVERSAL IS v4.1-FIX B6. The old
                  note here read "NEVER btnSolid down here — the plate above holds the
                  page's one filled object". Measured consequence: on the page whose
                  entire job is "WHICH CHAIN", the three chain buttons were the QUIETEST
                  control class in the system (36px outline) while four `Ver detalle`
                  cards below them were 40px solid dark. The instrument's own actions
                  were the faintest thing in it, and `outline` meant both "compare these
                  products" and "go buy at Monge".

                  EVERY OUTBOUND CLICK NOW WEARS THE SAME 40px FILLED RECIPE, without
                  exception — plate and row alike. The plate keeps its primacy the way a
                  plate should: position, a 44px price and a dark surface, not by
                  keeping the money button quiet. §5.4's `152px 1fr 160px 176px` absorbs
                  the extra 4px of height without a column change. */}
              <a
                className={`${p.btn} ${p.btnSolid} ${s.act}`}
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver en {o.retailer}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
