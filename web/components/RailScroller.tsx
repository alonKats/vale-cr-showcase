'use client';

/* THE PHOTO RAIL'S SLIDER SHELL — zap's device, built to the reference.

   CORRECTS A CLAIM THIS PROJECT HELD. CategoryRail.module.css argued: "The
   scroll affordance is `mask-image` and nothing else: no arrow buttons, no JS,
   no shadow. zap uses the same device on their rail." Our OWN reference
   screenshot disagrees — `zap-reference/zap-home-1440.png` shows a white
   CIRCULAR ARROW BUTTON sitting on the rail's edge, alongside the fade. zap
   uses both. The no-arrows rule was reasoned from a misread of the reference,
   which is worth stating plainly rather than quietly reversing.

   Why the mask alone stopped being enough regardless: at six categories the
   ≥1024 rail was a `repeat(6, 1fr)` grid — nothing scrolled and nothing was
   hidden. At fourteen it became three stacked rows, and turning it into one
   scrolling row means a desktop mouse (no horizontal wheel) needs a control.
   The identical failure the tier-2 nav had.

   ONLY the shell is a client component. The tiles stay server-rendered and
   arrive as `children`, so the rail is still the first paint above the fold,
   its images are still eager, and none of it waits for products.json — the
   property CategoryRail.tsx's header calls out and which must not be lost to
   make an arrow work. */

import type { ReactNode } from 'react';

import { useRail } from '@/lib/use-rail';
import s from './RailScroller.module.css';

function Chevron({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" focusable="false">
      <path
        d={dir === 'prev' ? 'M15 5 L8 12 L15 19' : 'M9 5 L16 12 L9 19'}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RailScroller({
  children, label, itemCount,
}: {
  children: ReactNode;
  /** the landmark name — the rail, the chrome nav and the footer must not share one */
  label: string;
  /** re-measure when the engine's category count changes */
  itemCount: number;
}) {
  const rail = useRail([itemCount]);

  return (
    <div className={s.wrap}>
      <nav
        ref={rail.ref}
        onScroll={rail.onScroll}
        className={s.rail}
        aria-label={label}
        data-at-start={rail.canPrev ? undefined : ''}
        data-at-end={rail.canNext ? undefined : ''}
      >
        {children}
      </nav>

      {/* Controls are POINTER SUGAR and are gated on a fine pointer in CSS: a
          touch device swipes the rail natively and would only lose tile width
          to a button it does not need. On a mouse there is no horizontal wheel
          and the control is the only way through.

          aria-hidden + tabIndex -1 for the same reason as the chrome's rail:
          every tile is already a real link in the tab order and focusing one
          scrolls it into view, so focusable arrows would add two tab stops that
          navigate nowhere and duplicate what the keyboard already reaches. */}
      {rail.overflows && (
        <>
          <button
            type="button"
            className={`${s.btn} ${s.prev}`}
            onClick={() => rail.nudge(-1)}
            disabled={!rail.canPrev}
            aria-hidden="true"
            tabIndex={-1}
          >
            <Chevron dir="prev" />
          </button>
          <button
            type="button"
            className={`${s.btn} ${s.next}`}
            onClick={() => rail.nudge(1)}
            disabled={!rail.canNext}
            aria-hidden="true"
            tabIndex={-1}
          >
            <Chevron dir="next" />
          </button>
        </>
      )}
    </div>
  );
}
