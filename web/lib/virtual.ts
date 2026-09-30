'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/* Window-scroll virtualization in one hook. Row height is a TOKEN, so offsets
   are arithmetic rather than measurement — that is what keeps the list at 60fps
   and independent of how big the catalogue gets.

   `extra` is the one measured value: the height an inline-expanded row adds.
   Folding it into the offsets is what stops the rows below it from jumping. */

/* Overscan is a viewport, not a magic number: a fling moves further in one frame
   at 390 than at 1440, and rows are shorter at 1440, so a fixed count is wrong
   at one end or the other. One screen of rows either side, clamped so the DOM
   never grows past a few dozen nodes. */
const overscanFor = (rowH: number) =>
  Math.min(24, Math.max(6, Math.ceil(window.innerHeight / rowH)));

/** Below this, windowing is more machinery than it saves. */
const FULL_RENDER_UNDER = 30;

/** Reads a row-height token so the JS and the CSS can never disagree. */
export function useRowHeight(desktop: string, mobile: string, fallback: [number, number]): number {
  const [h, setH] = useState(fallback[0]);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const read = () => {
      const name = mq.matches ? mobile : desktop;
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      setH(parseFloat(v) || (mq.matches ? fallback[1] : fallback[0]));
    };
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop, mobile]);
  return h;
}

export interface Window0 {
  start: number;
  end: number;
  padTop: number;
  padBottom: number;
}

export function useWindowVirtual(
  host: React.RefObject<HTMLElement | null>,
  count: number,
  rowH: number,
  extra = 0,
  expandedIndex = -1,
): Window0 {
  const [[start, end], setRange] = useState<[number, number]>([0, 24]);
  const state = useRef({ rowH, extra, expandedIndex, count });
  state.current = { rowH, extra, expandedIndex, count };

  const measure = useCallback(() => {
    const el = host.current;
    if (!el) return;
    const { rowH: h, extra: ex, expandedIndex: xi, count: n } = state.current;
    const top = el.getBoundingClientRect().top + window.scrollY;
    let y = window.scrollY - top;
    if (xi >= 0 && y > (xi + 1) * h + ex) y -= ex;
    const over = overscanFor(h);
    const first = Math.max(0, Math.floor(y / h) - over);
    // clamped to [first, n] — a list entirely below the fold renders nothing,
    // which is the honest answer and is what makes 737 rows cost 30 nodes
    const last = Math.min(n, Math.max(first, Math.ceil((y + window.innerHeight) / h) + over));
    setRange(([a, b]) => (a === first && b === last ? [a, b] : [first, last]));
  }, [host]);

  useLayoutEffect(measure, [measure, count, rowH, extra, expandedIndex]);

  useEffect(() => {
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        measure();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [measure]);

  const offsetOf = (i: number) => i * rowH + (expandedIndex >= 0 && i > expandedIndex ? extra : 0);
  const total = count * rowH + (expandedIndex >= 0 ? extra : 0);

  // Don't virtualize what doesn't need it. A short list — the home page's
  // nine-row taster, a search that found four things — costs nothing to render
  // whole, and rendering it whole means it is all there for Ctrl+F, for a
  // screen reader and for anyone printing or screenshotting the page.
  if (count <= FULL_RENDER_UNDER) return { start: 0, end: count, padTop: 0, padBottom: 0 };

  return {
    start: Math.min(start, Math.max(0, count - 1)),
    end: Math.min(end, count),
    padTop: offsetOf(Math.min(start, Math.max(0, count - 1))),
    padBottom: Math.max(0, total - offsetOf(Math.min(end, count))),
  };
}
