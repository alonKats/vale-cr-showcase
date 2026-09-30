/* THE PRODUCT BODY — ONE IMPLEMENTATION, TWO TEMPLATES, TWO FRAMES.

   THIS FILE IS IMPORTED BY BOTH `app/producto/[slug]/page.tsx` AND
   `app/@modal/(.)producto/[slug]/page.tsx` AND MUST NEVER BE FORKED. seo-check.mjs
   gate 4 proves the in-app overlay renders at the canonical URL — one address per
   product, no duplicate-content twin — and that proof rests entirely on the two
   routes rendering the SAME component. Forking it during a rewrite is the one way
   this redesign silently breaks the most valuable thing in the repo.

   ---- THE TWO TEMPLATES (§1) ----

   T3 · comparable  ·   257 products (11.8%) · `nChains > 1`
        Answer WHERE and HOW MUCH LESS, then let the user audit the claim.
        Regions: id/shot/best → Precios (OfferTable + history) → Ficha → Similares
                 → Sucursales → method

   T4 · single-offer · 1.913 products (88.2%) · `nChains === 1`
        Answer WHAT IS THIS and IS THERE SOMETHING BETTER — and state that
        comparison is impossible.
        Regions: id/shot/only → Ficha (PROMOTED to primary) → Similares (PROMOTED
                 from last tab) → Sucursales → method

   T4 IS NOT "T3 WITH THE TABLE HIDDEN". That is the whole reason it has its own
   template: on T3 the offer table is the primary region and eats the lower two
   thirds of the page; on T4 THAT REGION DOES NOT EXIST. zap renders their
   single-offer products as the ordinary card with the comparison badges silently
   absent (verified on Epson EH-LS300) — nothing tells the user why. We promote the
   spec table and similar products into the vacated space and say the limitation out
   loud. THREE DIFFERENCES, ALL NEEDING ZERO NEW DATA COLLECTION.

   WHAT T4 MUST NEVER DO, and every one is enforced in code rather than remembered:
     · an empty offer table            → the region is not rendered at all
     · an empty `Precios (1)` tab      → the tab is ABSENT, not disabled
     · a `MÁS BARATO` flag             → `Flag` returns null on nChains <= 1
     · a `1 tienda` count styled like a comparison result
     · a US star rating as this product's rating → `ReviewsUS` names the other
       product and says, in words, that it is not this one's rating

   The only difference between the two FRAMES is which node is the <h1>: on the page
   the heading is the product's identity (that is what the document is about); in the
   dialog the verdict keeps it, because the dialog's accessible name is the product
   and its heading is the answer. Zero visual difference.

   Not a client component: no state, no handlers. Keeping it server-renderable is the
   whole point — a component with `'use client'` here would still render its HTML, but
   every hook it grew afterwards would quietly become a hydration cost on a page whose
   job is to be readable with JS off. */

import { attrText, LUGAR } from '@/lib/display';
import { canMultiply } from '@/lib/blend';
import { dec, fecha, markupChip, mil, usdRange } from '@/lib/format';
import type { Branch, Category, Enriched, NearestBranch, ProductHistory } from '@/lib/types';
import { BranchPanel } from './BranchPanel';
import { OfferTable } from './OfferTable';
import p from './primitives.module.css';
import { PriceHistory } from './PriceHistory';
import s from './Product.module.css';
import { Icon, type IconName } from './Icon';
import { MiniCard } from './ProductCard';
import { SpecTable } from './SpecTable';
import { EEUU } from './ui';
import { METHOD_ID, Verdict, VerdictPlate } from './VerdictPlate';

export { METHOD_ID };

/* see the quick-spec list below: these annotate position, not meaning */
const KEY_ICONS: IconName[] = ['settings', 'box', 'check'];

