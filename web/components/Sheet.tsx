'use client';

/* THE OVERLAY FRAME — chrome only. The body is `Detail`, shared verbatim with
   the statically generated /producto/[slug] page (design §4.1: an overlay over
   a PRESERVED list, never a page navigation).

   This component is mounted by the intercepting route
   `app/@modal/(.)producto/[slug]`, so the URL in the address bar while the sheet
   is open is the product's real, canonical, indexable URL. There is no second
   URL for the same content and therefore no duplicate-content twin: a crawler
   or a cold hit on that URL gets the real page; a click from inside the app
   gets this. */

import { useEffect, useRef, useState } from 'react';

import { similarTo } from '@/lib/catalog';
import { useApp } from '@/lib/app-store';
import { productName, productPath } from '@/lib/seo';
import { Detail } from './Detail';
import { DetailActs } from './DetailActs';
import p from './primitives.module.css';
import s from './Sheet.module.css';
import { CloseIcon } from './ui';

/* How long the skeleton is allowed to be the whole answer.

   The catalogue is fetched once on mount and measured at ~30ms end to end on a
   warm connection (3.85MB download + parse + enrich, 2026-08-07), so eight
   seconds is not a performance budget — it is the point past which "still
   loading" has stopped being a true statement about anything. */
const STALL_MS = 8000;

export function Sheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { catalog, error } = useApp();
  const product = catalog?.byId.get(id) ?? null;
  const closeRef = useRef<HTMLButtonElement>(null);
  const [stalled, setStalled] = useState(false);

  /* THE MISSING THIRD STATE.

     This component had exactly two: `product` (render it) and everything else
     (render a skeleton). The store has carried an `error` since v1 and this
     file never read it — so a single rejected fetch inside `loadCatalog()` left
     the skeleton on screen FOREVER, with no message and no way out. Reported
     from production 2026-08-07 as "when I try to look at a product I just get
     this", against a screenshot of the placeholder.

     The original comment above the skeleton shows the assumption that was
     wrong: "a deep link that arrives before products.json does … the numbers
     land a moment later." It models LATE. It does not model NEVER.

     The escape hatch is the honest one and costs nothing: the same URL is a
     statically generated page that needs no client catalogue at all, so a plain
     link to it always works — including when the fetch that broke this overlay
     is still broken. */
  useEffect(() => {
    if (product) return;
    const t = setTimeout(() => setStalled(true), STALL_MS);
    return () => clearTimeout(t);
  }, [product, id]);

  const failed = Boolean(error) || stalled;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
  }, [id]);

  return (
    <>
      <button type="button" className={s.scrim} onClick={onClose} aria-label="Cerrar" />
      <aside
        className={s.sheet}
        role="dialog"
        aria-modal="true"
        /* the dialog must not keep announcing "loading" once it has given up —
           a screen reader would be told the opposite of what is on screen */
        aria-label={
          product
            ? productName(product)
            : failed
              ? 'No se pudo cargar la vista rápida'
              : 'Cargando el producto'
        }
      >
        <div className={s.head}>
          <button ref={closeRef} type="button" className={s.x} onClick={onClose} aria-label="Cerrar">
            <CloseIcon />
          </button>
          {product ? <DetailActs id={product.id} name={productName(product)} /> : null}
        </div>

        {/* A deep link that arrives before products.json does. Nothing is faked
            and nothing spins — the frame is real and the numbers land a moment
            later. The placeholder uses the SAME `.det` two-column geometry and the
            same `.stage` square as the loaded body, so nothing reflows. */}
        {product ? (
          /* THE SAME COMPONENT the statically generated page renders, with the same
             props computed the same way — including `similarTo()`, so the overlay
             and the page cannot rank similar products differently at one URL. */
          <div className={s.in}>
            <Detail
              product={product}
              nearest={catalog!.nearest}
              branches={catalog!.branches}
              similar={similarTo(product, catalog!.products)}
              fx={catalog!.meta.fx_rate_crc_usd}
              now={Date.parse(catalog!.meta.generated_at)}
              history={catalog!.history[product.id]}
              windowDays={catalog!.historyWindow?.distinct_days}
              axisMaxPct={catalog!.axisMaxPct}
              profile={catalog!.catMap.get(product.category)}
              frame="sheet"
            />
          </div>
        ) : failed ? (
          /* Says what happened, and hands over a control that cannot fail for
             the same reason. No retry button: the catalogue load is memoised
             for the life of the page, so "try again" would re-render the same
             rejected promise and lie twice. A navigation to the real page is
             the recovery. */
          <div className={s.in}>
            <div className={s.stall} role="alert">
              <p className={s.stallLead}>No pudimos cargar la vista rápida.</p>
              <p className={s.stallBody}>
                La ficha completa de este producto sí está disponible y se abre como
                página normal.
              </p>
              <a className={p.btn} href={productPath(id)}>
                Abrir la ficha completa
              </a>
            </div>
          </div>
        ) : (
          <div className={s.in}>
            <div className={s.det} aria-hidden="true">
              <div className={`${s.stage} ${p.skel}`} />
              <div>
                <div className={`${p.skel} ${p.skelLine}`} style={{ width: '32%' }} />
                <div className={`${p.skel}`} style={{ width: '70%', height: 32, marginTop: 16 }} />
                <div className={`${p.skel} ${p.skelLine}`} style={{ width: '40%', marginTop: 8 }} />
                <div className={p.skel} style={{ height: 260, marginTop: 32 }} />
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

