'use client';

/* THE CATEGORY PAGE'S FILTER BAR — v8. Figma 18:103 (the bar) + 21:326 (the
   panels it opens).

   ---- WHAT CHANGED FROM v7, AND IT IS THE INTERACTION MODEL ---------------
   v7 had ONE `Filtros · 3` button that opened ONE panel containing every
   fieldset. 18:103 draws a ROW OF CHIPS — `Ordenar por: …` then `Marca`,
   `Rango de precio`, `Capacidad`, `Tipo de carga`, `Tienda` — each opening its
   own small popover, with the applied values trailing as removable teal chips
   and `Limpiar filtros` at the right end.

   THE ATTRIBUTE CHIPS ARE NOT NEW MACHINERY. `Capacidad` and `Tipo de carga`
   are declared by the CategoryProfile and `buildFacets()` already derives them,
   counts them and labels them — it has been doing so on /buscar since v4. This
   component now calls it instead of offering only brand/chain/price, so the two
   surfaces filter by the same rule and neither has a hand-written facet list.
   The matching predicate is `attrText(p, key)`, imported from lib/catalog.ts —
   the identical one `applyQuery` uses, never a second opinion about the same
   words.

   ---- STILL A CLIENT ISLAND THAT READS NO searchParams ---------------------
   The reasoning is unchanged and load-bearing. Reading `searchParams` would
   un-prerender all fifteen head-term category pages; pushing a route would make
   chips a control that navigates. So this renders `children` — the server's own
   grid, every product a real `<a href>` — UNCHANGED until something is actually
   selected. `dynamicParams = false` still holds, a no-JS reader still gets the
   full crawlable list, and the filtered view is deliberately not addressable.
   That is a scaled-content decision, not a missing feature. */

import { useEffect, useMemo, useState } from 'react';

import { useApp } from '@/lib/app-store';
import {
  anyInStock, attrText, buildFacets, inPriceRange, retailersOf, SORTERS,
} from '@/lib/catalog';
import type { Sort } from '@/lib/catalog';
import { mil } from '@/lib/format';
import type { Enriched } from '@/lib/types';
import s from './CategoryRefine.module.css';
import { CheckPanel, PricePanel, priceChipLabel } from './FilterPanel';
import { Icon } from './Icon';
import pg from './Page.module.css';
import { ProductCard } from './ProductCard';
import { SortSelect } from './SortSelect';

/* The order the SERVER renders in. A sort equal to this one is not a
   re-ordering, so the island keeps showing the server's own DOM. */
const SERVER_SORT: Sort = 'precio-asc';

/** which panel is open, or none. One at a time: two open popovers overlapping
 *  in a 32px-tall chip row is not a thing to design around. */
type OpenKey = string | null;