export interface DetailData {
  product: Enriched;
  nearest: Map<string, NearestBranch>;
  /** every branch of every chain. `BranchPanel` groups them by cantón; the panel
   *  needs the raw records rather than `nearest`, which is one branch per chain. */
  branches: Branch[];
  /** same category, same brand first, then price proximity. Composed by
   *  `similarTo()` in lib/catalog.ts, so the page and the overlay rank identically. */
  similar: Enriched[];
  fx: number;
  /** Date.parse(meta.generated_at) — the basis every freshness tier is measured
   *  against, so the page and the overlay never disagree about the same URL. */
  now: number;
  history?: ProductHistory;
  profile?: Category;
  /** v7 §10.1 — `observation_window.distinct_days`. The price-history meter's
   *  denominator. It travels as a prop rather than being read inside the component
   *  because `PriceHistory` renders in BOTH frames and the overlay reads the same
   *  artifact from the client — one value, two frames, no second source. */
  windowDays?: number | null;
  /** §2.1 — `0 → this` is the domain EVERY spread bar in the product is drawn on.
   *  `meta.gap_distribution.max_gap_pct`, asserted against the catalogue in
   *  lib/gaps.server.ts. A bar that rescales to its own product is a lie (§2.5). */
  axisMaxPct: number;
}

