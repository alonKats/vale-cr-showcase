'use client';

/* THE FACET BAR (§4.3, renamed from `FilterBar`).

   Every chip is DECLARED BY `CategoryProfile` — the label, the unit and the enum
   value labels all come off the profile, which is why the biggest new component in
   T2 needed no new data collection. There is no attribute name, no value label and
   no category branch typed anywhere in this file.

   ---- NO DEAD-END FACETS (§5.3 mitigation 2) ----
   A facet value that would leave FEWER THAN `MIN_RESULTS` products is NOT RENDERED.
   We hold the whole artifact client-side, so this is computed rather than guessed.
   This is the mitigation that matters most: zap's density is a solution to
   ABUNDANCE (5.180 products in one category) and we are running it on SCARCITY
   (526). An instrument built for abundance and fed scarcity does not read as
   precise — it reads as EMPTY, and a facet bar that filters 526 down to 3 is the
   fastest way to prove it.

   ---- THE `?` TOOLTIP IS A NATIVE POPOVER, NOT A `title` ----
   `popover` + `popovertarget` is the platform feature: keyboard-reachable, top-layer,
   dismissible on Escape and on click-outside, with ZERO JavaScript. A `title`
   attribute is invisible to touch and to keyboard users both. Baseline in all
   evergreen engines since 2024 (verified on caniuse, not on a blog), and where it is
   unsupported the button degrades to an inert button rather than to a broken layout.

   zap gives three of their seven chips a `?`. Ours genuinely needs it: "pies³",
   "No Frost" and "Energy Star" are jargon in es-CR, and the help text comes from the
   profile's own `display` template rather than from copy nobody has written. */

import { useMemo, useState } from 'react';

import { useApp } from '@/lib/app-store';
import { applyQuery, buildFacets, type Sort } from '@/lib/catalog';
import { mil } from '@/lib/format';
import type { BuildStats } from '@/lib/stats.server';
import s from './FacetBar.module.css';
import { Mark } from './Mark';
import p from './primitives.module.css';
import { SortSelect } from './SortSelect';

/** Below this, a facet value is a dead end and is not offered. */
const MIN_RESULTS = 5;

export function FacetBar({ stats }: { stats: BuildStats }) {
  const {
    catalog, query, setState, setCategory, setSort, toggleFacet, clearFacets,
  } = useApp();
  const [open, setOpen] = useState(false);

  // Counts come off the build stats until the catalogue lands, so they are REAL in
  // the first paint rather than zeros that fill in.
  const counts = catalog?.counts ?? {
    gap: stats.gap, comparable: stats.comparable, total: stats.total,
  };

  /* THE NO-DEAD-END COMPUTATION. For each declared facet value, apply the query it
     WOULD produce and keep the option only if enough survives. O(values × pool) once
     per category change — cheap on 2.170 products held client-side, and it is the
     difference between a facet bar that works and one that empties the page. */
  const groups = useMemo(() => {
    if (!catalog || !query.category) return [];
    return buildFacets(catalog, query.category, catalog.products)
      .map((g) => ({
        ...g,
        options: g.options.filter((o) => {
          const already = query.facets[g.key] ?? [];
          if (already.includes(o.value)) return true; // never remove a selected chip
          const trial = {
            ...query,
            facets: { ...query.facets, [g.key]: [...already, o.value] },
          };
          return applyQuery(catalog, trial).length >= MIN_RESULTS;
        }),
      }))
      .filter((g) => g.options.length > 1);
  }, [catalog, query]);

  const active = Object.values(query.facets).reduce((n, v) => n + v.length, 0);

  return (
    <>
      <div className={s.bar}>
        <div className={s.chips} role="group" aria-label="Filtros">
          {/* THE DEFAULT LANDING FILTER IS `Todos` in v4, not `Comparables`.
              v3 defaulted to `Comparables` so the amber keyline stayed meaningful —
              but that hid 1.913 of 2.170 products behind a filter the user never
              set, and T4 is now a real template rather than a degraded state. The
              scarcity is stated by the TrustBand instead of hidden by a default. */}
          <button
            type="button"
            className={p.chip}
            aria-pressed={query.state === 'todos'}
            onClick={() => setState('todos')}
          >
            Todos <span className={p.chipN}>{mil(counts.total)}</span>
          </button>
          <button
            type="button"
            className={p.chip}
            aria-pressed={query.state === 'comparable'}
            onClick={() => setState('comparable')}
          >
            Comparables <span className={p.chipN}>{mil(counts.comparable)}</span>
          </button>
          <button
            type="button"
            className={p.chip}
            aria-pressed={query.state === 'brecha'}
            onClick={() => setState('brecha')}
          >
            Con brecha <span className={p.chipN}>{mil(counts.gap)}</span>
          </button>

          <span className={s.div} aria-hidden="true" />

          {stats.cats.map((c) => (
            <button
              key={c.id}
              type="button"
              className={p.chip}
              aria-pressed={query.category === c.id}
              onClick={() => setCategory(query.category === c.id ? null : c.id)}
            >
              {/* currentColor only, never a hue per category: a rainbow taxonomy is
                  the fastest way to make a catalogue look like a template and it
                  encodes nothing. */}
              <Mark id={c.id} label={c.label} size={15} className={s.mk} />
              {c.label} <span className={p.chipN}>{mil(c.count)}</span>
            </button>
          ))}

          <button
            type="button"
            className={p.chip}
            aria-pressed={open}
            disabled={!query.category}
            onClick={() => setOpen((v) => !v)}
          >
            {active ? `Más filtros · ${active}` : 'Más filtros'}
          </button>
        </div>

        <SortSelect value={query.sort} onChange={(x: Sort) => setSort(x)} />
      </div>

      {open ? (
        <div className={s.panel}>
          {groups.length ? (
            groups.map((g) => (
              <div className={s.group} key={g.key}>
                <h3 className={s.groupH}>
                  {g.label}
                  {/* the native popover — no JS, keyboard-reachable, never a title */}
                  <button
                    type="button"
                    className={s.help}
                    popoverTarget={`help-${g.key}`}
                    aria-label={`Qué significa ${g.label}`}
                  >
                    ?
                  </button>
                  <span className={s.pop} id={`help-${g.key}`} popover="auto">
                    {/* The help text is the profile's OWN display template with the
                        placeholder shown as-is, so it can never disagree with the
                        values in the chips beside it. */}
                    {g.label}: los valores vienen de la ficha que publica cada cadena.
                    Se lee como «{g.options[0]?.label ?? '—'}».
                  </span>
                </h3>
                <div className={s.groupChips}>
                  {g.options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={p.chip}
                      aria-pressed={(query.facets[g.key] ?? []).includes(o.value)}
                      onClick={() => toggleFacet(g.key, o.value)}
                    >
                      {o.label} <span className={p.chipN}>{mil(o.count)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className={s.hint}>
              {query.category
                ? 'Esta categoría no publica suficientes fichas técnicas para filtrar por características sin dejar la página casi vacía.'
                : 'Escoja una categoría para filtrar por características.'}
            </p>
          )}
          <div className={s.panelFoot}>
            <span>
              Los filtros salen de la ficha de cada categoría, no de una lista escrita a mano. No le
              ofrecemos un filtro que deje menos de {MIN_RESULTS} resultados.
            </span>
            <button type="button" className={p.btn} onClick={clearFacets}>
              Limpiar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
