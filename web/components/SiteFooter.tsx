/* THE FOOTER — v8. Figma 6:403 (home) · 17:292 (product) · 18:381 (category).

   ---- WHY THE COLUMN HEADINGS ARE THE PRODUCT PAGE'S AND NOT THE HOME PAGE'S -
   The three frames disagree. 6:403 groups links under hand-written taxonomy
   headings — `Electrodomésticos` (Lavadoras, Secadoras, Cocinas, Hornos, Aires
   acondicionados), `Tecnología`, `Audio y Video`. 17:292 and 18:381 instead use
   `Categorías` · `Tiendas Populares` · `Compañía`.

   The second shape wins, 2 frames to 1, and it would win at 1–2 as well: the
   home page's version is a SECOND category taxonomy, maintained by hand, that
   the engine does not know about. It has fourteen categories; that footer sorts
   eleven of them into three invented buckets. The day the engine adds a
   category, the hand-grouped footer silently omits it and nothing fails. This
   is the same rule the chrome's six nav items follow: a rule, not a curated
   list, so which items appear is a fact about the catalogue.

   So the columns are: the categories the engine has, the chains it actually
   reads (meta.retailers — real names, real coverage), and the company pages
   that really exist.

   ---- WHAT THE FIGMA DRAWS THAT THIS DOES NOT RENDER --------------------
   The social row — Facebook, Instagram, Twitter, bottom-right of 6:403. Vale
   has no accounts on any of the three; there is no `sameAs` in the
   organisation JSON-LD to point them at, because there is nothing to point to.
   Three icons linking to `#`, or worse to a platform's home page, is furniture
   that looks like a brand presence. The glyphs are in the icon set and the slot
   is designed, so the row is ten lines away the day the accounts exist.

   ---- WHAT THE FIGMA DOES NOT DRAW AND THIS MUST CARRY --------------------
   Ley 8968 requires the analytics consent decision to stay WITHDRAWABLE, so
   `ConsentReopen` is not optional furniture — it is the mechanism. And the four
   standing disclosures (freshness, the FX basis, the assumed location, and that
   this site sells nothing and takes no commission) are the honesty surface the
   whole product is built around. Both go below the divider so the design's
   column structure survives intact rather than absorbing them. */

import Link from 'next/link';

import { ConsentReopen } from './Consent';
import { categoryPath } from '@/lib/seo';
import { LUGAR } from '@/lib/display';
import type { Category, RetailerRef } from '@/lib/types';
import s from './SiteFooter.module.css';
import { Wordmark } from './Wordmark';

/* How many of each list the footer carries. The catalogue has fourteen
   categories and eight chains; a footer that prints all twenty-two is a sitemap,
   and /categorias already is one. Both lists are ranked, so the truncation is by
   size rather than by alphabet — see the chrome for the same reasoning. */
const CATS_SHOWN = 8;
const CHAINS_SHOWN = 6;

export function SiteFooter({
  cats, retailers, freshLong, fx,
}: {
  cats: Category[];
  retailers: RetailerRef[];
  /** meta.price_freshness, composed — never meta.generated_at */
  freshLong: string;
  fx: string;
}) {
  const topCats = cats.slice(0, CATS_SHOWN);
  const topChains = [...retailers]
    .sort((a, b) => b.products - a.products)
    .slice(0, CHAINS_SHOWN);

  return (
    <footer className={s.foot}>
      <div className={s.in}>
        <div className={s.cols}>
          <div className={s.brand}>
            <Wordmark size={24} tone="dark" />
            <p className={s.blurb}>
              El comparador de precios de tecnología y electrodomésticos de Costa
              Rica. Comparamos por número de modelo exacto, con IVA incluido, para
              que sepas dónde se compra y a cómo.
            </p>
          </div>

          {/* THREE DISTINCT LANDMARK NAMES. The chrome's tier-2 nav is
              "Categorías y brechas" and the home rail is "Explorar por
              categoría"; several landmarks sharing one name is a landmark list
              that is no use as a landmark list. */}
          <nav className={s.col} aria-label="Categorías en el pie de página">
            <h2 className={s.head}>Categorías</h2>
            {topCats.map((c) => (
              <Link key={c.id} href={categoryPath(c.id)}>
                {c.label}
              </Link>
            ))}
          </nav>

          <nav className={s.col} aria-label="Tiendas en el pie de página">
            <h2 className={s.head}>Tiendas</h2>
            {/* /comercios is the one page that talks about the chains, so every
                chain name points there rather than at eight pages that do not
                exist. A name that links nowhere would be the social-row mistake
                in a different column. */}
            {topChains.map((r) => (
              <Link key={r.name} href="/comercios">
                {r.name}
              </Link>
            ))}
          </nav>

          <nav className={s.col} aria-label="Sobre Vale">
            <h2 className={s.head}>Compañía</h2>
            <Link href="/marcas">Marcas</Link>
            <Link href="/acerca">Acerca de vale.cr</Link>
            <Link href="/metodologia">Cómo comparamos</Link>
            <Link href="/comercios">Agregar tu tienda</Link>
            <Link href="/contacto">Contacto</Link>
          </nav>
        </div>

        <hr className={s.rule} />

        <nav className={s.legal} aria-label="Información legal">
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/terminos">Términos</Link>
          {/* a <button>, not a link: withdrawal reopens the same gate rather
              than navigating to a settings page, because the choice is one
              boolean and it lives in one object. */}
          <ConsentReopen />
        </nav>

        {/* Four facts, and NO APP BADGES: the reference site carries App Store
            and Play badges because their mobile answer is a native app. There is
            no app here, so there is no badge. */}
        <div className={s.facts}>
          <span>{freshLong}</span>
          <span>{fx}</span>
          <span>Ubicación asumida: {LUGAR}</span>
          <span>Este sitio no vende productos ni cobra comisión.</span>
        </div>

        <div className={s.bottom}>
          <span>
            © {new Date().getFullYear()} vale.cr. Todos los derechos reservados.
            San José, Costa Rica.
          </span>
          <span>
            Precios de referencia. Las especificaciones pueden variar según la
            cadena.
          </span>
        </div>
      </div>
    </footer>
  );
}
