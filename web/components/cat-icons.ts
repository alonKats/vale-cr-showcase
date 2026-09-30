import type { IconName } from './Icon';

/* ---- THE ICON MAP -------------------------------------------------------
   TEN OF THESE FIFTEEN ARE THE FIGMA'S OWN ASSIGNMENTS, read off 6:79 and
   6:247 where each tile's icon node is named: celulares→smartphone,
   smartwatches→watch, laptops→laptop, cocinas→home, lavadoras→refresh-cw,
   pantallas→tv, aires→wind, barras→speaker, congeladores→refresh-cw,
   consolas→gamepad. (The design itself reuses refresh-cw for two categories,
   so reuse below is not a shortcut — it is the pattern the design sets.)

   FIVE HAVE NO DRAWN ASSIGNMENT: lavaplatos, microondas, parrillas,
   refrigeradoras and tablets do not appear in any of the five frames, so there
   is no drawn assignment to follow. Each is the nearest glyph in the exported
   set rather than a new icon — nothing here is drawn, per the rule that the
   product does not author its own vectors. They are listed separately so they
   read as an open question rather than as design:

     lavaplatos      refresh-cw  a wash cycle, consistent with lavadoras
     microondas      box         a box-shaped counter appliance
     refrigeradoras  box         ditto, and the Figma has no fridge glyph
     parrillas       home        weakest of the five — it means "for the house"
     tablets         smartphone  a slab with a screen; laptop reads as hinged

   `parrillas` and the two `box` uses are the ones worth a designer's minute. */
export const CAT_ICONS: Record<string, IconName> = {
  celulares: 'smartphone',
  smartwatches: 'watch',
  laptops: 'laptop',
  cocinas: 'home',
  lavadoras: 'refresh-cw',
  pantallas: 'tv',
  aires: 'wind',
  barras: 'speaker',
  congeladores: 'refresh-cw',
  consolas: 'gamepad',
  // — the five with no drawn assignment, see above —
  lavaplatos: 'refresh-cw',
  microondas: 'box',
  refrigeradoras: 'box',
  parrillas: 'home',
  tablets: 'smartphone',
};

/** A category the engine adds tomorrow has no entry above and must still
 *  render. `grid` is the Figma's own generic — it is what `Brechas` uses. */
export const CAT_ICON_FALLBACK: IconName = 'grid';
