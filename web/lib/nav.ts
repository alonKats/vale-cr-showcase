/* THE CATEGORY RANKING, AND HOW MUCH OF IT EACH SURFACE SHOWS.
   One ordering, one slice size, three readers: the chrome's second tier, the
   home page's category scroller, and the home page's browsing grid.

   ---- THE BUG THIS FILE EXISTS FOR ----------------------------------------
   `stats.cats` arrives in the CATALOGUE'S OWN ORDER, which is alphabetical by
   id — it is not ranked, and nothing in its type says so. `TopBar` had always
   re-sorted it by product count in a `useMemo` of its own, so the chrome showed
   the six BIGGEST categories.

   When the browsing grid was built to show "otras categorías populares" it
   sliced `stats.cats` from index 6 — the alphabetical index — and so skipped
   `aires · barras · celulares · cocinas · congeladores · consolas` while the
   chrome was carrying `celulares · smartwatches · laptops · cocinas · lavadoras
   · pantallas`. The two lists overlapped in three places, under a heading whose
   whole meaning is that they do not. Caught by looking at the rendered page:
   `Laptops`, `Lavadoras y secadoras` and `Pantallas y TV` were in the nav bar
   and in the "otras" grid, 600px apart.

   Sharing the NUMBER was never enough — the ORDER is the other half, and it was
   the half living privately inside one component. Both are here now. */

/** the categories the chrome's second tier carries */
export const NAV_PRIMARY = 6;

/** the tiles the home page's "otras categorías" grid carries, taken from the
 *  ranking AFTER the chrome's slice. Seven is the drawn count (6:247). */
export const BROWSE_TILES = 7;

/** THE ranking. By product count, descending — a rule about the catalogue
 *  rather than an opinion nobody maintains, so it re-ranks itself the day the
 *  engine's mix changes. Deliberately NOT alphabetical: alphabetical order in a
 *  truncated list means the bar's contents are decided by the Spanish alphabet.
 *
 *  Returns a new array; `stats.cats` is shared across every server-rendered
 *  route in a build and sorting it in place would reorder it for all of them. */
export const rankedCats = <T extends { count: number }>(cats: readonly T[]): T[] =>
  [...cats].sort((a, b) => b.count - a.count);

/* Both slices are generic over `{ count }` rather than typed to `CatRef`. The
   chrome receives a NARROWER shape than the home page does — it takes
   `{ id, label, count }` and has no use for `CatRef.pic` — and typing these to
   the wider record would force the chrome to accept a field it does not read
   just to call the ranking it must share. */

/** the six in the chrome */
export const navCats = <T extends { count: number }>(cats: readonly T[]): T[] =>
  rankedCats(cats).slice(0, NAV_PRIMARY);

/** the seven under "Buscar otras categorías populares" — the popular ones that
 *  are NOT already one click away in the bar. Same ranking, next slice. */
export const browseCats = <T extends { count: number }>(cats: readonly T[]): T[] =>
  rankedCats(cats).slice(NAV_PRIMARY, NAV_PRIMARY + BROWSE_TILES);