export function Detail({
  product, nearest, branches, similar, fx, now, history, profile, windowDays, axisMaxPct, frame,
}: DetailData & { frame: 'page' | 'sheet' }) {
  const { lo } = product;
  const onPage = frame === 'page';
  const comparable = product.nChains > 1;
  const srcset = (product.image_srcset ?? []).map((x) => `${x.src} ${x.w}w`).join(', ');

  /* The `id` column's three key attributes — the first three the profile declares
     that this product actually carries. No category-specific code: the labels, the
     units and the enum value labels all come off `CategoryProfile`. */
  const keyAttrs = (profile?.attributes ?? [])
    .filter((a) => {
      const v = product.attributes?.[a.key];
      return v !== null && v !== undefined && v !== '';
    })
    .slice(0, 3);

  /* v4.1-FIX N8 — THE HEADING CARRIES THE PRODUCT'S NAME AND NEVER ITS MODEL NUMBER.
     It was `cardT + modelD`, which measured 78px over two lines at 1440 and put the
     BARE SKU alone on line two at 390 — half of the largest type on the page spent on a
     part number. The SKU renders on the 12px meta line below instead, where it is a
     caption rather than a headline, and it already renders at 12px on every offer row.

     `seo-check.mjs` asserts the model number is present in the HTML of every product
     page; the meta line is what keeps that true on T4, which has no offer table.
     Wording beyond the bare number is the copywriter's. */
  const identity = product.cardT;

  /* ---- v7 §7.1 T4-4 — ON T4, `Modelos parecidos` MOVES TO POSITION 2 ----
     Measured on the live T4 census: the ONLY section on the page with real
     content was `Modelos parecidos`, and it rendered THIRD, under a spec table
     half of whose cells said `Sin dato`. On a single-offer product the similar
     grid is not reference data — IT IS THE ONLY COMPARISON THE PAGE CAN OFFER,
     which is the whole reason T4 exists as its own template. It now sits
     directly under the plate that has just said there is nothing to compare.

     T3 IS UNCHANGED, deliberately: there the offer table answers the question
     and similar products are genuinely reference data, so the order stays
     Precios → Ficha → Similares. One template's finding is not the other's — the
     region ORDER is the difference between the two templates (v3 §2.24), and
     reordering both would flatten that back into one page with a hidden table.

     The two regions are bound to consts rather than duplicated: `Detail` is
     imported by BOTH the canonical route and the overlay and must never fork,
     and two copies of a 60-line section is how a fork starts. */
  /* ---- T4 PRIMARY (and T3's second region): Ficha técnica ----
          On T4 this is the primary region: nothing to compare, so show everything
          about the one thing. The reviews live INSIDE it — never as a headline count
          and never as this product's rating. */
  const ficha = (
                <section className={s.sec} id="ficha">
          <h2 className={s.secH}>Ficha técnica</h2>
          <SpecTable product={product} profile={profile} />
          {!comparable ? <PriceHistory history={history} windowDays={windowDays} /> : null}

          {/* ---- RESEÑAS — v6.1 §5.4. FOUR SENTENCES AND TWO PANELS BECAME ONE LINE
               ON THE 4.164 OF 4.254 PAGES (98%) WHERE THERE IS NOTHING TO SHOW.

               What was here, verbatim, in order:
                 1. Ninguna cadena tica ha publicado reseñas de este modelo.
                 2. No encontramos un modelo similar en EE. UU. con reseñas.
                 3. Las reseñas de CR y las de EE. UU. nunca se mezclan ni se promedian…
                 4. No encontramos un modelo similar en EE. UU., así que no le mostramos
                    un porcentaje.                               (USChip's empty branch)

               (2) and (4) are the same sentence twice. (3) is a policy about mixing
               two things NEITHER OF WHICH EXISTS ON THIS PAGE — a rule justifying an
               absence of an absence — and it already survives where a policy belongs,
               on /metodologia §"Las reseñas de Estados Unidos". So nothing is
               withdrawn here: one claim is stated once, and the mixing policy is
               stated where it is true of something.

               WHEN THERE IS DATA IT IS NOT COLLAPSED. The heading and the panels
               render for the 90 products that carry a real review record, and only the
               absent HALF becomes a clause. §5.7's rule is that every cut is a
               repetition or an explanation of an absence — never a fact.

               `[data-us-panel]` IS A GATE HOOK AND IT HAD TO SURVIVE THE CUT.
               seo-check.mjs assertion 5 fails a product page with ZERO US panels
               (a gate that measures nothing must fail), and deleting the empty
               `ReviewsUS` card would have removed the only hook on 98% of pages.
               `ReviewsNote` carries it whenever the sentence is about the US. */}
          {product.reviews.cr || product.reviews.us ? (
            <>
              <h3 className={s.subH}>Reseñas</h3>
              <div className={s.rev}>
                {product.reviews.cr ? <ReviewsCR product={product} /> : null}
                {product.reviews.us ? <ReviewsUS product={product} /> : null}
              </div>
            </>
          ) : null}
          <ReviewsNote product={product} />
          <USChip product={product} />
        </section>
  );

  /* ---- Similares ----
          On T3 this is reference data. ON T4 IT IS THE ONLY COMPARISON THE PAGE CAN
          OFFER, so it is promoted from the last tab to the primary region below the
          fold and rendered expanded.

          T5 (the attribute-level CompareMatrix) IS DEFERRED IN WAVE 1, so this
          renders as a ProductCard grid — which §4.5 explicitly sanctions as
          `SimilarGrid`: "a ProductCard grid with a heading — no component needed".
          That is the lazy-first reading of the deferral, not a substitution for it.

          If fewer than 2 similar products exist the block RENDERS THE COUNT IT
          ACTUALLY HAS and does not pad. */
  const similares = (
                <section className={s.sec} id="similares">
          {/* v7 §5.2 C4 — THE QUALIFIER SURVIVES, SHORTENED, AS AN EYEBROW. It used
              to be the tail of a two-line paragraph ("No es el mismo producto: es la
              comparación más cercana que los datos permiten"), which is the heading's
              own word `parecidos` explained back to the reader. The claim is
              load-bearing — this grid is the ONLY comparison a single-offer page can
              offer, and a reader must not take it for a price comparison of the same
              model — so it is not deleted, it is promoted to the one place a reader
              cannot skip: above the heading, in the eyebrow role --t1 already owns.
              The count keeps its own line, because a count is a fact and the eyebrow
              is a caveat. */}
          <p className={s.eyebrow}>No es el mismo producto</p>
          <h2 className={s.secH}>{comparable ? 'Modelos parecidos' : 'Lo más parecido que tenemos'}</h2>
          {similar.length ? (
            <>
              <p className={s.note}>
                {similar.length}{' '}
                {similar.length === 1
                  ? 'modelo de la misma categoría'
                  : 'modelos de la misma categoría'}
                {!comparable ? ', porque este número de modelo no se puede comparar' : ''}.
              </p>
              <ul className={s.simGrid}>
                {similar.map((x) => (
                  <MiniCard key={x.id} product={x} />
                ))}
              </ul>
            </>
          ) : (
            <p className={s.note}>
              No tenemos otro modelo de {product.catLabel.toLowerCase()} suficientemente parecido para
              ponerlo al lado de este.
            </p>
          )}
        </section>
  );

  return (
    <div className={s.body}>
      {/* ---- HEADER: id / shot / best|only ----
          `1fr 340px 300px` at 1440, `1fr 260px 280px` at 1024, stacked
          shot → id → best at 390. zap's header split is the smart part of their
          product page — the IDENTITY on one side, the BEST OFFER AS A STANDING CARD
          on the other — and it is copied exactly. */}
      <div className={s.heroBand}>
      <div className={s.hdr}>
        <div className={s.id}>
          <p className={s.cat}>{product.catLabel}</p>
          {onPage ? <h1 className={s.h}>{identity}</h1> : <p className={s.h}>{identity}</p>}
          {/* The overlay's <h1> is the verdict, not the identity — see the header. */}
          {!onPage ? (
            <h1 className={p.sr}>
              <Verdict product={product} />
            </h1>
          ) : null}

          {/* N8 — the SKU's new home. `hasModel` false means no chain publishes one, so
              there is nothing to print and no placeholder is invented. */}
          {product.hasModel ? <p className={s.sku}>{product.modelD}</p> : null}

          {/* NO STAR ROW. zap's `id` column carries a rating and a review count. We
              have no store ratings for any of our 8 chains, and the only review data
              we hold for most products is a US record for a DIFFERENT product. A star
              row here would be the most misleading object we could build, so it does
              not exist — not as an empty state, not as a placeholder. */}
          <ul className={s.keys}>
            {keyAttrs.map((a, i) => (
              <li key={a.key}>
                {/* 17:341/344/347 use settings · box · check, in that order, for
                    the three quick specs. They annotate POSITION, not meaning —
                    there is no per-attribute glyph vocabulary and inventing one
                    would mean a lookup table nobody maintains — so the row index
                    picks them and the text carries the fact. */}
                <Icon name={KEY_ICONS[i] ?? 'check'} size={16} />
                {attrText(a, product.attributes[a.key] as string | number)}
              </li>
            ))}
          </ul>

          <a className={s.jump} href="#ficha">
            Ver ficha técnica completa ›
          </a>
        </div>

        {/* The band is 120–728, not 120–340: at ≥768 the shot is a fixed 260/340
            header column, and BELOW 768 it stacks to the full shell — 728 is that
            shell at the widest stacked viewport. The upper bound is still doing real
            work: it asserts the box never escapes the shell, which is exactly the
            defect the gate caught here before `.body` got an explicit
            `minmax(0, 1fr)` track. */}
        <div className={s.shot} data-scales="product-shot" data-band-min="120" data-band-max="728">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- self-hosted pre-sized webp; next/image would re-encode assets the engine already produced at exactly 160/320/640
            <img
              className={canMultiply(product.image) ? p.blend : p.flat}
              src={product.image}
              srcSet={srcset || undefined}
              sizes="(max-width: 767px) 90vw, 340px"
              alt={`${product.brandD} ${product.modelD}`}
              loading="eager"
              decoding="sync"
            />
          ) : (
            <span className={p.mono} aria-hidden="true">
              {product.brandD.charAt(0)}
            </span>
          )}
        </div>

        {/* T3 → the verdict. T4 → the statement. One component, two variants. */}
        <div className={s.plateSlot}>
          <VerdictPlate product={product} axisMaxPct={axisMaxPct} />
        </div>
      </div>
      </div>

      {/* v7 §5.2 C5 — `SALTAR A:` IS DELETED, AND THE CULL IS WHAT EARNS IT.
          A jump nav on a product page is a confession that the page is too long;
          shortening the page is the fix, and a nav that survives the cull is a nav
          for four sections on a ~2.400px document. It cost ~48px at 390 — on the
          fold, immediately under the plate — and it was the last remnant of the tab
          strip B4 already had to disarm once (a control styled as a tab set,
          behaving as a jump link, indicating nothing in either state).

          NOTHING IT POINTED AT MOVED OR HID. Every section still renders, still
          carries its `id`, and is still reachable by anchor from anywhere else in
          the product — including `Cómo comparamos ›` inside the plate, which is the
          one in-page jump a reader has an actual reason to take. `Tabs.tsx` and its
          stylesheet are left in the repo untouched: /buscar and the category
          templates are not in Wave 1's scope and deleting a shared component to
          remove one call site is out of scope for a fold fix. */}

      {/* ---- T3 PRIMARY: Precios ----
          Region order is load-bearing and unchanged from v3 §2.24: the verdict
          answers *where*, history answers *when*, the ledger is reference data and
          goes last. zap's own order agrees. */}
      {comparable ? (
        <section className={s.sec} id="precios">
          <h2 className={s.secH}>Precios en cada cadena</h2>
          <OfferTable product={product} nearest={nearest} now={now} />
          <PriceHistory history={history} windowDays={windowDays} />
        </section>
      ) : null}

      {comparable ? (
        <>
          {ficha}
          {similares}
        </>
      ) : (
        <>
          {similares}
          {ficha}
        </>
      )}

      {/* ---- Dónde comprar ---- */}
      <section className={s.sec} id="sucursales">
        <h2 className={s.secH}>Dónde comprar</h2>
        <BranchPanel product={product} branches={branches} />
      </section>

      {/* ---- v7 §5.2 C1 — `Cómo comparamos`: ~12 LINES OF PROSE BECOME FOUR
              CHECKABLE VALUES. THE STRONGEST CULL IN THE PASS, AND NOT ONE CLAIM IS
              WITHDRAWN.

              zap has no equivalent region and their Terms state that comparisons are
              ordered at their SOLE DISCRETION, with no disclosed methodology and no
              affiliate disclosure. This region is the opposite and it stays — it is
              why the method link sits inside the plate rather than in the footer.
              What changes is its FORM.

              THE RULE C1 APPLIES: a reader can check a number; they cannot check a
              paragraph. Every claim the prose made survives AS THE VALUE IT ASSERTS —
              the exchange rate with its source, the tax basis, the matching key, the
              read time — so the region gets MORE auditable, not less, while ~346px of
              small print on 4.338 pages becomes four rows and a link.

              WHAT MOVED RATHER THAN DIED, and where, because "it is on /metodologia"
              has to be true rather than convenient:
                · the US-reference arithmetic (net of IVA, midpoint of the US range) —
                  /metodologia §"Las reseñas de Estados Unidos" and §"El precio de
                  EE. UU.". It qualifies a figure that renders ~600px above this, and
                  `USChip` already carries its own qualifier inline.
                · "Distancias medidas desde <LUGAR>, que es un supuesto" — it belongs
                  to the branch panel, which is the only thing on the page that states
                  a distance, and `BranchPanel` prints the assumption there.
                · "La existencia es por cadena: ninguna publica inventario por
                  sucursal…" — same region, same reason, and it is now said beside the
                  branch list it is about instead of 350px below it.
              None of the three is a fact about THIS product; all three are policy,
              and §5.3's rule is that a policy claim lives once, where it is true of
              something. `Cómo comparamos ›` in the plate still lands here, and this
              block still links on to the full method. ---- */}
      <section className={s.sec} id={METHOD_ID}>
        <h2 className={s.secH}>Cómo comparamos</h2>
        <dl className={s.facts}>
          <div className={s.fact}>
            <dt>Precio leído</dt>
            <dd>{fecha(lo.scraped_at)}</dd>
          </div>
          <div className={s.fact}>
            <dt>Impuesto</dt>
            <dd>Precio de contado, 13% de IVA incluido</dd>
          </div>
          {/* THE MATCHING KEY IS A VALUE, AND IT IS THE ONE ROW THAT MAY NOT BE
              INVENTED. `modelD` falls back to the STRING "Modelo no publicado" for
              the 568 products that publish none, so an unconditional row would print
              "Comparado por número de modelo: Modelo no publicado" — a claim that it
              matched on a value it has just said does not exist. The row states what
              is true in each case and nothing more. */}
          <div className={s.fact}>
            <dt>Comparado por</dt>
            <dd>
              {product.hasModel
                ? `Número de modelo ${product.modelD}, no productos parecidos`
                : 'Ninguna cadena publica un número de modelo para este producto'}
            </dd>
          </div>
          <div className={s.fact}>
            <dt>Tipo de cambio</dt>
            <dd>
              ₡{dec(fx, 2)} / US$1 · BCCR
            </dd>
          </div>
        </dl>
        <a className={s.jump} href="/metodologia">
          Cómo comparamos, en detalle ›
        </a>
      </section>
    </div>
  );
}

