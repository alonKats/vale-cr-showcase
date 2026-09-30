'use client';

import { canMultiply } from '@/lib/blend';
import { useApp } from '@/lib/app-store';
import type { Enriched } from '@/lib/types';
import pg from './Page.module.css';
import { CatalogSkeleton } from './Skeleton';
import p from './primitives.module.css';

/* HONEST STATES, DESIGNED RATHER THAN ABSENT. None of these is an error screen:
   two of them are the app telling you something true about the catalogue, and the
   third is it telling you it still works without a network.

   THE SILHOUETTE (spec §3.5): a single product silhouette at 42% opacity,
   grayscaled, on a --plate square. This is the ONE place in the product where an
   image does only an atmospheric job, and it is the one place where that is
   correct, because the alternative is a blank rectangle. Same asset class, same
   blend guard, same plate — the picture is still a product we actually track.

   THE COPY IS COMPOSED FROM THE ARTIFACT (spec §2.8). The comp's empty state read
   a spelled-out chain count ("...cadenas hoy") and this file used to name one too.
   Both were written against a 3-chain snapshot and both are defects at 8. ANY string
   containing a spelled-out quantity is a defect BY CONSTRUCTION, because the count
   changes every export — which is why §2.8 gates it with a grep. */

/** The silhouette. Picks the first product in view whose photo passes the blend
 *  guard, so an empty state can never render the one mud rectangle in the set. */
function Silhouette({ from }: { from: Enriched[] }) {
  const pick = from.find((x) => x.image && canMultiply(x.image));
  if (!pick?.image) return null;
  return (
    <div className={pg.voidPlate}>
      {/* eslint-disable-next-line @next/next/no-img-element -- self-hosted pre-sized webp; see ui.tsx */}
      <img className={p.blend} src={pick.image} alt="" aria-hidden="true" loading="lazy" decoding="async" />
    </div>
  );
}

export function Offline({ stamp }: { stamp: string }) {
  return (
    <div className={pg.offline}>
      <span className={pg.offlineK}>Sin conexión</span>
      <span>
        Todo lo que ve salió de su teléfono, no de la red. Lo único que no podemos hacer ahora es
        volver a verificar los precios. {stamp}
      </span>
    </div>
  );
}

/* THE OFFLINE BANNER'S CLIENT ISLAND (v7.2 §1.2 / H1).

   `Offline` above is pure markup and renders perfectly well on the server; the only
   thing here that needs a browser is the answer to "is there a network right now",
   which is per-visitor, per-second state and cannot be baked into a static page. So
   the boundary is drawn around the QUESTION rather than around the page: this is the
   whole reason `HomeScreen` used to be a client component, and reducing it to five
   lines is what let that page become a server component.

   It lives in this file rather than in one of its own because `Offline` is already
   here and this module is already `'use client'` — a separate two-line module would
   add a file and pull in exactly the same graph. */
export function OfflineBanner({ stamp }: { stamp: string }) {
  const { online } = useApp();
  return online ? null : <Offline stamp={stamp} />;
}

/** THE STATE THAT WAS MISSING, AND ITS ABSENCE WAS A LIE RATHER THAN A GAP.
 *
 *  «Nada con "x"» is a CLAIM ABOUT THE CATALOGUE: we looked, and it is not
 *  there. The app used to print it whenever the result array was empty — which
 *  is also true for the first few hundred milliseconds, while the search index
 *  is still downloading and no lookup has happened at all. Same pixels, opposite
 *  meanings, and the wrong one is the confident one.
 *
 *  So a search with no answer YET gets its own state, and it asserts nothing
 *  about the catalogue. `aria-live="polite"` because a screen reader gets no
 *  spinner; the skeleton below it is the shared one, not a second loading
 *  vocabulary invented for this screen. */
export function Searching({ q }: { q: string }) {
  return (
    <>
      <p className={pg.searching} aria-live="polite">
        Buscando «{q}»…
      </p>
      <CatalogSkeleton />
    </>
  );
}

export function NoMatch({ q }: { q: string }) {
  const { setQ, query, setState, catalog } = useApp();
  return (
    <div className={pg.void}>
      <Silhouette from={catalog?.products ?? []} />
      <div>
        <h2 className={pg.emptyH}>Nada con «{q}».</h2>
        <p className={pg.emptyP}>
          Buscamos por marca, número de modelo y nombre en los {catalog?.counts.total ?? ''}{' '}
          productos que leímos. Si busca un modelo que ninguna de las{' '}
          {catalog ? catalog.meta.retailers.length : ''} cadenas publica, no lo vamos a tener.
        </p>
        <div className={pg.emptyActs}>
          <button type="button" className={`${p.btn} ${p.btnSolid}`} onClick={() => setQ('')}>
            Ver todo el catálogo
          </button>
          {query.state !== 'todos' ? (
            <button type="button" className={p.btn} onClick={() => setState('todos')}>
              Buscar también en los que no se pueden comparar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function NoneInFilter() {
  const { setState, setCategory, clearFacets, query, catalog } = useApp();
  const inCat = query.category
    ? (catalog?.products ?? []).filter((x) => x.category === query.category)
    : (catalog?.products ?? []);
  return (
    <div className={pg.void}>
      <Silhouette from={inCat} />
      <div>
        <h2 className={pg.emptyH}>Ningún producto cumple estos filtros.</h2>
        <p className={pg.emptyP}>
          Solo se pueden comparar los productos que aparecen en más de una cadena con el mismo número
          de modelo, y en algunas categorías eso deja muy pocos. No es un error de búsqueda: es lo
          que publican las cadenas hoy.
        </p>
        <div className={pg.emptyActs}>
          <button
            type="button"
            className={`${p.btn} ${p.btnSolid}`}
            onClick={() => {
              setState('todos');
              clearFacets();
            }}
          >
            Quitar los filtros
          </button>
          {query.category ? (
            <button type="button" className={p.btn} onClick={() => setCategory(null)}>
              Ver todas las categorías
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function LoadError({ message }: { message: string }) {
  return (
    <div className={`${pg.void} ${pg.voidNoPic}`}>
      <div>
        <h2 className={pg.emptyH}>No pudimos cargar el catálogo.</h2>
        <p className={pg.emptyP}>
          Preferimos decírselo a mostrarle precios viejos sin avisar. Detalle técnico: {message}.
        </p>
        <div className={pg.emptyActs}>
          <button
            type="button"
            className={`${p.btn} ${p.btnSolid}`}
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}
