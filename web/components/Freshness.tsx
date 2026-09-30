/* Every price carries when it was read. Prices genuinely move within hours, so
   the stamp is part of the number, not a footnote somewhere else.

   Server-renderable on purpose — it appears on the statically generated product
   page, where nothing hydrates. `now` is the artifact's export time rather than
   the wall clock, so the page and the in-app overlay say the same thing about
   the same price, and a prerendered page cannot freeze a wall-clock claim. */

import { AGE_LABEL, fecha, priceAge } from '@/lib/format';

export function Freshness({
  iso, now, className,
}: {
  iso: string;
  /** ms — Date.parse(meta.generated_at) */
  now: number;
  className?: string;
}) {
  return (
    <span className={className}>
      {AGE_LABEL[priceAge(iso, now)]}
      {fecha(iso)}
    </span>
  );
}