/* THE COLLAPSED RESEÑAS LINE (v6.1 §5.4) — one sentence, three reachable shapes,
   and the punctuation is the reason they are three branches rather than one
   composed string.

   `EE. UU.` ENDS IN A FULL STOP. A composed version that appends "." after the
   abbreviation prints "EE. UU..", which is the exact defect `lib/format.ts`
   documents for `fecha()`'s "p. m.". Branching costs six lines and cannot get it
   wrong at any input.

   The `data-us-panel` hook rides on the two branches that say something about the
   United States, and only those — it marks a US-REFERENCE region for seo-check's
   type ceiling, and putting it on a sentence about Costa Rican reviews would be
   marking the wrong thing. */
function ReviewsNote({ product }: { product: Enriched }) {
  const noCr = !product.reviews.cr;
  const noUs = !product.reviews.us;
  if (!noCr && !noUs) return null;

  if (noCr && noUs) {
    return (
      <p className={s.note} data-us-panel>
        Ninguna cadena tica publica reseñas de este modelo, y no encontramos uno equivalente en{' '}
        <EEUU />
      </p>
    );
  }
  if (noUs) {
    return (
      <p className={s.note} data-us-panel>
        No encontramos un modelo equivalente en <EEUU /> con reseñas.
      </p>
    );
  }
  return <p className={s.note}>Ninguna cadena tica publica reseñas de este modelo.</p>;
}

