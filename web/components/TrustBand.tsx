'use client';

import { useState } from 'react';

import type { BuildStats } from '@/lib/stats.server';
import { LUGAR } from '@/lib/display';
import { mil } from '@/lib/format';
import { ArrowRight } from './Mark';
import { EEUU } from './ui';
import s from './TrustBand.module.css';

/* The second number is the important one and it is the product's own limitation
   said out loud: only N of 2.170 can be compared at all. A price-comparison app
   that leads with its own coverage gap buys trust cheaply, and pre-empts the
   obvious complaint before the user finds it.

   THE FOURTH READING IS A DISTRIBUTION, NOT A TIMESTAMP (spec §9-10). Both comp
   generations print "5:01 p. m. — último precio verificado, hoy", taken from
   meta.generated_at, which is when the EXPORT ran. The comps regressed to it
   because they reuse the v2 comp generator, not because anyone re-decided it. A
   single "verified today" stamp over a distribution with a ten-hour tail is
   exactly the overclaim this product exists to avoid, so `freshHeadN` /
   `freshHeadT` stay.

   EVERY COUNT AND EVERY CHAIN NAME IS COMPOSED (spec §2.8). This is the one place
   the full chain list belongs — the hero states scope as a count instead. */

/** The one place chain names become a sentence. `stats.retailers` is already
 *  flattened through `retailerNames()` at the build-stats boundary, so nothing
 *  here can `.join()` an object array and print "[object Object]". */
const chainList = (names: string[]) => names.join(', ').replace(/, ([^,]*)$/, ' y $1');

/* THE FRESHNESS DISTRIBUTION, AS A PROPORTIONAL BAR — the fourth reading's own
   instrument, and one of exactly four places amber appears in the whole product.

   Three segments off `meta.price_freshness`: under 24 h, 24–48 h, over 48 h. AMBER
   MARKS THE PART OF OUR OWN CLAIM THAT IS WEAKEST, which is the only honest thing a
   loud colour can do on a trust band. Today over_24h and over_48h are both 0, so the
   bar renders entirely calm — that is a true rendering of a good day, not a hidden
   state, and the number beside it says the same thing in words.

   `data-scales` + `data-pct` are the §2.4 gate hooks: measure.mjs walks the segments
   and asserts their widths SUM TO THE TRACK (±1px) and match `data-pct`. It compares
   the pixels to the DATA, never to a second rendering — a bar drawn correctly from
   the wrong number is still a false claim, and two derived artifacts agreeing proves
   nothing. Redundantly encoded, so it is aria-hidden: a screen reader already got the
   sentence. */
function FreshBar({ dist }: { dist: BuildStats['freshDist'] }) {
  if (!dist || !dist.offers) return null;
  const over48 = dist.over48;
  const between = Math.max(0, dist.over24 - dist.over48);
  const fresh = Math.max(0, dist.offers - dist.over24);
  const pctOf = (n: number) => (n / dist.offers) * 100;
  const segs = [
    { key: 'fresh', n: fresh, cls: s.segFresh },
    { key: 'day', n: between, cls: s.segDay },
    { key: 'stale', n: over48, cls: s.segStale },
  ].filter((x) => x.n > 0);

  return (
    <span
      className={s.track}
      aria-hidden="true"
      data-scales="freshness-distribution"
      data-track="1"
    >
      {segs.map((x) => (
        <span
          key={x.key}
          className={x.cls}
          style={{ width: `${pctOf(x.n)}%` }}
          data-pct={pctOf(x.n).toFixed(2)}
        />
      ))}
    </span>
  );
}

export function TrustBand({ stats }: { stats: BuildStats }) {
  const [open, setOpen] = useState(false);
  const chains = chainList(stats.retailers);

  return (
    <section className={s.trust} aria-label="Cómo se hizo esta comparación" id="como-comparamos">
      <div className={s.in}>
        {/* Every count goes through `mil()`. These sit on the same page as
            ₡1.699.900, and printing "2170" beside it is the formatter simply not
            being applied — not a decision anyone made. */}
        <div className={s.i}>
          <span className={s.n}>{mil(stats.total)}</span>
          <span className={s.t}>
            productos leídos en {chains}, en {stats.cats.length} categorías
          </span>
        </div>
        {/* v4 §4.4: STATE THE SCARCITY AS A FACT, with both numbers in the sentence.
            257 of 2.170 is the product's biggest weakness, and naming it here turns it
            into the transparency differentiator against zap — whose Terms of Use say
            their ranking is at their sole discretion — instead of something a user
            discovers alone and distrusts us for. */}
        <div className={s.i}>
          <span className={s.n}>{mil(stats.comparable)}</span>
          <span className={s.t}>
            de {mil(stats.total)} productos se venden en más de una cadena — solo esos se pueden
            comparar por número de modelo
          </span>
        </div>
        <div className={s.i}>
          <span className={s.n}>{mil(stats.gap)}</span>
          <span className={s.t}>tienen una brecha real: una cadena cobra 5% o más</span>
        </div>
        <div className={s.i}>
          <span className={s.n}>{stats.freshHeadN}</span>
          <span className={s.t}>{stats.freshHeadT}</span>
          <FreshBar dist={stats.freshDist} />
          <button
            type="button"
            className={s.how}
            aria-expanded={open}
            aria-controls="metodo"
            onClick={() => setOpen((v) => !v)}
          >
            <ArrowRight size={16} className={s.howMk} />
            Cómo comparamos
          </button>
        </div>

        {open ? (
          <p className={s.method} id="metodo">
            Leemos el precio de contado publicado en los sitios de {chains} y emparejamos productos
            por <b>número de modelo</b>. Si dos cadenas no publican el mismo número, no las
            comparamos: por eso {mil(stats.solo)} de {mil(stats.total)} productos aparecen sin
            comparación. Los
            precios ticos llevan el 13% de IVA incluido. La referencia de <EEUU /> se calcula sin
            impuesto de venta y contra el precio tico más bajo sin IVA, y siempre es sobre{' '}
            <b>modelos similares</b>, no sobre esta misma unidad. La existencia es por cadena:{' '}
            <b>ninguna cadena publica inventario por sucursal</b>, así que nunca le decimos que una
            tienda específica tenga la unidad. La ubicación es un supuesto: {LUGAR}. Antes de
            publicar volvemos a leer el precio de los {mil(stats.featuredChecked)} productos que
            iban a salir destacados
            {/* the same branch as Featured's note, for the same reason: with
                `dropped_count` at 0 the unconditional clause explained why we
                discarded the products we did not discard. */}
            {stats.featuredDropped > 0 ? (
              <>
                {' '}y descartamos <b>{mil(stats.featuredDropped)}</b> porque el precio ya les había
                cambiado — preferimos un espacio vacío antes que una recomendación vieja.
              </>
            ) : (
              <>
                ; hoy <b>ninguno</b> había cambiado de precio. Cuando uno cambia lo quitamos:
                preferimos un espacio vacío antes que una recomendación vieja.
              </>
            )}{' '}
            Sobre la antigüedad de los precios: {stats.freshLong}
            {stats.freshBasis ? ` La antigüedad se mide así: ${stats.freshBasis}.` : ''}
          </p>
        ) : null}
      </div>
    </section>
  );
}
