'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';

import {
  applyQuery, EMPTY_QUERY, loadCatalog, type Catalog, type Query, type Sort, type StateFilter,
} from './catalog';
import { load as loadPrefs, pushRecent, save as savePrefs } from './persist';
import type { Enriched } from './types';

/* One store, one worker, one catalogue. Everything below is synchronous once
   the two fetches land, which is why almost nothing in this app has a loading
   state. */

export const TRAY_MAX = 4;

interface App {
  catalog: Catalog | null;
  /** the worker has its index and can answer — search is live before the
   *  catalogue finishes, because index.json is a third of the size */
  searchReady: boolean;
  /** a query has been sent and its answer has not come back yet. Distinct from
   *  `!searchReady`: a keystroke made while the index is still loading is
   *  outstanding too, and the difference between "searching" and "nothing
   *  found" is the whole point — see search.worker.ts. */
  searching: boolean;
  error: string | null;

  q: string;
  setQ: (q: string) => void;
  recent: string[];
  clearRecent: () => void;

  query: Query;
  setState: (s: StateFilter) => void;
  setCategory: (c: string | null) => void;
  setSort: (s: Sort) => void;
  toggleFacet: (key: string, value: string) => void;
  clearFacets: () => void;

  results: Enriched[];

  tray: string[];
  trayFull: boolean;
  toggleTray: (id: string) => void;
  clearTray: () => void;

  online: boolean;
}

const Ctx = createContext<App | null>(null);

export const useApp = (): App => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
};

/* The detail sheet is no longer state in here. It is a ROUTE
   (`/producto/[slug]`), opened as an overlay by the intercepting route
   `app/@modal/(.)producto/[slug]` and closed with the router's own back. The
   store used to own a `?p=<id>` param, which was a second URL for content that
   now has a real, canonical, indexable one — exactly the duplicate-content twin
   the SEO work exists to avoid. */

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [searchReady, setSearchReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  const [q, setQRaw] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [ids, setIds] = useState<string[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState<Query>(EMPTY_QUERY);
  const [tray, setTray] = useState<string[]>([]);

  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  const started = useRef<Map<number, number>>(new Map());

  /* ---- boot: worker + catalogue in parallel ---- */
  useEffect(() => {
    const w = new Worker(new URL('./search.worker.ts', import.meta.url));
    worker.current = w;
    w.onmessage = (e: MessageEvent) => {
      const m = e.data as
        | { type: 'ready' }
        | { type: 'error'; message: string }
        | { type: 'result'; seq: number; ids: string[] };
      if (m.type === 'ready') setSearchReady(true);
      else if (m.type === 'error') setError(m.message);
      else if (m.type === 'result') {
        if (m.seq !== seq.current) return; // a newer keystroke already won
        setIds(m.ids);
        setSearching(false);
        mark(m.seq);
      }
    };
    w.postMessage({ type: 'init', url: '/data/index.json' });

    loadCatalog().then(setCatalog).catch((e: Error) => setError(e.message));
    return () => w.terminate();
  }, []);

  /* ---- instrumentation: keystroke → results painted, in ms ----
     Written to window.__vq so the budget in spec-v2 §8.1 is a measurement the
     verification script reads, not an adjective in a report. */
  const mark = (s: number) => {
    const t0 = started.current.get(s);
    if (t0 === undefined) return;
    started.current.delete(s);
    requestAnimationFrame(() =>
      setTimeout(() => {
        const g = window as unknown as { __vq?: number[] };
        (g.__vq ??= []).push(performance.now() - t0);
      }, 0));
  };

  /* ---- restore persisted state ---- */
  useEffect(() => {
    const p = loadPrefs();
    setRecent(p.recent);
    setTray(p.tray.slice(0, TRAY_MAX));
    setQuery((cur) => ({
      ...cur, state: p.state, category: p.category, facets: p.facets, sort: p.sort,
    }));
  }, []);

  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener('online', set);
    window.addEventListener('offline', set);
    return () => {
      window.removeEventListener('online', set);
      window.removeEventListener('offline', set);
    };
  }, []);

  const setQ = useCallback((next: string) => {
    setQRaw(next);
    const term = next.trim();
    if (!term) {
      setIds(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const s = ++seq.current;
    started.current.set(s, performance.now());
    worker.current?.postMessage({ type: 'query', seq: s, q: term });
  }, []);

  /* /buscar?q=… actually searches. The site's JSON-LD publishes a SearchAction
     pointing at that URL, and a structured-data claim the app does not honour
     would be exactly the kind of machine-readable overstatement this product
     exists to avoid. Runs after the boot effect, so the worker already has its
     init message queued ahead of this query. */
  useEffect(() => {
    const term = new URLSearchParams(window.location.search).get('q');
    if (term?.trim()) setQ(term);
  }, [setQ]);

  // A search is only "recent" once the user stops typing it.
  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => setRecent(pushRecent(q)), 900);
    return () => clearTimeout(t);
  }, [q]);

  const patch = useCallback((p: Partial<Query>) => {
    setQuery((cur) => {
      const next = { ...cur, ...p };
      savePrefs({
        state: next.state, category: next.category, facets: next.facets, sort: next.sort,
      });
      return next;
    });
  }, []);

  /* `ids === null` MEANS TWO OPPOSITE THINGS AND `applyQuery` CAN ONLY READ
     ONE OF THEM. To it, null means "no text query, do not filter by id" — which
     is right when the box is empty and catastrophic while a typed query is still
     in flight: it answers a search for "samsung" with the entire catalogue.

     The pair (`searching`, `ids`) disambiguates it. A query that is outstanding
     AND has never been answered is not a result set of any size, so it resolves
     to nothing and the screen shows its pending state. Note this is deliberately
     NOT `!searchReady`: on the SECOND and later keystrokes `ids` still holds the
     previous answer, so the previous results stay on screen while the new ones
     resolve, which is what stops the grid flashing on every letter. */
  const results = useMemo(
    () => (catalog && !(searching && ids === null)
      ? applyQuery(catalog, { ...query, ids })
      : []),
    [catalog, query, ids, searching],
  );

  const toggleTray = useCallback((id: string) => {
    setTray((cur) => {
      const next = cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length >= TRAY_MAX ? cur : [...cur, id];
      savePrefs({ tray: next });
      return next;
    });
  }, []);

  const value: App = {
    catalog,
    searchReady,
    searching,
    error,
    q,
    setQ,
    recent,
    clearRecent: () => {
      savePrefs({ recent: [] });
      setRecent([]);
    },
    query: { ...query, ids },
    setState: (s) => patch({ state: s }),
    setCategory: (c) => patch({ category: c, facets: {} }),
    setSort: (s) => patch({ sort: s }),
    toggleFacet: (key, value) =>
      setQuery((cur) => {
        const have = cur.facets[key] ?? [];
        const values = have.includes(value) ? have.filter((v) => v !== value) : [...have, value];
        const facets = { ...cur.facets, [key]: values };
        savePrefs({ facets });
        return { ...cur, facets };
      }),
    clearFacets: () => patch({ facets: {} }),
    results,
    tray,
    trayFull: tray.length >= TRAY_MAX,
    toggleTray,
    clearTray: () => {
      savePrefs({ tray: [] });
      setTray([]);
    },
    online,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
