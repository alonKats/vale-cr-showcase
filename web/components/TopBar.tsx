'use client';

/* THE CHROME — v8. Figma 6:5 (bar) · 6:25 (category strip) · 18:41 (freshness).

   Two tiers, both white:
     tier 1  74px   wordmark · the 560px search pill · the merchant CTA
     tier 2  52px   `Todas` + the top six categories + `Brechas`, the active one
                    underlined in amber
     strip   36px   the freshness reading, on --tint, NOT sticky

   ---- WHAT THE FIGMA DRAWS THAT THIS DOES NOT RENDER, AND WHY -----------
   The bar in 6:5 carries three right-hand actions: `Favoritos` (a heart),
   `Ingresar` (a user) and `Agregar tu tienda`. Only the third is built.

   There is no account system in this product and no favourites store — no auth,
   no session, no per-visitor persistence beyond the consent cookie and the
   recent-search list in localStorage. A header that offers `Ingresar` and opens
   nothing is worse than a header that does not offer it: it is a promise the
   site cannot keep, on the most-viewed 74px of the site, and the same is true
   of a heart that cannot save anything. The category card in 18:144 draws the
   same heart and it is omitted there for the same reason.

   So they are NOT rendered, at any width, and this is flagged rather than
   quietly dropped. The day either feature exists, the design is already drawn
   and the slot is already positioned.

   `Agregar tu tienda` IS built, because /comercios is a real page.

   ---- WHAT SURVIVED THE REPAINT UNCHANGED ---------------------------------
   Every behaviour: the type-to-navigate search, the overflow rail and its
   pointer-only nudge buttons, the `Todas` overlay and its outside-click and
   Escape handling, and the structural rule that the overlay is a SIBLING of the
   scroller rather than a child of it (see the module's header for the overflow
   spec that makes a child version silently clip to 52px). */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useApp } from '@/lib/app-store';
import { useRail } from '@/lib/use-rail';
import { navCats } from '@/lib/nav';
import { crc } from '@/lib/format';
import { CAT_ICONS, CAT_ICON_FALLBACK } from './cat-icons';
import { categoryPath, productPath } from '@/lib/seo';
import { Icon } from './Icon';
import s from './TopBar.module.css';
import { Wordmark } from './Wordmark';

/* THE SEARCH PILL, and the suggestion panel under it.
   
   ---- WHAT REPLACED `navigateOnType`, AND WHY ------------------------------
   The bar used to push /buscar on the FIRST character typed, anywhere on the
   site. That is why nothing could ever be suggested in place: the surface that
   would show a suggestion was replaced by a page before the second keystroke
   landed. Typing now ANSWERS where you are — the panel below — and navigation
   happens on a deliberate act: Enter, a click on a row, or the "ver todos" row.

   The panel is suppressed on /buscar itself. That page IS the answer, and
   floating six of its own rows over the top of it is a second copy of the same
   information. It is also what keeps `scripts/probe.mjs` honest: that gate
   navigates to /buscar and then types, measuring keystroke-to-results, and it
   measures the page rather than a panel over it.

   The rows are read straight off `results`, which the store already computes
   for the results page from the SAME worker answer. There is no second query,
   no second ranking and no separate suggestion index that could disagree with
   the page a click leads to. */
