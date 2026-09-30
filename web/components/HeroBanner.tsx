/* THE HOME HERO — v8. Figma 6:43 · 14:4 · the photograph is 16:940.

   ---- WHAT THIS REPLACES --------------------------------------------------
   `HeroBanner` v7.2 — option B, "el índice": no photograph, six category tiles
   under a two-tone headline, chosen by the owner on 2026-08-27 for a reason that is
   worth keeping on the record even though the object is gone:

     > "In Costa Rica it's not only comparing the prices. It's still a place
     > where it's hard to know. You want to buy a grill — it's hard to know
     > where to go to look. So it's not only price comparison, it's also an
     > INDEX."

   THAT ARGUMENT IS NOT REVERSED BY THIS DESIGN; IT MOVED DOWN ONE BAND. The
   six ways into the catalogue are still the first thing under the fold — they
   are the category scroller (6:79, `CategoryRail`) — and the browsing grid
   below the first product rail adds seven more. What changed is that the index
   is no longer asked to be the headline as well.

   The photograph is the other half of the 2026-08-27 conversation: The owner asked
   then for "something colourful with a lifestyle photograph" and option B
   shipped without one only because no image had been bought. One has now been
   made, so the constraint that picked the photo-less option is gone.

   ---- THE h1 --------------------------------------------------------------
   The document's only h1, and it is a QUESTION carrying no keywords. That is
   deliberate and safe: `<title>` already reads "Vale — comparador de
   electrodomésticos y electrónica en Costa Rica" and that is what a search
   engine weighs on a home page. The head terms are in the sentence below,
   where they read as a description of the service rather than as a string
   stuffed into a heading.

   Both lines are ONE h1 — the second is a <b> block, not an <h2>. Splitting
   "¿Dónde se compra / y a cómo?" across two headings would put half a question
   into the document outline.

   ---- ONE CLAIM HERE IS COPY, NOT A READING ----------------------------
   Badge 1 says "Precios actualizados a diario". That is a claim about the
   PIPELINE'S CADENCE and this component does not measure it — unlike
   `freshShort`/`freshLong`, which are composed from `meta.price_freshness` and
   can only say what the artifact proves. The precise per-offer reading is in
   the footer on this page and in the freshness strip on every other template.
   Flagged because the distinction is exactly the one v3 got wrong when the
   chrome printed `meta.generated_at` — the export time — as if it were the
   scrape time, and was false for 16% of the catalogue. */

import Image from 'next/image';

import s from './HeroBanner.module.css';

/* The three discs are 38px circles at 12% alpha with nothing inside them
   (14:40 / 14:43 / 14:46). Their hues are the ONE set of colours in the product
   that do not live in tokens.css, and that is deliberate rather than sloppy:
   they are three decorative fills that encode nothing, carry no text, and would
   pollute the token file with a blue and a green the palette does not otherwise
   contain. They are stated once, here, next to the only thing that uses them. */
const BADGES = [
  { disc: 'rgba(59, 130, 245, 0.12)', lines: ['Precios', 'actualizados', 'a diario'] },
  { disc: 'rgba(41, 181, 92, 0.12)', lines: ['Tiendas', 'confiables', 'y reconocidas'] },
  { disc: 'rgba(242, 158, 18, 0.12)', lines: ['Compara', 'fácil y rápido', 'en segundos'] },
] as const;

export function HeroBanner() {
  return (
    <section className={s.hero} aria-labelledby="hero-h">
      <div className={s.in}>
        <div className={s.left}>
          <h1 className={s.head} id="hero-h">
            ¿Dónde se compra
            <b>
              y a cómo?
              <span className={s.swoosh} aria-hidden="true" />
            </b>
          </h1>

          <p className={s.blurb}>
            Comparamos precios de electrodomésticos y electrónica en las tiendas
            más grandes de Costa Rica. No solo dónde sale más barato — también
            quién lo vende.
          </p>

          <ul className={s.badges}>
            {BADGES.map((b) => (
              <li
                key={b.lines[0]}
                className={s.badge}
                style={{ '--disc': b.disc } as React.CSSProperties}
              >
                <span className={s.disc} aria-hidden="true" />
                {/* the three lines are the Figma's own break points, kept
                    because they are what makes three badges align on one
                    baseline grid rather than ragging at 1, 2 and 3 lines */}
                <span className={s.label}>
                  {b.lines.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className={s.art}>
          {/* PRIORITY, and it is the only image in the product that gets it:
              this is the LCP element on the most-linked page. `sizes` is the
              grid's own 61% share, so a phone never downloads the 1782px asset.

              The alt text names what the picture is FOR rather than listing the
              appliances in it: a screen-reader user gets "the categories this
              site compares", which is the information the photograph carries,
              not an inventory of a still life. */}
          <Image
            src="/hero-electronics.png"
            alt="Electrodomésticos y electrónica de las categorías que compara Vale: lavadora, refrigeradora, televisor, laptop y freidora de aire."
            width={891}
            height={495}
            priority
            sizes="(max-width: 900px) 100vw, 61vw"
          />
        </div>
      </div>
    </section>
  );
}
