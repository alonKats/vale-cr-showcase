import p from './primitives.module.css';
import { canMultiply } from '@/lib/blend';
import { crc, variantNote } from '@/lib/format';
import type { Enriched, Offer } from '@/lib/types';

/* The pin replaces every --near-coloured branch string in the product. The
   third chromatic family is deleted (spec §1.4) and a glyph carries
   branch/distance instead — it does not cost a hue. Re-exported from the glyph
   module rather than re-drawn here: Mark.tsx owns the five stroke primitives,
   and a second copy of them in this file is the leaf-name collision §2.1 warns
   about. */
export { Pin } from './Mark';

/* The abbreviation ships as one component so it can never be typed as a raw
   literal: the space inside is U+00A0 and the span is nowrap, which is what
   keeps "EE. UU." off two lines at 390. */
export const EEUU = () => <span className={p.nb}>EE.&nbsp;UU.</span>;

/* EVERY colón figure on screen goes through this, so a folded colour-variant
   offer can never be printed as if its cheapest variant were the only price. */
export function Price({ offer, className }: { offer: Offer; className?: string }) {
  const v = variantNote(offer);
  return (
    <span className={className}>
      {v.desde ? <span className={p.desde}>desde </span> : null}
      {crc(offer.price_crc)}
    </span>
  );
}

export const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
    <path d="M13.5 13.5 17 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const Chevron = ({ className }: { className?: string }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

/* Product photography. The engine's pipeline outputs retailer photos as RGB
   webp at 160/320/640, not transparent cutouts, so the image is multiplied onto
   the plate tint — one rule buys a cutout look from a pipeline that does not
   produce cutouts.

   THE GUARD (spec §3.4): 102 of the 2.108 photos ship on a saturated or black
   studio card, and multiplying one of those produces a mud rectangle. The
   decision is precomputed (lib/blend.ts) and applied HERE, once, rather than in
   the eight stylesheets that used to declare mix-blend-mode themselves.

   A product with no photo gets the designed brand-initial tile, never a hole. */
export function Thumb({
  product, sizes, eager = false,
}: {
  product: Enriched;
  sizes: string;
  eager?: boolean;
}) {
  if (!product.image) {
    return (
      <span className={p.mono} aria-hidden="true">
        {product.brandD.charAt(0)}
      </span>
    );
  }
  const srcset = (product.image_srcset ?? []).map((s) => `${s.src} ${s.w}w`).join(', ');
  return (
    // eslint-disable-next-line @next/next/no-img-element -- self-hosted, pre-sized webp; next/image would re-encode assets the engine already produced at exactly 160/320/640
    <img
      className={canMultiply(product.image) ? p.blend : p.flat}
      src={product.image}
      srcSet={srcset || undefined}
      sizes={srcset ? sizes : undefined}
      loading={eager ? 'eager' : 'lazy'}
      decoding={eager ? 'sync' : 'async'}
      alt={`${product.brandD} ${product.modelD}`}
    />
  );
}
