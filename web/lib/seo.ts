/* ==========================================================================
   SEO — every string here is COMPOSED FROM THE ARTIFACT. No templated filler,
   no adjectives the data cannot support.

   The honesty rules of the UI apply here twice over, because structured data is
   where a misrepresentation becomes machine-readable and gets republished by
   Google as a rich result:

   - `reviews.us` is NEVER this SKU (the record itself carries `us_title` and
     `match_basis`). It is therefore never emitted as `aggregateRating`, in any
     form, on any page. A US star score under this product's @id would be a
     false claim about a specific product.
   - `us_reference.rating` is the same thing and is likewise never emitted.
   - `reviews.cr` IS this SKU (the retailer's own reviews for this listing), so
     it MAY be emitted — but only at n >= 3. Below that the visible page says
     "muy pocas para sacar un promedio confiable", and shipping a 5,0 star
     rating off one review while the page disclaims it would put the structured
     data at odds with the content it describes. 30 of the 34 CR averages in
     this artifact are exactly 5,0 off one or two reviews.
   - No `priceValidUntil`. Nothing in the artifact says how long a price holds,
     and Google treats the field as recommended, not required.
   - No `hasMerchantReturnPolicy` / `shippingDetails`: we are not the merchant.
   ========================================================================== */

import { armOf } from './experiment';
import { crc, fecha, fechaDia, mil } from './format';
import { retailerNames } from './types';
import type { Category, Enriched, Meta } from './types';

/** No domain has been chosen for this product yet. Everything canonical reads
 *  this one value — canonicals, the sitemap, OG URLs, robots `host` — so
 *  pointing it at the real host is a single env var.
 *
 *  It used to default to `https://veredicto.cr`, a domain nobody owns. That is
 *  the one wrong default available: a build with the var unset published a full
 *  sitemap of canonicals for someone else's host, silently and with a green
 *  gate. The fallback is now localhost, which is *true* of a local build, and a
 *  deploy environment with the var unset fails the build instead of guessing. */
const DEPLOYING = Boolean(process.env.VERCEL || process.env.CI);
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (DEPLOYING && !configuredSiteUrl) {
  throw new Error(
    'NEXT_PUBLIC_SITE_URL is unset in a deploy environment. Canonicals, sitemap.xml, ' +
      'robots.txt and OG tags all resolve against it; there is no safe default for a ' +
      'domain that has not been chosen. Set it to the real host and rebuild.',
  );
}
export const SITE_URL = (configuredSiteUrl ?? 'http://localhost:3000').replace(/\/$/, '');

export const SITE_NAME = 'Vale';

/* The niche is the positioning: an APPLIANCE AND ELECTRONICS comparator for
   Costa Rica, not a general one. The nouns are never hardcoded — they are the
   category profiles' own labels, so the claim can only ever name categories the
   artifact actually carries. Add a category and the copy follows. */
export const nicheNouns = (cats: Category[]): string =>
  cats
    .map((c) => c.label.toLowerCase())
    .join(', ')
    .replace(/, ([^,]*)$/, ' y $1');

/* ---- WHAT GOOGLE ACTUALLY SHOWS, which is the only length that matters ----
   A SERP result is a TRUNCATED string, not the string we wrote. Google cuts the
   title around 60 characters and the description around 155, and everything past
   the cut may as well not exist.

   Measured 2026-08-29, and this is why these two constants are here:
     · the description was 540 CHARACTERS. The snippet a searcher saw ended
       mid-list — "…celulares, cocinas y hornos, congelador…" — and the one
       sentence that could earn a click, "comparamos por número de modelo y le
       decimos en cuál cadena comprar", sat at character ~430. IT HAD NEVER BEEN
       VISIBLE TO ANYONE.
     · the title was 66 characters, so the part that got cut was "Costa Rica" —
       the single most important qualifier on a country-targeted site.
   Over that stretch the homepage took 89 impressions at average position 7.5
   and ZERO clicks, while product pages (whose meta is built per product and is
   short) converted at 17–100%.

   THE OLD DESCRIPTION WAS NOT LONG BY ACCIDENT — IT WAS UNBOUNDED BY
   CONSTRUCTION. It interpolated the full category list AND the full retailer
   list, so it grew every time the catalogue did: adding `parrillas` and three
   retailers lengthened the homepage snippet without anyone editing copy. Both
   lists are gone from it. Nothing in the string below scales with the
   catalogue except two small integers, so it CANNOT drift back.

   `scripts/seo-audit.py` measures the rendered length against these constants
   every morning — the defect existed for weeks because nothing measured it. */
