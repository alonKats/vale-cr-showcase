/* ONE place composes every freshness sentence in the app.

   The bug this file exists to kill: the top bar said "737 modelos · verificados
   hoy, 5:01 p. m." — a time taken from `meta.generated_at`, which is when the
   EXPORT ran, not when the prices were read. 121 of 791 offers in that same
   artifact were over 24 h old. The claim was false for 16% of the catalogue.

   `meta.price_freshness` publishes the whole distribution (newest / median /
   oldest / over-24h / over-48h). Every string below is composed from it, so the
   app can only say something the artifact can prove. If the field is missing —
   the engine owns the artifact and an older export may not carry it — the copy
   degrades to the export time, labelled as the export time. */

import { dec, fecha, mil } from './format';
import type { Meta } from './types';

export interface FreshnessCopy {
  /** top bar, after the model count — must fit one line at 390 */
  short: string;
  /** trust band, the fourth reading: a figure and the sentence under it */
  headN: string;
  headT: string;
  /** footer / offline band / product page stamp — the full statement */
  long: string;
  /** the artifact's own description of how the ages were measured */
  basis: string;
}

const h = (n: number) => `${dec(n)} h`;

export function freshnessCopy(meta: Meta): FreshnessCopy {
  const f = meta.price_freshness;
  // `fecha()` ends in "p. m." — every sentence that closes on it would
  // otherwise print "9:21 p. m..".
  const exported = fecha(meta.generated_at).replace(/\.$/, '');

  if (!f) {
    return {
      short: 'catálogo exportado hoy',
      headN: 'hoy',
      headT: `se exportó este catálogo (${exported}). Esta versión del archivo no publica la antigüedad de cada precio, así que no le decimos que estén todos verificados hoy.`,
      long: `Catálogo exportado: ${exported}. Sin dato de antigüedad por precio.`,
      basis: '',
    };
  }

  // The oldest price is the only number that can carry a "todos" claim, and it
  // rounds UP: rounding 25,04 h down to 25 would shave the claim in our favour.
  const techo = Math.ceil(f.oldest_age_h);
  /* Every count through `mil()` — these sentences sit next to ₡1.699.900 and a
     bare "2515" beside it is the formatter simply not being applied.

     AND THE ZERO CASE GETS ITS OWN CLAUSE. With `over_24h` at 0 this printed
     "0 tienen más de 24 h y ninguno más de 48 h" — a numeral zero and the word
     for it, for the same idea, in one sentence. Same class as the featured
     slot's "descartamos 0": a composed sentence with a branch it never took. */
  const viejos = f.over_24h === 0
    ? 'ninguno tiene más de 24 h'
    : f.over_48h > 0
      ? `${mil(f.over_24h)} tienen más de 24 h y ${mil(f.over_48h)} más de 48 h`
      : `${mil(f.over_24h)} tienen más de 24 h y ninguno más de 48 h`;

  return {
    /* NO COUNT. This was `4.598 precios, ninguno con más
       de 2 h` — a freshness guarantee wrapped around an inventory boast. "No
       professional website says look at us, we have so many products."
       The GUARANTEE is the trust signal and it survives; the 4.598 was the brag
       and it goes. `techo` stays derived from the distribution, never typed. */
    short: `Precios actualizados hoy · ninguno con más de ${techo} h`,
    headN: h(f.median_age_h),
    headT: `es la antigüedad mediana de los ${mil(f.offers)} precios — ${viejos}`,
    /* The two separators are NBSP-glued on both sides, so neither can end or
       start a rendered line. This sentence is the widest thing in the footer and
       the footer is a four-column grid — measured at 1440 it wrapped with a
       trailing `·` hanging off line 1, which is the ledger's defect verbatim. */
    long: `${mil(f.offers)} precios leídos entre hace ${h(f.newest_age_h)} y ${h(
      f.oldest_age_h,
    )} · mediana ${h(f.median_age_h)} · ${viejos}. Catálogo exportado: ${exported}.`,
    basis: f.basis,
  };
}