/* THE US REFERENCE, as an outline chip.

   Where the US reference is a Tier-2 similar-models range — which is what
   `candidate_count > 1` means — PRINT THE RANGE AND THE QUALIFIER, NEVER A HARD
   PERCENTAGE ALONE. The price comparison and the US review reference are separate
   claims and must not be reasoned about as one. */
function USChip({ product }: { product: Enriched }) {
  const u = product.us_reference;
  /* v6.1 §5.4 CUT — the "no encontramos un modelo similar en EE. UU." sentence
     used to render here as well as in the reviews block, ~600px apart, on 4.188
     of 4.254 pages. `ReviewsNote` says it once. NOTHING REPLACES IT: the absence
     of a US reference is now stated exactly once per page. */
  if (!u) return null;
  /* NOT the same absence, and it does not collapse into the one above: we HAVE a
     reference and cannot express it as a percentage. Zero products are in this
     state in today's artifact, which is precisely why it is stated rather than
     assumed away — the branch that never fires is the one that ships wrong. */
  if (product.markup_pct === null) {
    return (
      <p className={s.note} data-us-panel>
        Tenemos una referencia de <EEUU /> para este modelo, pero no un precio comparable, así que no
        le mostramos un porcentaje.
      </p>
    );
  }
  const chip = markupChip(product.markup_pct);
  return (
    /* `data-us-panel` IS A GATE HOOK, NOT A STYLING HOOK (B2). seo-check.mjs asserts no
       node inside a US-reference region computes a font-size above --t2, so a borrowed
       figure can never again outrank the sentence qualifying it. It sits on both US
       regions — this chip and the reviews card. */
    <div data-us-panel className={chip.cheaper ? `${s.us} ${s.usDown}` : s.us}>
      <span className={s.usN}>{chip.figure}</span>
      <span>
        {chip.words} que en <EEUU /> — {u.source} {usdRange(u.price_usd_min, u.price_usd_max)}
        {/* A SENTENCE BREAK, NOT A SEPARATOR. This clause used to hang off a ` · ` and
            at 390 that separator ended a line with nothing after it, on all 2.178
            pages. A full stop cannot dangle. */}
        {u.candidate_count > 1 ? (
          <>. Referencia aproximada: {u.candidate_count} modelos parecidos, no este número de modelo</>
        ) : null}
      </span>
    </div>
  );
}

