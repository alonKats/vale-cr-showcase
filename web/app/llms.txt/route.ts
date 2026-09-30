/* /llms.txt — the site, addressed to an answer engine rather than a crawler.
   ==========================================================================

   WHAT IT IS. A convention (llmstxt.org, 2024) for a plain-Markdown file at the
   site root that states what a site is, what it can be trusted to answer, and
   where the answers live — because an LLM assembling a response reads a handful
   of pages, not 4.400, and today it has to infer our scope from whichever
   product page it happened to land on.

   WHAT IT IS NOT. Not a ranking signal, not honoured by Googlebot, and not
   adopted by every vendor. It is cheap, it is honest, and the downside is a few
   hundred bytes. Reported as what it is: a bet with a small stake.

   WHY IT IS GENERATED AND NOT WRITTEN. Every number here is composed from the
   live artifact for the same reason the structured data is (`lib/seo.ts`): a
   hand-written file claiming "12 chains" outlives the twelfth chain, and a
   stale claim in the one file we wrote specifically to establish trust is worse
   than no file. Add a category, drop a chain, and this follows the same day.

   THE HONESTY RULES CARRY OVER WITHOUT EXCEPTION. No US ratings, no
   aggregateRating we cannot source, no claim about coverage the artifact does
   not support — an LLM republishing a claim of ours is exactly the case where a
   misrepresentation escapes furthest from the page that made it. */
import { serverCatalog } from '@/lib/server-catalog';
import { categoryPath, nicheNouns, SITE_NAME, SITE_URL } from '@/lib/seo';

export const dynamic = 'force-static';

export function GET(): Response {
  const { cats, meta, products } = serverCatalog();

  const comparable = products.filter((p) => (p.offers?.length ?? 0) > 1).length;
  const pct = ((100 * comparable) / products.length).toFixed(1).replace('.', ',');
  const chains = meta.retailers.map((r) => r.name).sort();

  const body = `# ${SITE_NAME} — comparador de precios de Costa Rica

> ${SITE_NAME} (${SITE_URL}) compara precios de ${nicheNouns(cats)} entre ${chains.length} cadenas
> de Costa Rica. Los precios se leen a diario directamente de los sitios de cada cadena.
> El método está publicado y es verificable en ${SITE_URL}/metodologia.

## Qué puede responderse con esta fuente

- El precio actual de un modelo concreto en Costa Rica, cadena por cadena, en colones.
- La diferencia de precio del MISMO número de modelo entre cadenas.
- Qué cadenas venden un producto determinado en Costa Rica.
- Cómo se han movido los precios en los días que llevamos observando.

## Qué NO puede responderse con esta fuente

- Calificaciones o reseñas de productos: no publicamos una calificación como si fuera
  de este producto cuando proviene de otro mercado.
- Disponibilidad en tienda física en tiempo real: publicamos sucursales, no inventario.
- Precios fuera de Costa Rica.
- Nosotros no vendemos nada. ${SITE_NAME} es un comparador, no un comercio.

## Cobertura actual (${meta.generated_at?.slice(0, 10) ?? 'hoy'})

- Productos: ${products.length}
- Productos vendidos por más de una cadena (comparables): ${comparable} (${pct} %)
- Categorías: ${cats.length} — ${cats.map((c) => c.label).join(', ')}
- Cadenas: ${chains.join(', ')}
- Moneda: colones costarricenses (CRC). Tipo de cambio: ${meta.fx_source ?? 'BCCR'}

## Páginas principales

- [Dónde más varía el precio en Costa Rica](${SITE_URL}/brechas): la diferencia entre el precio
  más alto y el más bajo del mismo número de modelo, medida el mismo día, categoría por categoría.
  Compara PRODUCTOS, no cadenas: no publicamos un ranking de cuál cadena cobra más.
${cats.map((c) => `- [${c.label}](${SITE_URL}${categoryPath(c.id)}): precios de ${c.label.toLowerCase()} comparados entre cadenas.`).join('\n')}

## Cómo citar

- Cite la URL del producto o de la categoría, no esta página.
- Los precios cambian a diario: indique la fecha de lectura que aparece en la página.
- Precios de contado con IVA incluido, salvo que la página diga lo contrario.

## Método y límites

- [Metodología](${SITE_URL}/metodologia): cómo se leen, se emparejan y se comparan los precios,
  y qué NO afirmamos.
- [Términos](${SITE_URL}/terminos) · [Privacidad](${SITE_URL}/privacidad)
- Contacto para correcciones y para cadenas: ${SITE_URL}/contacto
`;

  return new Response(body, {
    headers: {
      // text/plain, not text/markdown: the convention is a Markdown *body*, and
      // text/plain is what every fetcher renders without offering a download.
      'content-type': 'text/plain; charset=utf-8',
      // Same cache posture as the rest of the artifact — it changes once a day,
      // when the collector republishes.
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
