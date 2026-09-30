import type { Sort } from './catalog';

/* localStorage, wrapped once. Reads are try/catch'd because Safari private mode
   throws on access, and a storage failure must never take the app down. */

const KEY = 'vale:v1';

export interface Persisted {
  recent: string[];
  state: 'brecha' | 'comparable' | 'todos';
  category: string | null;
  facets: Record<string, string[]>;
  /* Imported, not re-declared. This union was typed out by hand here AND in
     lib/catalog.ts, so adding `nombre` in one place left the other silently
     narrower — a second copy of a type is a second thing to forget. */
  sort: Sort;
  tray: string[];
}

export const DEFAULTS: Persisted = {
  recent: [],
  state: 'comparable',
  category: null,
  facets: {},
  sort: 'brecha',
  tray: [],
};

export function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persisted>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function save(p: Partial<Persisted>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...load(), ...p }));
  } catch {
    /* storage unavailable — the app is still fully usable, just not sticky */
  }
}

export const RECENT_MAX = 6;

export function pushRecent(q: string): string[] {
  const term = q.trim();
  if (term.length < 2) return load().recent;
  const recent = [term, ...load().recent.filter((r) => r.toLowerCase() !== term.toLowerCase())]
    .slice(0, RECENT_MAX);
  save({ recent });
  return recent;
}