/* An average from n=2 rendered as a bare star score would mislead — most of the CR
   averages in this dataset are exactly 5,0 off one or two reviews. The count is
   therefore always adjacent and always the same visual weight. The same threshold
   gates the JSON-LD `aggregateRating` (lib/seo.ts). */
function ReviewsCR({ product }: { product: Enriched }) {
  const cr = product.reviews.cr;
  if (!cr) {
    return (
      <div className={`${s.revC} ${s.revEmpty}`}>
        <p className={s.revZ}>Reseñas · Costa Rica</p>
        <p className={s.revA}>Ninguna cadena tica ha publicado reseñas de este modelo.</p>
      </div>
    );
  }
  return (
    <div className={s.revC}>
      <p className={s.revZ}>Reseñas · Costa Rica</p>
      <p className={s.revA}>
        {dec(cr.average)}
        <span className={s.revOf}> / 5</span>
      </p>
      <p className={s.revSrc}>
        de <span className={s.revN}>{mil(cr.count)}</span> {cr.count === 1 ? 'reseña' : 'reseñas'} en{' '}
        {cr.source}
        {cr.count < 3 ? ' — muy pocas para sacar un promedio confiable' : ''}
      </p>
    </div>
  );
}

/* A US RATING IS NEVER THIS SKU'S RATING. The record carries the title of the product
   that was actually rated and the UI names it. Rendering the number without that
   sentence would be dishonest — and it is why no US figure ever reaches the JSON-LD
   (lib/seo.ts, asserted product-by-product by seo-check.mjs). */
function ReviewsUS({ product }: { product: Enriched }) {
  const us = product.reviews.us;
  if (!us) {
    return (
      <div data-us-panel className={`${s.revC} ${s.revEmpty}`}>
        <p className={s.revZ}>
          Reseñas · <EEUU />
        </p>
        <p className={s.revA}>
          No encontramos un modelo similar en <EEUU /> con reseñas.
        </p>
      </div>
    );
  }
  return (
    <div data-us-panel className={s.revC}>
      <p className={s.revZ}>
        Reseñas · modelo similar en <EEUU />
      </p>
      <p className={s.revA}>
        {dec(us.average)}
        <span className={s.revOf}> / 5</span>
      </p>
      <p className={s.revSrc}>
        de <span className={s.revN}>{mil(us.count)}</span> reseñas en {us.source}, sobre este otro
        producto: <b className={s.revTitle}>{us.us_title}</b> No es esta unidad y no es su
        calificación.
      </p>
    </div>
  );
}
