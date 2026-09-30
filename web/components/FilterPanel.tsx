'use client';

/* THE FILTER PANELS — v8. Figma 21:326: the fifth of the five designs.

   Two panels are drawn and both are built here, plus the shell they share:

     CheckPanel  21:327  a scrolling list of checkboxes with counts, and a
                         search field above it once the list is long enough to
                         need one. Serves Marca, Tienda and every declared
                         category attribute (Capacidad, Tipo de carga…).
     PricePanel  21:382  two currency fields, a dual slider, four presets.

   ---- WHY THE SLIDER IS TWO NATIVE <input type="range"> -------------------
   Lazy-first gate 3, "native platform feature", and it is not a compromise
   here — it is strictly better. Stacking two real range inputs gives each thumb
   an accessible name, arrow-key stepping, Home/End, a focus ring and a
   screen-reader value announcement, all for free. A div-and-pointermove
   implementation has to build every one of those and typically ships none of
   them. The only cost is one CSS trick: the two tracks overlap, so both are
   `pointer-events: none` except on their thumbs.

   ---- WHY `Aplicar` EXISTS WHEN FILTERING IS ALREADY LIVE -----------------
   Every control here is live: tick a brand and the grid re-filters immediately,
   because the catalogue is already client-side and there is nothing to wait for.
   So `Aplicar` commits nothing — it CLOSES the panel, which is the only thing
   left for it to do, and it is drawn in both frames as the primary action.
   Labelling it `Aplicar` while it applies nothing would be a control that lies,
   so its accessible name says what it does: "Aplicar y cerrar". The visible word
   stays the designed one. */

import { useEffect, useId, useRef, useState } from 'react';

import { crc, mil } from '@/lib/format';
import s from './FilterPanel.module.css';
import { Icon } from './Icon';

/* Above this many options the list gets a search field. Below it, a search box
   over six rows is furniture that costs a tap and saves none. 21:327 draws one
   over an eight-row list, which is where the number comes from. */
const SEARCH_AT = 8;