export function Find({
  placeholder, autoFocus = false, suggest = false,
}: {
  placeholder: string;
  autoFocus?: boolean;
  /** show the suggestion panel. Off inside the results page's own surfaces. */
  suggest?: boolean;
}) {
  const { q, setQ, results, searching } = useApp();
  const router = useRouter();
  const path = usePathname();
  const ref = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  /** -1 = the input itself; 0..n = a row. Keyboard only; the pointer sets it too
   *  so that hovering and arrowing cannot disagree about what Enter opens. */
  const [active, setActive] = useState(-1);

  const term = q.trim();
  const onResults = path === '/buscar';
  const top = useMemo(() => results.slice(0, SUGGEST_ROWS), [results]);
  const show = suggest && !onResults && open && term.length > 0;

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  // A new term invalidates the highlight — otherwise Enter opens row 3 of the
  // PREVIOUS result set, which is the worst possible outcome of a type-ahead.
  useEffect(() => setActive(-1), [term]);
  // Navigating away closes it; the header is persistent and the panel is not.
  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!show) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [show]);

  const go = (id?: string) => {
    setOpen(false);
    router.push(id ? productPath(id) : '/buscar');
  };

  return (
    <div className={s.find} ref={boxRef}>
      <Icon name="search" size={18} className={s.icon} />
      <input
        ref={ref}
        className={s.input}
        value={q}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        aria-label="Buscar un producto"
        role="combobox"
        aria-expanded={show}
        aria-controls="find-suggest"
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `find-opt-${active}` : undefined}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); return; }
          if (e.key === 'Enter') {
            e.preventDefault();
            if (term) go(active >= 0 ? top[active]?.id : undefined);
            return;
          }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!top.length) return;
            e.preventDefault();
            setOpen(true);
            setActive((i) => {
              const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
              // wraps to the input at the top, and stops at the last row —
              // arrowing past the end should not jump back to the first result
              return next < -1 ? -1 : Math.min(next, top.length - 1);
            });
          }
        }}
      />
      {q ? (
        <button type="button" className={s.clear} onClick={() => { setQ(''); setOpen(false); }} aria-label="Borrar la búsqueda">
          <Icon name="x-circle" size={16} />
        </button>
      ) : null}

      {show ? (
        <div className={s.suggest} id="find-suggest" role="listbox" aria-label="Sugerencias">
          {/* THE THREE STATES ARE DISTINCT, which is the entire point of this
              panel — an empty list means one thing while a query is in flight
              and the opposite thing when it has landed. */}
          {searching && !top.length ? (
            <p className={s.suggestNote} aria-live="polite">Buscando…</p>
          ) : null}
          {!searching && !top.length ? (
            <p className={s.suggestNote} aria-live="polite">Nada con «{term}».</p>
          ) : null}

          {top.map((r, i) => (
            <Link
              key={r.id}
              id={`find-opt-${i}`}
              href={productPath(r.id)}
              role="option"
              aria-selected={i === active}
              className={`${s.suggestRow} ${i === active ? s.suggestOn : ''}`}
              onPointerEnter={() => setActive(i)}
              onClick={() => setOpen(false)}
            >
              <span className={s.suggestName}>{r.cardT}</span>
              <span className={s.suggestMeta}>
                {crc(r.lo.price_crc)}
                <span className={s.suggestDim}> · {r.catLabel}</span>
              </span>
            </Link>
          ))}

          {top.length ? (
            <button type="button" className={s.suggestAll} onClick={() => go()}>
              Ver {results.length > SUGGEST_ROWS ? `los ${results.length} resultados` : 'en el catálogo'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Six. Enough to recognise the thing you meant, few enough that the panel does
 *  not become a results page badly rendered inside a header. */
const SUGGEST_ROWS = 6;

export function TopBar({
  freshShort, cats,
}: {
  freshShort: string;
  /** the engine's own categories, never a hardcoded list */
  cats: { id: string; label: string; count: number }[];
}) {
  const rail = useRail([cats.length]);
  const path = usePathname();
  /* THE STRIP IS SUPPRESSED ON `/` AND ONLY ON `/`. The home hero carries its
     own freshness reading inside the trust badges, so rendering the strip there
     printed the same sentence twice, 80px apart, above the fold. Carried over
     from H3.5 — the condition is unchanged, only the surface it sits on is. */
  const onHome = path === '/';
  const [openAll, setOpenAll] = useState(false);
  const allRef = useRef<HTMLDivElement>(null);
  const allBtnRef = useRef<HTMLButtonElement>(null);

  /* SIX, RANKED BY PRODUCT COUNT. The ranking is `lib/nav.ts`'s and not this
     component's any more: it used to be a private useMemo here, and the home
     page's "otras categorías" grid could not see it, so the two lists overlapped
     in three places. See that file for the bug. */
  const primary = useMemo(() => navCats(cats), [cats]);
  const all = useMemo(
    () => [...cats].sort((a, b) => a.label.localeCompare(b.label, 'es')),
    [cats],
  );

  useEffect(() => {
    if (!openAll) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenAll(false);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      /* The button is inside the scroller while the panel is a sibling, so
         without this a pointerdown on the button closes the menu a beat before
         its own click reopens it: it works by accident, through two state
         flips, and breaks the moment the click handler changes. */
      if (allRef.current?.contains(t) || allBtnRef.current?.contains(t)) return;
      setOpenAll(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [openAll]);

  return (
    <>
      {/* `chrome` is a PLAIN GLOBAL class, not a module class: globals.css needs
          to target it for the focus-ring override, and a CSS-Modules-hashed name
          cannot be reached from a global stylesheet. */}
      <header className={`chrome ${s.top}`}>
        <div className={s.tier1}>
          <div className={s.in}>
            <Link href="/" className={s.mark} aria-label="Vale.cr — inicio">
              <Wordmark size={28} tone="light" />
            </Link>
            <Find placeholder="¿Qué vas a comprar hoy? Busca celulares, laptops, lavadoras..." suggest />
            <div className={s.actions}>
              {/* `Favoritos` and `Ingresar` are drawn in 6:5 and deliberately
                  absent here — see the file header. */}
              <Link href="/comercios" className={s.store}>
                Agregar tu tienda
              </Link>
            </div>
          </div>
        </div>

        <nav className={s.tier2} aria-label="Categorías y brechas">
          <div
            className={s.in}
            ref={rail.ref}
            onScroll={rail.onScroll}
            data-at-start={rail.canPrev ? undefined : ''}
            data-at-end={rail.canNext ? undefined : ''}
          >
            {/* `Todas` comes first and its position is the only fixed one: it is
                the item that does not compete with the others, because it is the
                way OUT of the ranking. */}
            <button
              ref={allBtnRef}
              type="button"
              className={`${s.navLink} ${openAll ? s.on : ''}`}
              onClick={() => setOpenAll((v) => !v)}
              aria-expanded={openAll}
              aria-haspopup="true"
            >
              Todas las categorías
            </button>
            {primary.map((c) => {
              const href = categoryPath(c.id);
              /* `startsWith` and not `===`: a category's paginated pages are
                 /categoria/<slug>/2, and the strip must keep marking the
                 category on page 2 of it. */
              const on = path === href || path.startsWith(`${href}/`);
              return (
                <Link
                  key={c.id}
                  href={href}
                  className={s.navLink}
                  aria-current={on ? 'page' : undefined}
                >
                  {c.label}
                </Link>
              );
            })}
            {/* The 7th link, and it is NAVIGATION rather than advertising:
                /brechas is a destination, so it gets the same recipe as its six
                siblings and no badge, no dot, no "¡Nuevo!". It sits last because
                the six before it are ranked by product count and it is not in
                that ranking. */}
            <Link
              href="/brechas"
              className={s.navLink}
              aria-current={path === '/brechas' ? 'page' : undefined}
            >
              Brechas
            </Link>
          </div>

          {openAll && (
            <div className={s.allPanel} ref={allRef}>
              <ul className={s.allList}>
                {all.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={categoryPath(c.id)}
                      className={s.allLink}
                      onClick={() => setOpenAll(false)}
                    >
                      {/* THE COUNT IS GONE AND AN ICON TAKES ITS PLACE (QA
                          2026-08-31). The old note here argued the count was
                          "a REASON — the one comparable fact we hold about two
                          categories a reader has not opened". It is not: a
                          fifteen-row menu with a right-aligned number in every
                          row reads as a table of statistics, and nobody picks
                          `Celulares` over `Tablets` because one says 728. The
                          icon does the job a count was pretending to do — it
                          makes a row scannable — and it is the same glyph the
                          category scroller uses, so the two surfaces speak one
                          vocabulary. The counts still exist where they ARE a
                          reason: inside a filter panel, next to a checkbox. */}
                      <span className={s.allIcon}>
                        <Icon name={CAT_ICONS[c.id] ?? CAT_ICON_FALLBACK} size={18} />
                      </span>
                      <span>{c.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rail.overflows && (
            <>
              <button
                type="button"
                className={`${s.railBtn} ${s.railPrev}`}
                onClick={() => rail.nudge(-1)}
                disabled={!rail.canPrev}
                aria-hidden="true"
                tabIndex={-1}
              >
                <Icon name="chevron-right" size={16} style={{ rotate: '180deg' }} />
              </button>
              <button
                type="button"
                className={`${s.railBtn} ${s.railNext}`}
                onClick={() => rail.nudge(1)}
                disabled={!rail.canNext}
                aria-hidden="true"
                tabIndex={-1}
              >
                <Icon name="chevron-right" size={16} />
              </button>
            </>
          )}
        </nav>
      </header>

      {/* Figma 18:41. `freshShort` is composed from meta.price_freshness and can
          only say what the artifact proves — it is NOT meta.generated_at, which
          is when the export ran and was false for 16% of the catalogue when the
          chrome printed it in v3. */}
      {onHome ? null : (
        <div className={s.strip}>
          <p className={s.stripIn}>
            <Icon name="calendar-sync" size={14} className={s.stripIcon} />
            {freshShort}
          </p>
        </div>
      )}
    </>
  );
}

export function Recent() {
  const { recent, setQ, clearRecent } = useApp();
  const router = useRouter();
  if (!recent.length) return null;
  return (
    <div className={s.recent}>
      <span>Recientes:</span>
      {recent.map((r) => (
        <button
          key={r}
          type="button"
          className={s.recentBtn}
          onClick={() => {
            setQ(r);
            router.push('/buscar');
          }}
        >
          {r}
        </button>
      ))}
      <button type="button" className={s.recentDrop} onClick={clearRecent}>
        Borrar
      </button>
    </div>
  );
}
