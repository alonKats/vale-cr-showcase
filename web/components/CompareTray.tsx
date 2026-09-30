'use client';

import { useEffect, useState } from 'react';

import { TRAY_MAX, useApp } from '@/lib/app-store';
import { nearText } from '@/lib/display';
import { crc, dec, mil, pct, savings, variantNote } from '@/lib/format';
import type { Enriched } from '@/lib/types';
import s from './CompareTray.module.css';
import p from './primitives.module.css';
import { CloseIcon, EEUU, Price, Thumb } from './ui';

export function CompareTray() {
  const { catalog, tray, toggleTray, clearTray } = useApp();
  const [open, setOpen] = useState(false);

  const items = (catalog ? tray.map((id) => catalog.byId.get(id)) : []).filter(
    (x): x is Enriched => Boolean(x),
  );

  useEffect(() => {
    if (!items.length) setOpen(false);
  }, [items.length]);

  if (!items.length) return null;

  return (
    <>
      {/* the dock is fixed, so the document needs the height back or it hides
          the footer at 390 */}
      <div className={s.spacer} aria-hidden="true" />
      <div className={s.dock}>
        <div className={s.dockIn}>
          <span className={s.label}>
            Comparando {items.length} de {TRAY_MAX}
          </span>
          <div className={s.pins}>
            {items.map((x) => (
              <span className={s.pin} key={x.id}>
                <span className={s.pinPic}>
                  <Thumb product={x} sizes="28px" />
                </span>
                <span className={s.pinName}>{x.hasModel ? x.modelD : x.brandD}</span>
                <button
                  type="button"
                  className={s.pinX}
                  onClick={() => toggleTray(x.id)}
                  aria-label={`Quitar ${x.brandD} ${x.modelD} de la comparación`}
                >
                  <CloseIcon />
                </button>
              </span>
            ))}
          </div>
          <div className={s.acts}>
            <button type="button" className={p.btn} onClick={clearTray}>
              Vaciar
            </button>
            <button type="button" className={`${p.btn} ${p.btnSolid}`} onClick={() => setOpen(true)}>
              Ver lado a lado
            </button>
          </div>
        </div>
      </div>

      {open ? <Panel items={items} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Panel({ items, onClose }: { items: Enriched[]; onClose: () => void }) {
  const { catalog } = useApp();
  return (
    <aside className={s.panel} role="dialog" aria-modal="true" aria-label="Comparación lado a lado">
      <div className={s.head}>
        <h2 className={s.h}>Lado a lado</h2>
        <button type="button" className={s.x} onClick={onClose} aria-label="Cerrar">
          <CloseIcon />
        </button>
      </div>
      <div
        className={s.grid}
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((x) => {
          const near = catalog ? nearText(x.lo.retailer, catalog.nearest) : { line: null, missing: null };
          const branch = catalog?.nearest.get(x.lo.retailer);
          return (
            <div className={s.col} key={x.id}>
              <div className={s.pic}>
                <Thumb product={x} sizes="240px" />
              </div>
              <div className={s.brand}>
                {x.brandD} <span className={s.spec}>{x.specFull}</span>
              </div>
              <span className={s.model}>{x.modelD}</span>

              <span className={s.k}>Precio más bajo</span>
              <Price offer={x.lo} className={s.money} />
              <span className={s.v}>
                en {x.lo.retailer}
                {variantNote(x.lo).text ? ` · ${variantNote(x.lo).text}` : ''}
              </span>

              <span className={s.k}>Brecha entre cadenas</span>
              {x.band === 'brecha' ? (
                <>
                  <span className={s.money}>{crc(x.gapCrc)}</span>
                  <span className={s.v}>
                    {savings(x).chain} contra {x.hi.retailer} · {pct(x.gapPct)}
                  </span>
                </>
              ) : x.band === 'parejo' ? (
                <span className={s.v}>
                  Las {x.nChains} cadenas cobran lo mismo — {crc(x.gapCrc)} de diferencia. Aquí no
                  hay nada que ahorrar.
                </span>
              ) : (
                <span className={s.v}>Solo en {x.lo.retailer} — no hay con qué comparar.</span>
              )}

              <span className={s.k}>Dónde recogerla</span>
              {near.line && branch ? (
                <span className={s.v}>
                  <span className={s.near}>{near.line}</span>. La existencia es por cadena — ninguna
                  publica inventario por sucursal ({dec(branch.km)} km).
                </span>
              ) : (
                <span className={s.v}>{near.missing}</span>
              )}

              <span className={s.k}>Reseñas</span>
              <span className={s.v}>
                Costa Rica:{' '}
                {x.reviews.cr
                  ? `${dec(x.reviews.cr.average)} / 5 de ${mil(x.reviews.cr.count)} ${
                    x.reviews.cr.count === 1 ? 'reseña' : 'reseñas'}`
                  : 'sin reseñas publicadas'}
              </span>
              <span className={s.v}>
                <EEUU />:{' '}
                {x.reviews.us
                  ? `${dec(x.reviews.us.average)} / 5 de ${mil(
                    x.reviews.us.count,
                  )} reseñas — sobre "${x.reviews.us.us_title}", que es un modelo similar y no esta unidad`
                  : 'sin modelo similar con reseñas'}
              </span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