export function CategoryRefine({
  categoryId, total, children,
}: {
  categoryId: string;
  total: number;
  children: React.ReactNode;
}) {
  const { catalog } = useApp();
  const [open, setOpen] = useState<OpenKey>(null);
  const [chains, setChains] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [facets, setFacets] = useState<Record<string, string[]>>({});
  const [min, setMin] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);
  /* `Solo disponibles` IS NOT IN THE DRAWN CHIP SET and is kept anyway.
     18:105 shows Marca · Rango de precio · Capacidad · Tipo de carga · Tienda,
     and stock is not among them — but it was a working filter in v7 and it is
     genuinely useful on a comparator whose whole promise is "go buy it here".
     Deleting a feature that works, because a mockup of a different category did
     not happen to draw it, is a regression dressed as fidelity. It renders as a
     TOGGLE chip rather than a panel, which is the same grammar the row already
     uses, and it is kept deliberately. */
  const [stock, setStock] = useState(false);
  const [sort, setSort] = useState<Sort>(SERVER_SORT);

  /* The client catalogue, scoped to this category. Null until it lands — until
     then the controls stay hidden rather than rendering a filter with nothing
     behind it. */
  const pool = useMemo<Enriched[] | null>(
    () => (catalog ? catalog.products.filter((p) => p.category === categoryId) : null),
    [catalog, categoryId],
  );

  /* EVERY OPTION AND EVERY COUNT COMES OFF THE LIVE POOL. A chain that stops
     stocking this category disappears from the control the same day it
     disappears from the data, and a count is always the count of something. */
  const opts = useMemo(() => {
    if (!pool || !catalog) return null;
    const c = new Map<string, number>();
    const b = new Map<string, number>();
    for (const p of pool) {
      for (const r of new Set(retailersOf(p))) c.set(r, (c.get(r) ?? 0) + 1);
      if (p.brandD) b.set(p.brandD, (b.get(p.brandD) ?? 0) + 1);
    }
    const rank = (m: Map<string, number>) =>
      [...m.entries()]
        .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'es'))
        .map(([value, count]) => ({ value, label: value, count }));
    return {
      chains: rank(c),
      brands: rank(b),
      /* the declared attributes, derived and labelled by the shared helper */
      attrs: buildFacets(catalog, categoryId, catalog.products),
    };
  }, [pool, catalog, categoryId]);

  /* THE SLIDER'S AXIS IS THE CATEGORY'S OWN RANGE, never a hardcoded span: a
     category of ₡20.000 microwaves on a 0–1.000.000 slider has its entire
     catalogue inside the first 2% of travel. */
  const domain = useMemo<[number, number]>(() => {
    if (!pool?.length) return [0, 1];
    let lo = Infinity;
    let hi = 0;
    for (const p of pool) {
      if (p.lo.price_crc < lo) lo = p.lo.price_crc;
      if (p.hi.price_crc > hi) hi = p.hi.price_crc;
    }
    return [Math.floor(lo), Math.ceil(hi)];
  }, [pool]);

  const facetCount = Object.values(facets).reduce((n, v) => n + v.length, 0);
  const touched = chains.length > 0 || brands.length > 0 || facetCount > 0
    || min !== null || max !== null || stock;
  const active = touched || sort !== SERVER_SORT;

  const results = useMemo(() => {
    if (!pool || !active) return null;
    let out = pool;
    if (chains.length) out = out.filter((p) => retailersOf(p).some((r) => chains.includes(r)));
    if (brands.length) out = out.filter((p) => brands.includes(p.brandD));
    for (const [key, values] of Object.entries(facets)) {
      if (!values.length) continue;
      out = out.filter((p) => {
        const v = attrText(p, key);
        return v !== null && values.includes(v);
      });
    }
    if (min !== null || max !== null) out = out.filter((p) => inPriceRange(p, min, max));
    if (stock) out = out.filter(anyInStock);
    return [...out].sort(SORTERS[sort]);
  }, [pool, active, chains, brands, facets, min, max, stock, sort]);

  /* THE WIDEST GAP IN WHAT IS ACTUALLY ON SCREEN (18:141). A MEASURED maximum
     over the rendered set, not standing copy, so it disappears the moment a
     filter leaves nothing with a real spread — which is the difference between
     a reading and a slogan. */
  const maxGap = useMemo(
    () => (results ?? []).reduce((m, p) => (p.gapPct > m ? p.gapPct : m), 0),
    [results],
  );

  /* The result count is FEEDBACK — it is how a reader knows the filter they
     just set did something — so it is announced, and it is the length of what
     is rendered rather than a stored figure. */
  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const toggleFacet = (key: string, v: string) =>
    setFacets((f) => {
      const cur = f[key] ?? [];
      return { ...f, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });

  const clearAll = () => {
    setChains([]); setBrands([]); setFacets({}); setMin(null); setMax(null);
    setStock(false); setSort(SERVER_SORT); setOpen(null);
  };

  /* A category swap remounts this island, but a filter left set while the
     catalogue is still loading would apply to a pool that has since changed
     shape. Reset when the category identity changes. */
  useEffect(() => { clearAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [categoryId]);

  if (!pool || !opts) return <>{children}</>;

  /* the applied values, as removable chips. One flat list so the row reads
     left-to-right in the order a reader set them, rather than grouped by a
     taxonomy they did not choose. */
  const applied: { key: string; label: string; drop: () => void }[] = [
    ...brands.map((b) => ({ key: `b-${b}`, label: b, drop: () => toggle(brands, setBrands, b) })),
    ...chains.map((c) => ({ key: `c-${c}`, label: c, drop: () => toggle(chains, setChains, c) })),
    ...Object.entries(facets).flatMap(([key, vs]) =>
      vs.map((v) => {
        const g = opts.attrs.find((a) => a.key === key);
        return {
          key: `f-${key}-${v}`,
          label: g?.options.find((o) => o.value === v)?.label ?? v,
          drop: () => toggleFacet(key, v),
        };
      })),
    ...(min !== null || max !== null
      ? [{ key: 'price', label: priceChipLabel(min, max), drop: () => { setMin(null); setMax(null); } }]
      : []),
    ...(stock ? [{ key: 'stock', label: 'Solo disponibles', drop: () => setStock(false) }] : []),
  ];

  /** one facet chip + the panel it owns */
  const chip = (key: string, label: string, n: number, panel: (align: 'left' | 'right') => React.ReactNode, last = false) => (
    <div className={s.holder} key={key}>
      <button
        type="button"
        className={s.chip}
        aria-expanded={open === key}
        aria-haspopup="true"
        onClick={() => setOpen((o) => (o === key ? null : key))}
      >
        {label}
        {n ? <span className={s.chipN}>{n}</span> : null}
        <Icon name="chevron-down" size={12} />
      </button>
      {open === key ? panel(last ? 'right' : 'left') : null}
    </div>
  );

  return (
    <>
      <div className={s.bar}>
        <div className={s.row}>
          <div className={s.chips}>
            <SortSelect value={sort} onChange={setSort} />
            <span className={s.div} aria-hidden="true" />

            {opts.brands.length > 1
              ? chip('marca', 'Marca', brands.length, (align) => (
                <CheckPanel
                  title="Marca"
                  options={opts.brands}
                  selected={brands}
                  onToggle={(v) => toggle(brands, setBrands, v)}
                  onClear={() => setBrands([])}
                  onClose={() => setOpen(null)}
                  align={align}
                />
              ))
              : null}

            {chip('precio', 'Rango de precio', min !== null || max !== null ? 1 : 0, (align) => (
              <PricePanel
                domain={domain}
                min={min}
                max={max}
                onChange={(lo, hi) => { setMin(lo); setMax(hi); }}
                onClear={() => { setMin(null); setMax(null); }}
                onClose={() => setOpen(null)}
                align={align}
              />
            ))}

            {/* THE DECLARED ATTRIBUTES — Capacidad, Tipo de carga, and whatever
                else this category's profile declares. There is no per-category
                code here and there must never be: the chips ARE the profile. */}
            {opts.attrs.map((g) =>
              chip(g.key, g.label, (facets[g.key] ?? []).length, (align) => (
                <CheckPanel
                  title={g.label}
                  options={g.options}
                  selected={facets[g.key] ?? []}
                  onToggle={(v) => toggleFacet(g.key, v)}
                  onClear={() => setFacets((f) => ({ ...f, [g.key]: [] }))}
                  onClose={() => setOpen(null)}
                  align={align}
                />
              )))}

            {opts.chains.length > 1
              ? chip('tienda', 'Tienda', chains.length, (align) => (
                <CheckPanel
                  title="Tienda"
                  options={opts.chains}
                  selected={chains}
                  onToggle={(v) => toggle(chains, setChains, v)}
                  onClear={() => setChains([])}
                  onClose={() => setOpen(null)}
                  align={align}
                />
              ), true)
              : null}

            {/* the toggle chip — see the note on `stock` above */}
            <button
              type="button"
              className={s.chip}
              aria-pressed={stock}
              onClick={() => setStock((v) => !v)}
            >
              Solo disponibles
            </button>

            {applied.map((a) => (
              <span key={a.key} className={s.on}>
                {a.label}
                <button type="button" onClick={a.drop} aria-label={`Quitar ${a.label}`}>
                  <Icon name="x-circle" size={12} />
                </button>
              </span>
            ))}
          </div>

          {touched ? (
            <button type="button" className={s.clear} onClick={clearAll}>
              Limpiar filtros
            </button>
          ) : null}
        </div>

        {active ? (
          <p className={s.summary} aria-live="polite">
            <b>
              {mil(results?.length ?? 0)} de {mil(total)} resultados
            </b>
            {applied.length ? (
              <>
                <span className={s.dot} aria-hidden="true" />
                <span className={s.by}>
                  Filtrado por: <b>{applied.map((a) => a.label).join(', ')}</b>
                </span>
              </>
            ) : null}
            {maxGap > 0 ? (
              <span className={s.gapNote}>
                ✓ Se encontraron brechas de precio de hasta un {Math.round(maxGap)}%
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* UNTOUCHED = THE SERVER'S OWN DOM. Not a re-render of the same products
          from the client copy: that would replace 24 server-rendered anchors
          with 24 identical client-rendered ones for no reason, and it is how the
          no-JS guarantee quietly stops being true. */}
      {results ? (
        <ul className={pg.grid}>
          {results.slice(0, 24).map((x, i) => (
            <ProductCard key={x.id} product={x} eager={i < 4} />
          ))}
        </ul>
      ) : (
        children
      )}
    </>
  );
}
