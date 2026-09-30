'use client';

/* THE HORIZONTAL-RAIL GEOMETRY, once.

   Two places need it and they look nothing alike: the chrome's tier-2 category
   bar (small chevrons on --ink) and T1's photo rail (large circular buttons on
   --ground, zap's device). What they share is not the markup — it is the
   measurement, which is the part that is easy to get subtly wrong. So the
   measurement lives here and each component renders its own controls.

   Extracted 2026-08-07 when the rail became the second caller. It was written
   and verified in TopBar first; nothing here is new logic. */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Rail {
  ref: React.RefObject<HTMLDivElement | null>;
  /** attach to the scroller: keeps the flags true while the user drags/swipes */
  onScroll: () => void;
  canPrev: boolean;
  canNext: boolean;
  /** true when the content does not fit — render no controls at all if false */
  overflows: boolean;
  nudge: (dir: 1 | -1) => void;
}

export function useRail(deps: unknown[] = []): Rail {
  const ref = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  /** ONE read of the live element. Both flags come from the same measurement,
   *  so the fade and the buttons can never disagree — and neither is derived
   *  from counting items, because whether a row overflows depends on the
   *  viewport, the rendered text and the font that actually loaded. */
  const read = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 1px of slack: scrollLeft is fractional under zoom or a fractional DPR, so
    // an exact `>= scrollWidth - clientWidth` test leaves `next` enabled at the
    // true end, and a control that does nothing is worse than no control.
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 1);
    setCanNext(max > 1 && el.scrollLeft < max - 1);
  }, []);

  useEffect(() => {
    read();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    /* ResizeObserver, not a resize listener: a row can START overflowing
       without the WINDOW changing size — a webfont swapping in widens every
       label after first paint, and a lazy image settling changes a tile's
       height. That is exactly when the first measurement is wrong. Observing
       the children as well as the scroller is what catches both. */
    const ro = new ResizeObserver(read);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read, ...deps]);

  /** Most of a viewport-width, leaving a sliver of the previous item on screen
   *  so the movement reads as continuous rather than as a page flip. */
  const nudge = useCallback((dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.8), behavior: 'smooth' });
  }, []);

  return { ref, onScroll: read, canPrev, canNext, overflows: canPrev || canNext, nudge };
}
