/* The same catalogue the browser gets, read off disk at BUILD time.

   `lib/catalog.ts` fetches the four artifacts and enriches them for the client.
   This module does the identical thing with `readFileSync`, reusing the very
   same `enrich()` — so a product page prerendered on the server and the overlay
   rendered client-side in the browser are the same object, computed once, and
   cannot drift apart. The artifact is a build INPUT here and is never written.

   Everything that needs it (the 737 product pages, the 6 category pages, the
   sitemap, the trust band) runs at build time, so this is read once per build. */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { enrich } from './catalog';
import { nearestByRetailer } from './display';
import type {
  Branch, Category, Enriched, HistoryArtifact, Meta, NearestBranch, Product, ProductHistory,
} from './types';

const DATA = path.join(process.cwd(), 'public', 'data');
const read = <T,>(f: string): T => JSON.parse(readFileSync(path.join(DATA, f), 'utf8')) as T;

export interface ServerCatalog {
  products: Enriched[];
  byId: Map<string, Enriched>;
  byCategory: Map<string, Enriched[]>;
  cats: Category[];
  catMap: Map<string, Category>;
  nearest: Map<string, NearestBranch>;
  /** the RAW branch records — `BranchPanel` groups by cantón, which `nearest` (one
   *  branch per chain) cannot do. Read once per build, like everything else here. */
  branches: Branch[];
  meta: Meta;
  history: Record<string, ProductHistory>;
}

let cached: ServerCatalog | null = null;

export function serverCatalog(): ServerCatalog {
  if (cached) return cached;

  const catsRaw = read<Category[]>('categories.json');
  const catMap = new Map(catsRaw.map((c) => [c.id, c]));
  const products = read<Product[]>('products.json').map((p) => enrich(p, catMap));

  const byCategory = new Map<string, Enriched[]>();
  for (const c of catsRaw) byCategory.set(c.id, []);
  for (const p of products) {
    const bucket = byCategory.get(p.category);
    if (bucket) bucket.push(p);
    else byCategory.set(p.category, [p]);
  }
  // Same ranking the app uses: outliers first, then the calm ones by price.
  for (const list of byCategory.values()) {
    list.sort(
      (a, b) =>
        Number(b.band === 'brecha') - Number(a.band === 'brecha') ||
        b.gapPct - a.gapPct ||
        b.lo.price_crc - a.lo.price_crc,
    );
  }

  const branches = read<Branch[]>('branches.json');

  cached = {
    products,
    byId: new Map(products.map((p) => [p.id, p])),
    byCategory,
    cats: catsRaw,
    catMap,
    nearest: nearestByRetailer(branches),
    branches,
    meta: read<Meta>('meta.json'),
    // added by the engine mid-build; an older export will not carry it
    history: (() => {
      try {
        return read<HistoryArtifact>('history.json').products;
      } catch {
        return {};
      }
    })(),
  };
  return cached;
}