/** The shell: title, chevron, body, and the Limpiar/Aplicar footer. */
export function FilterPanel({
  title, onClose, onClear, align = 'left', wide = false, children,
}: {
  title: string;
  onClose: () => void;
  onClear: () => void;
  align?: 'left' | 'right';
  wide?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /* Escape closes and an outside pointerdown closes. The panel does NOT trap
     focus and does not make the page inert: it is a menu of filters over a list
     that stays readable and stays interactive, not a decision that has to be
     resolved before anything else can happen. Same call the chrome's `Todas`
     overlay makes, for the same reason. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      /* the chip that opened this panel is the panel's own previous sibling, so
         it is inside `.holder` — walking up from the panel would close on the
         chip's pointerdown and the chip's click would immediately reopen it */
      if (ref.current?.parentElement?.contains(t)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`${s.panel} ${wide ? s.wide : ''} ${align === 'right' ? s.right : ''}`}
    >
      <div className={s.head}>
        <h3 className={s.title}>{title}</h3>
        <button type="button" className={s.close} onClick={onClose} aria-label={`Cerrar ${title}`}>
          <Icon name="chevron-up" size={12} />
        </button>
      </div>
      {children}
      <div className={s.foot}>
        <button type="button" className={s.clear} onClick={onClear}>
          Limpiar
        </button>
        {/* see the file header: it closes, and its accessible name says so */}
        <button type="button" className={s.apply} onClick={onClose} aria-label="Aplicar y cerrar">
          Aplicar
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   CheckPanel · 21:327 — Marca, Tienda, and every category attribute
   ========================================================================= */

export function CheckPanel({
  title, options, selected, onToggle, onClear, onClose, align,
}: {
  title: string;
  options: { value: string; label: string; count: number }[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
  onClose: () => void;
  align?: 'left' | 'right';
}) {
  const [q, setQ] = useState('');
  const id = useId();
  const showSearch = options.length >= SEARCH_AT;
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? options.filter((o) => o.label.toLowerCase().includes(needle))
    : options;

  return (
    <FilterPanel title={title} onClose={onClose} onClear={onClear} align={align}>
      {showSearch ? (
        <div className={s.search}>
          <Icon name="search-sm" size={14} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Buscar ${title.toLowerCase()}...`}
            aria-label={`Buscar dentro de ${title}`}
          />
        </div>
      ) : null}

      {shown.length ? (
        <ul className={s.list}>
          {shown.map((o) => (
            <li key={o.value}>
              <label className={s.opt} htmlFor={`${id}-${o.value}`}>
                <input
                  id={`${id}-${o.value}`}
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={() => onToggle(o.value)}
                />
                <span className={s.box} aria-hidden="true">
                  <Icon name="check-mark" size={10} />
                </span>
                <span className={s.optRow}>
                  <span className={s.optT}>{o.label}</span>
                  {/* THE COUNT IS ALWAYS THE COUNT OF SOMETHING. It is derived
                      from the live pool, so a chain that stops stocking this
                      category disappears from the control the same day it
                      disappears from the data. */}
                  <span className={s.optN}>({mil(o.count)})</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.none}>Ninguna coincide con «{q}».</p>
      )}
    </FilterPanel>
  );
}

/* =========================================================================
   PricePanel · 21:382
   ========================================================================= */

/** The four presets the frame draws. Stated in COLONES rather than as the
 *  strings "₡100k", so the labels are derived from the same numbers the filter
 *  applies and the two can never disagree. */
const PRESETS: { label: string; lo: number | null; hi: number | null }[] = [
  { label: '< ₡100k', lo: null, hi: 100_000 },
  { label: '₡100k – ₡300k', lo: 100_000, hi: 300_000 },
  { label: '₡300k – ₡500k', lo: 300_000, hi: 500_000 },
  { label: '> ₡500k', lo: 500_000, hi: null },
];

/** Round to a readable step so a dragged thumb lands on ₡245.000 rather than
 *  ₡244.873 — the figure is a filter bound, not a measurement. */
const STEP = 5_000;
const snap = (n: number) => Math.round(n / STEP) * STEP;

export function PricePanel({
  domain, min, max, onChange, onClear, onClose, align,
}: {
  /** [cheapest, dearest] in the pool — the slider's own axis. Never a hardcoded
   *  0–1.000.000: a category of ₡20.000 microwaves would get a slider whose
   *  first 2% of travel covers its entire catalogue. */
  domain: [number, number];
  min: number | null;
  max: number | null;
  onChange: (lo: number | null, hi: number | null) => void;
  onClear: () => void;
  onClose: () => void;
  align?: 'left' | 'right';
}) {
  const [dLo, dHi] = domain;
  const lo = min ?? dLo;
  const hi = max ?? dHi;
  const span = Math.max(1, dHi - dLo);
  const pct = (v: number) => ((v - dLo) / span) * 100;

  return (
    <FilterPanel title="Rango de precio" onClose={onClose} onClear={onClear} align={align} wide>
      <div className={s.money}>
        <label className={s.field}>
          <span className={s.fieldL}>Mínimo</span>
          <span className={s.input}>
            <span aria-hidden="true">₡</span>
            <input
              type="text"
              inputMode="numeric"
              value={min === null ? '' : mil(min)}
              placeholder={mil(dLo)}
              aria-label="Precio mínimo en colones"
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ''));
                onChange(n ? n : null, max);
              }}
            />
          </span>
        </label>
        <label className={s.field}>
          <span className={s.fieldL}>Máximo</span>
          <span className={s.input}>
            <span aria-hidden="true">₡</span>
            <input
              type="text"
              inputMode="numeric"
              value={max === null ? '' : mil(max)}
              placeholder={mil(dHi)}
              aria-label="Precio máximo en colones"
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ''));
                onChange(min, n ? n : null);
              }}
            />
          </span>
        </label>
      </div>

      <div className={s.slider}>
        <span className={s.track} aria-hidden="true" />
        <span
          className={s.fill}
          aria-hidden="true"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        {/* the lower thumb can never cross the upper one, and vice versa —
            enforced on the value rather than on the drag, so a keyboard user
            hitting End on the min thumb gets `hi`, not `dHi` */}
        <input
          className={s.range}
          type="range"
          min={dLo}
          max={dHi}
          step={STEP}
          value={lo}
          aria-label="Precio mínimo"
          onChange={(e) => onChange(Math.min(snap(Number(e.target.value)), hi), max)}
        />
        <input
          className={s.range}
          type="range"
          min={dLo}
          max={dHi}
          step={STEP}
          value={hi}
          aria-label="Precio máximo"
          onChange={(e) => onChange(min, Math.max(snap(Number(e.target.value)), lo))}
        />
      </div>

      <div className={s.presets}>
        <span className={s.fieldL}>Presets de precio</span>
        <div className={s.presetRow}>
          {PRESETS.map((p) => {
            const on = min === p.lo && max === p.hi;
            return (
              <button
                key={p.label}
                type="button"
                className={s.preset}
                aria-pressed={on}
                onClick={() => (on ? onClear() : onChange(p.lo, p.hi))}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    </FilterPanel>
  );
}

/** the label a price chip carries once something is set */
export const priceChipLabel = (lo: number | null, hi: number | null) =>
  `${lo === null ? 'hasta' : crc(lo)}${lo !== null && hi !== null ? ' – ' : ' '}${
    hi === null ? 'o más' : crc(hi)
  }`;