export const SERP_TITLE_MAX = 60;
export const SERP_DESCRIPTION_MAX = 155;

/** The homepage title. Dynamic on the retailer count for the same reason
 *  `nicheNouns` is dynamic on the categories: a hardcoded number becomes a lie
 *  the day a retailer is added or blocked, and this one is load-bearing — it is
 *  the differentiator against the six retailer results ranked above us.
 *
 *  Keeps the exact phrase "comparador de electrodomésticos" because that is the
 *  query the homepage ranks #4 for; trading a position for a punchier title
 *  would be the wrong trade at this traffic. "y electrónica" is what 60
 *  characters costs — the categories are on the page, the qualifier that
 *  survives is Costa Rica. */
export const siteTitle = (retailers: string[]): string =>
  `Comparador de electrodomésticos en Costa Rica · ${retailers.length} tiendas`;

/** The homepage description. Leads with the differentiator instead of burying
 *  it: what no retailer result above us can say is that we read the SAME model
 *  number in every chain and name the cheapest. */
export const siteDescription = (retailers: string[], total: number): string =>
  `Comparamos por número de modelo el precio de ${mil(total)} productos en `
  + `${retailers.length} tiendas de Costa Rica y le decimos dónde sale más barato. `
  + 'Contado, con IVA.';

/** `A, B y C` — the one place a chain list becomes a sentence. Lives HERE and not in
 *  a route file: Next forbids arbitrary named exports from a `page.tsx`, and a helper
 *  that two routes share has no business living in one of them anyway.
 *
 *  Callers MUST pass `retailerNames(meta.retailers)`. `meta.retailers` is an array of
 *  OBJECTS — it was typed `string[]` until 2026-08-04, and every `.join()` on it
 *  printed "[object Object]" into the meta description of 8.701 built pages with tsc
 *  green the whole time. */
export const chainSentence = (names: string[]) =>
  names.join(', ').replace(/, ([^,]*)$/, ' y $1');

export const productPath = (id: string) => `/producto/${id}`;
export const categoryPath = (id: string) => `/categoria/${id}`;
/** Absolutise a SITE-RELATIVE path. Idempotent: handed something that is
 *  already absolute, it returns it unchanged.
 *
 *  The guard is not defensive programming, it is a fix for a live defect. This
 *  was `${SITE_URL}${p}` with no check, which was correct for exactly as long
 *  as every argument was a path. The R2 image cutover (2026-08-08) changed
 *  `product.image` and `image_srcset[].src` from `/img/…` to
 *  `https://img.vale.cr/…`, and the two image call sites below kept passing
 *  them here — so every one of the 4.254 product pages published
 *
 *    og:image      https://vale.crhttps//img.vale.cr/…-640.webp
 *    JSON-LD image https://vale.crhttps://img.vale.cr/…-640.webp
 *
 *  Nothing failed. The strings are well-formed HTML, the build passed, and all
 *  19 live-site invariants passed — none of them fetches an og:image. The cost
 *  was silent and total: every link shared to WhatsApp or Slack rendered with
 *  no image, and `image` is a REQUIRED property of the Product rich result, so
 *  the structured data the entire AI-SEO thesis rests on was invalid on every
 *  product page.
 *
 *  Found 2026-08-10 by the designer during a design review — i.e. by someone LOOKING at
 *  the rendered artefact, which is the only way this class of defect surfaces.
 *  Same family as the R2 cutover reverting silently: a change of representation
 *  that every consumer must be re-checked against, and only some were. */
