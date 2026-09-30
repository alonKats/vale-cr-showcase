'use client';

/* The one way anything in the app points at a product.

   It is a real <a href="/producto/…"> — the canonical, indexable URL. Crawlers,
   middle-click, "open in new tab", "copy link address" and the browser's own
   status bar all get the truth. Clicking it inside the app does NOT load a
   page: `app/@modal/(.)producto/[slug]` intercepts the navigation and the
   product opens as the overlay sheet over the preserved list. Same URL, two
   renderings, no duplicate content.

   Prefetch policy is the reason this is a component and not a bare <Link>.
   Next's default would prefetch every link that enters the viewport; the
   results list is virtualized and keeps ~72 rows mounted, which would put ~72
   speculative requests on the wire during the cold load the app is measured on.
   So: no viewport prefetch, and an explicit prefetch on the first sign of
   intent (pointer over the row, or finger down on it) — which lands the payload
   well before the click and keeps the overlay's open budget where it was. */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { productPath } from '@/lib/seo';

export function ProductLink({
  id, className, children, title,
}: {
  id: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const href = productPath(id);
  const warm = useCallback(() => router.prefetch(href), [router, href]);

  return (
    <Link
      href={href}
      className={className}
      title={title}
      prefetch={false}
      onPointerEnter={warm}
      onTouchStart={warm}
      onFocus={warm}
    >
      {children}
    </Link>
  );
}