const abs = (p: string) => (/^https?:\/\//i.test(p) ? p : `${SITE_URL}${p}`);

/* ---------------------------------------------------------------- titles -- */

/** Brand + model when the product has one, otherwise the profile's own
 *  `card_title`. Never the raw `name` string. */
export const productName = (p: Enriched): string =>
  p.hasModel ? `${p.brandD} ${p.modelD}` : p.cardT;

/** The full identity line — what the <h1> says. */
export const productHeading = (p: Enriched): string =>
  p.hasModel ? `${p.cardT} ${p.modelD}` : p.cardT;

/** A page is in the CTR experiment only if it has a saving to state. See the
 *  eligibility section of `lib/experiment.ts` — putting `solo` and `parejo`
 *  pages in the control arm would fill it with pages that could not have been
 *  treated even in principle, and the two arms would stop being comparable. */
export const inTitleExperiment = (p: Enriched): boolean => p.band === 'brecha';

/** CONTROL — "Samsung RF29DB965012AP — ₡1.699.900 en Monge · Refrigeradoras en
 *  Costa Rica". Brand, model, the real cheapest price, the real chain, the
 *  category noun and the country: the exact shape of the long-tail query this
 *  page answers. Unchanged since the site shipped; this is the baseline. */
export function productTitleControl(p: Enriched): string {
  return `${productName(p)} — ${crc(p.lo.price_crc)} en ${p.lo.retailer} · ${
    p.catLabel
  } en Costa Rica`;
}

/** TREATMENT — "Samsung RF29DB965012AP: ahorrá ₡155.390 — ₡299.900 en Gollo".
 *
 *  ---- WHAT IT TRADES, STATED SO THE RESULT CAN BE READ HONESTLY ------------
 *  It BUYS the differentiator. The control states a price and a chain, which is
 *  precisely what the other results on that SERP state — a searcher scanning ten
 *  rows of "₡X en Y" has no reason to prefer ours. `ahorrá ₡155.390` is a claim
 *  no retailer can make, and it sits second, before the truncation point.
 *
 *  It PAYS by dropping `· Refrigeradoras en Costa Rica` — the category noun and
 *  the geo term. That is a real cost, and it is why this is a TEST rather than a
 *  fix: those terms may be carrying head-term impressions we cannot see at this
 *  volume. If the treatment arm's IMPRESSIONS fall while its CTR rises, the
 *  trade was bad and the read-out must say so — which is exactly why
 *  the daily SEO read-out reports impressions per arm and never CTR alone.
 *
 *  ---- LENGTH — MEASURED OVER ALL 355 ELIGIBLE PAGES, NOT ESTIMATED ---------
 *  Built both arms and counted, because a length claim from one worked example
 *  is exactly the kind of thing that turns out to be true only of the example:
 *
 *      treatment   median 57   mean 57   p90 62   max 81
 *      control     median 72   mean 72   p90 79   max 84
 *
 *  So it is ~15 characters shorter at the median and stops being truncated for
 *  most of the set. The long tail is real though — phone names carry a
 *  "256 GB de almacenamiento" suffix that eats the budget, and those treatment
 *  titles run past 80.
 *
 *  THE NUMBER THAT ACTUALLY MATTERS IS NOT LENGTH, IT IS POSITION: `ahorrá`
 *  starts at median character 20, p90 24, worst case 45 — so **100% of treatment
 *  titles show the saving before the ~60-character truncation point**, including
 *  the over-long ones. A title being cut off is survivable; the differentiator
 *  being cut off is not, and that is the property this design has to hold.
 *
 *  The model number stays FIRST regardless: it is the query match, and no amount
 *  of differentiation rescues a result that has stopped looking like the thing
 *  that was searched for. */
export function productTitleTreatment(p: Enriched): string {
  return `${productName(p)}: ahorrá ${crc(p.gapCrc)} — ${crc(p.lo.price_crc)} en ${p.lo.retailer}`;
}

/** The ONE call site every page, sitemap entry and JSON-LD node goes through, so
 *  an arm cannot be applied in one place and forgotten in another. With no
 *  experiment running `armOf()` returns 'control' and this is the control. */
export function productTitle(p: Enriched): string {
  return inTitleExperiment(p) && armOf(p.id) === 'treatment'
    ? productTitleTreatment(p)
    : productTitleControl(p);
}

export function productDescription(p: Enriched): string {
  /* THE LEAD IS THE COMPARISON; THE FRESHNESS STAMP IS THE TAIL, AND THE TAIL IS
     WHAT GIVES WAY when the budget runs out. Measured on the live
     /producto/samsung-hw-b450f-zp: 168 characters against ~155, with the
     overflow falling entirely inside `leído el 1 sep 2026, 6:25 a. m.` — six
     characters of clock that nobody choosing a search result reads, pushing the
     sentence past what Google shows.

     Three tails, longest first, and the shortest CANNOT overflow on its own. Same
     shape as categoryDescription: the budget is enforced rather than hoped for,
     because retailer names and prices vary in width and any fixed string fits
     some products and not others.

     `fecha()` ends in "p. m." — appending a full stop yields "p. m..". */
  const stamp = fecha(p.lo.scraped_at).replace(/\.$/, '');
  const tails = [
    `Precio de contado con IVA, leído el ${stamp}.`,
    `Precio de contado con IVA, leído el ${fechaDia(p.lo.scraped_at)}.`,
    'Precio de contado con IVA.',
  ];
  const body = p.band === 'brecha'
    ? `${p.lo.retailer} lo vende en ${crc(p.lo.price_crc)} y ${p.hi.retailer} en ${crc(
      p.hi.price_crc,
    )}: ${crc(p.gapCrc)} de diferencia por el mismo número de modelo.`
    : p.band === 'parejo'
      ? `Las ${p.nChains} cadenas cobran prácticamente lo mismo — ${crc(
        p.lo.price_crc,
      )} en ${p.lo.retailer}, ${crc(p.gapCrc)} de diferencia con ${p.hi.retailer}.`
      /* The second sentence used to read "Ninguna otra cadena lo tiene, así que
         no hay con qué comparar." — which restates the first clause at length.
         `Solo X publica` already says no other chain has it. That redundancy was
         what pushed this band to 157 characters: the longest body in the set,
         saying the least new. */
      : `Solo ${p.lo.retailer} publica este número de modelo en Costa Rica: ${crc(
        p.lo.price_crc,
      )}. No hay con qué comparar.`;
  for (const tail of tails) {
    const out = `${body} ${tail}`;
    if (out.length <= SNIPPET_MAX) return out;
  }
  /* LAST RESORT: the stamp goes rather than the budget. A description without a
     freshness date is merely less good; one that overflows is text written for
     nobody, and the body is the part that describes the product. */
  return body;
}

/** ~60 CHARACTERS IS THE BUDGET AND IT IS NOT A STYLE PREFERENCE — Google
 *  truncates a title around 600px, which is about 60 Latin characters, and
 *  everything past the cut is not shown to anyone.
 *
 *  THIS TITLE WAS 152 CHARACTERS UNTIL 2026-08-31. It enumerated all eleven
 *  chains — `precios de EPA, Gollo, Intelec, MExpress, Monge, Siman, Smart CR,
 *  Tienda Universal, Unimart, Vicortech y Walmart · 728 modelos` — so every one
 *  of the fifteen category pages, the site's most valuable head-term surfaces,
 *  was cut somewhere inside the chain list and the model count at the end was
 *  never rendered by anyone.
 *
 *  It is the SAME defect `siteTitle` was fixed for on 2026-08-29, when a 66-char
 *  title lost "Costa Rica" — the one market this site serves. That fix replaced a
 *  hardcoded list with a derived COUNT, and this does the same: the number of
 *  chains is the credible signal and it costs 2 characters instead of 96. The
 *  list itself is not lost — it is in the description and in the page's own lede,
 *  where there is room for it. */
export function categoryTitle(c: Category, n: number, retailers: string[]): string {
  /* `retailers` is still taken so every caller keeps its signature, and the chain
     count is still stated — in the DESCRIPTION, which has 155 characters to spend
     and is not truncated at 60. Worst case here is `Congeladores y frigobares`,
     the longest label in the catalogue, at 52. */
  void retailers;
  return `${c.label} en Costa Rica — ${n} modelos`;
}

export function categoryDescription(c: Category, items: Enriched[], retailers: string[]): string {
  const n = items.length;
  const comparables = items.filter((x) => x.band !== 'solo').length;
  const conBrecha = items.filter((x) => x.band === 'brecha').length;
  const cheapest = items.length
    ? [...items].sort((a, b) => a.lo.price_crc - b.lo.price_crc)[0]
    : null;
  /* THE SNIPPET LEADS WITH THE PRICE NOW. It opened with a
     model count and closed on `N tienen una brecha real de 5% o más` — an
     inventory figure followed by a dispersion statistic, in the 155 characters
     that decide whether anyone clicks. Neither is why a person searching
     "refrigeradoras precios costa rica" would pick us.
     `desde ₡X` is the click driver and it goes first; the chain list is the
     index answer ("where do I even look"); `por número de modelo` is the guard
     that keeps the comparison claim honest. The counts are gone. */
  void comparables; void conBrecha;

  /* THE COMMENT ABOVE SAID THE PRICE GOES FIRST. THE STRING PUT IT NINTH.
     `desde ₡62.138` was emitted AFTER the chain list, which landed it at roughly
     character 165 of a 285-character description — so the one element written to
     earn the click was the element Google truncated away. Measured on the live
     /categoria/pantallas, 285 chars against a ~155 budget.

     And it GREW: the list joined EVERY retailer name, so each new adapter made
     every category description on the site longer. Adding Coopeguanacaste took
     it from ~250 to 285, and being alphabetically first it also pushed the
     largest chains out of the visible window. A snippet composed by joining an
     unbounded list is a defect by construction, the same class as the spelled-out
     chain counts §2.8 already gates.

     So: price first, and the chain list is CAPPED and RANKED — ranked by how many
     of THIS category's products each shop actually carries, which is derivable
     from `items` and is the honest answer to "where do I even look" for this
     category, rather than the alphabet.

     The budget is ENFORCED rather than hoped for. Category labels differ by 20
     characters (`TV` vs `Congeladores y frigobares`), so a fixed number of named
     chains fits for some and overflows for others; naming one fewer until it fits
     is what makes this correct for every category and for every retailer added
     later. */
  const stock = new Map<string, number>();
  for (const it of items) {
    for (const o of it.offers) stock.set(o.retailer, (stock.get(o.retailer) ?? 0) + 1);
  }
  const ranked = [...retailers].sort(
    (a, b) => (stock.get(b) ?? 0) - (stock.get(a) ?? 0) || a.localeCompare(b, 'es'),
  );
  const price = cheapest ? ` desde ${crc(cheapest.lo.price_crc)}` : '';
  const build = (named: number, tail: string) => {
    const rest = ranked.length - named;
    // named = 0 drops every name and keeps the count, which is the last thing
    // worth saying about "where do I look" before the budget runs out.
    const list = named === 0
      ? `${ranked.length} tiendas`
      : rest > 0
        ? `${ranked.slice(0, named).join(', ')} y ${rest} tiendas más`
        : ranked.join(', ').replace(/, ([^,]*)$/, ' y $1');
    return `Precios de ${c.label.toLowerCase()}${price} en ${list}. ${tail}`;
  };
  const FULL = 'Compará por número de modelo y encontrá el más barato. Precios de contado con IVA.';
  const SHORT = 'Compará por número de modelo. Precios de contado con IVA.';
  /* THE LADDER RUNS ALL THE WAY DOWN, and it has to. Stopping at one named chain
     still overflowed `Congeladores y frigobares` (162) and `Refrigeradoras`
     (157) — measured, after the first version of this fix shipped a guarantee it
     did not actually keep. Category labels vary by 23 characters, so any fixed
     shape fits some categories and not others; only a ladder that ends in a
     value that CANNOT overflow is a guarantee rather than a hope. */
  for (const tail of [FULL, SHORT]) {
    for (let named = 3; named >= 0; named -= 1) {
      const out = build(named, tail);
      if (out.length <= SNIPPET_MAX) return out;
    }
  }
  return build(0, SHORT);
}

/** Google truncates a description around here. Not a style preference: text past
 *  it is written for nobody. */
const SNIPPET_MAX = 155;

/* ------------------------------------------------------------ structured -- */

type Json = Record<string, unknown>;

const availability = (inStock: boolean) =>
  inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';

/** The images the engine self-hosts, absolute. `og:image` uses the widest. */
export function productImages(p: Enriched): string[] {
  const set = (p.image_srcset ?? []).map((s) => abs(s.src));
  if (set.length) return set;
  return p.image ? [abs(p.image)] : [];
}

/** Product + Offer / AggregateOffer. This is what earns the price rich-result,
 *  and it is the reason every rule at the top of this file exists.
 *
 *  RETURNS `null` FOR A PRODUCT WITH NO IMAGE, AND THE CALLER MUST DROP IT.
 *  ------------------------------------------------------------------------
 *  Search Console, 2026-08-29: 2 new "Merchant listings" issues on vale.cr —
 *  critical `Missing field "image"`. `image` is REQUIRED for a merchant
 *  listing, so a Product node carrying `offers` and no image is not a weaker
 *  rich result, it is an INVALID one. 13 of 3,242 products (0.4%) are in that
 *  state, all from Smart CR and Vicortech.
 *
 *  The image cannot be sourced and this is not a scraper bug. Verified against
 *  the retailer on 2026-08-29: Shopify's own product record returns
 *  `"images": []` and `"image": null`, and the page's `og:image` is the STORE
 *  LOGO repeated on every product — which the engine already, correctly,
 *  refuses. There is no image to fetch.
 *
 *  So the choice is between claiming a merchant listing we cannot validly
 *  make and not claiming one. We do not claim it. What we deliberately do NOT
 *  do, and why:
 *    · a placeholder/logo image — that is the exact thing Smart CR does and
 *      the engine rejects it upstream; emitting it here would launder a value
 *      we threw away one layer down;
 *    · `noindex` on the page — the error is about a RICH RESULT, not about the
 *      page. The page is a real price comparison and still ranks. Deindexing
 *      3,242 - 13 pages' worth of good work over 13 is the wrong trade;
 *    · leaving the invalid node in place — 13 permanent criticals in Search
 *      Console is how the report becomes something nobody reads, and then the
 *      NEXT regression lands in noise. See
 *      `feedback_a_guard_that_logs_but_has_no_reader_is_not_a_guard`.
 *
 *  The page keeps its BreadcrumbList, its canonical, its og tags and its
 *  visible prices. Only the claim we cannot back is withdrawn.
 *
 *  A live-site audit asserts BOTH directions of this
 *  (every emitted Product node has an image; an image-less product emits no
 *  Product node). Do not relax this without relaxing that. */
export function productJsonLd(p: Enriched, meta: Meta): Json | null {
  const images = productImages(p);
  if (!images.length) return null;

  const url = abs(productPath(p.id));
  const offers = p.sorted.map((o) => ({
    '@type': 'Offer',
    url: o.url,
    priceCurrency: 'CRC',
    price: o.price_crc,
    availability: availability(o.in_stock),
    seller: { '@type': 'Organization', name: o.retailer },
  }));

  const node: Json = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: productHeading(p),
    description: productDescription(p),
    category: p.catLabel,
    url,
    offers:
      p.nChains > 1
        ? {
            '@type': 'AggregateOffer',
            priceCurrency: 'CRC',
            lowPrice: p.lo.price_crc,
            highPrice: p.hi.price_crc,
            offerCount: p.nChains,
            offers,
          }
        : offers[0],
  };

  node.image = images;
  if (p.brand) node.brand = { '@type': 'Brand', name: p.brandD };
  if (p.model) {
    node.mpn = p.model;
    node.sku = p.model;
  }

  // CR reviews only, and only where there are enough of them to be a claim.
  // See the header of this file — this is the single most load-bearing rule
  // in the module.
  const cr = p.reviews.cr;
  if (cr && cr.count >= 3) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: cr.average,
      reviewCount: cr.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  // Named so a reader of the raw JSON-LD can see what is deliberately absent.
  node.disambiguatingDescription =
    `Precios leídos en ${retailerNames(meta.retailers).join(', ')}. ` +
    'Las reseñas de Estados Unidos que muestra la página son de otro producto y nunca se publican como calificación de este.';

  return node;
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: abs(t.path),
    })),
  };
}

/** The category page's list — the first 60 only. An ItemList that claims 165
 *  entries it does not link in the first screen is padding. */
export function categoryJsonLd(c: Category, items: Enriched[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${c.label} en Costa Rica`,
    numberOfItems: items.length,
    itemListElement: items.slice(0, 60).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: abs(productPath(p.id)),
      name: productHeading(p),
    })),
  };
}

export function siteJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: 'es-CR',
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/buscar?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/* ORGANIZATION — the entity block, and the one piece of structured data aimed at
   an answer engine rather than a blue link.
 *
 * Why it earns its bytes: an LLM asked "which site compares appliance prices in
 * Costa Rica" is doing entity resolution, not ranking. Without this it sees a
 * hostname; with it there is a named organisation with a stated area served, a
 * stated method and a stated business model. `@id` is stable so every other
 * node on the site can point at one entity instead of restating it.
 *
 * Every claim here is one the site can defend on /metodologia. `knowsAbout` is
 * COMPOSED from the live category labels for the same reason the niche copy is
 * — it cannot outlive a category we drop. */
export function organizationJsonLd(cats: Category[], meta: Meta): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    description:
      `${SITE_NAME} compara precios de ${nicheNouns(cats)} entre ${meta.retailers.length} ` +
      `cadenas de Costa Rica. Los precios se leen a diario directamente de los sitios de ` +
      `cada cadena y el método está publicado.`,
    areaServed: { '@type': 'Country', name: 'Costa Rica' },
    knowsAbout: cats.map((c) => c.label),
    // We are a comparator, not a merchant. Saying so in the graph prevents an
    // answer engine from presenting us as a place to buy.
    isAccessibleForFree: true,
    publishingPrinciples: `${SITE_URL}/metodologia`,
  };
}

/* ==========================================================================
   BRAND SURFACES — see lib/brands.server.ts for why these pages exist and what
   floors decide which ones get built.
   ========================================================================== */

export const brandPath = (brandSlug: string) => `/marca/${brandSlug}`;
export const brandCategoryPath = (brandSlug: string, categoryId: string) =>
  `/marca/${brandSlug}/${categoryId}`;

/** `Lavadoras Samsung en Costa Rica — precios en Monge, Gollo y Unimart · 45 modelos`
 *
 *  BRAND FIRST IN THE STRING, CATEGORY SECOND, because the query is
 *  "lavadoras samsung" far more often than "samsung lavadoras" and the head of a
 *  title carries the weight. The chain list is what the category title already
 *  does and is the one thing on the page a competitor cannot copy. */
export function brandCategoryTitle(
  brandLabel: string, c: Category, n: number, retailers: string[],
): string {
  /* Category then brand, because the query is "lavadoras samsung" far more often
     than the reverse and the head of a title carries the weight. Set ABSOLUTE by
     the route so the layout's ` · Vale` template does not add 7 characters to a
     string that is already at 63 in its worst case. */
  void retailers;
  return `${c.label} ${brandLabel} en Costa Rica — ${n} modelos`;
}

/** THE SNIPPET LEADS WITH THE PRICE, the same call `categoryDescription` makes:
 *  a person searching "lavadoras samsung precios" is asking what it costs, and
 *  the 155 characters that decide the click should answer that rather than
 *  report an inventory size. */
export function brandCategoryDescription(
  brandLabel: string, c: Category, items: Enriched[], retailers: string[],
): string {
  const chains = retailers.join(', ').replace(/, ([^,]*)$/, ' y $1');
  const cheapest = items.length
    ? [...items].sort((a, b) => a.lo.price_crc - b.lo.price_crc)[0]
    : null;
  const from = cheapest ? `Desde ${crc(cheapest.lo.price_crc)}. ` : '';
  return `${from}Comparamos ${items.length} ${c.label.toLowerCase()} ${brandLabel} `
    + `por número de modelo en ${chains}. Precios de contado con IVA incluido, `
    + 'actualizados a diario.';
}

export function brandTitle(brandLabel: string, n: number): string {
  return `${brandLabel} en Costa Rica — precios de ${n} modelos`;
}

export function brandDescription(brandLabel: string, n: number, cats: string[]): string {
  const list = cats.join(', ').replace(/, ([^,]*)$/, ' y $1');
  return `Precios de ${n} productos ${brandLabel} en Costa Rica: ${list}. `
    + 'Comparamos por número de modelo exacto, con IVA incluido, en las principales '
    + 'cadenas del país.';
}
