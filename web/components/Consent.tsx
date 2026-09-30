'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  POLICY_VERSION, pushConsentSignal, readConsent, writeConsent, type ConsentChoice,
} from '@/lib/consent';
import p from './primitives.module.css';
import s from './Consent.module.css';

/* ==========================================================================
   THE CONSENT GATE (design-v5 §4) — the mechanism, not the decoration.

   Ley 8968 requires EXPRESS consent before analytics fires. That obligation is
   discharged by the TAG, not by the banner: GA4 must not fire until a choice is
   recorded. It does NOT require that the reader be prevented from reading the
   site — so this is a fixed bottom bar with no scrim and a fully scrollable
   document underneath, not a cookie wall.

   ---- THE THREE EVENTS, AND WHY THEY ARE EVENTS ----
   `vale:consent-open`   the footer's withdrawal control asks the gate to reopen
   `vale:consent-change` the gate tells /cookies its live state line changed
   `data-consent-open`   an attribute on <html>; CompareTray's dock hides against
                         it in CSS (two fixed bars at the bottom of a 390 viewport
                         is 198px of furniture)

   A context provider for three booleans that cross no render boundary would be
   more code than this and would drag `layout.tsx` into a client tree. The DOM
   already has an event bus and an attribute selector; they are the lazy-first
   answer and they cost no JavaScript on the pages that never listen.

   ---- MOUNT TIMING ----
   Client-side only, AFTER reading the cookie. This is a statically prerendered
   site: shipping the bar in the HTML and hiding it with JS gives every returning
   visitor a flash of a banner they already dismissed. Because it is
   `position: fixed` it is out of flow, so the late mount causes ZERO CLS.

   ---- WHAT IT NEVER DOES ----
   · It never returns after a decision, and it is NEVER re-shown after a
     rejection. A banner that re-nags a refusal arguably invalidates the "free"
     quality of consent under Ley 8968 — and it is the only way this design costs
     the fold more than once.
   · It never traps focus and never autofocuses. Stealing focus from a page a
     reader is reading, to a bar they can see, is worse than not.
   · It never retries a failed cookie write and never surfaces an error (§5.5-1).
   ========================================================================== */

/** `null` = not decided yet this mount (we have not read the cookie). */
type Mode = null | 'hidden' | 'first' | 'stale';

export function Consent() {
  const [mode, setMode] = useState<Mode>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const decide = () => {
      const rec = readConsent();
      if (!rec) return 'first' as const;
      if (rec.v !== POLICY_VERSION) return 'stale' as const;
      /* granted AND denied both hide it. A record from THIS policy version is a
         decision, and re-asking a refusal is the thing §4.5 refuses to do. */
      return 'hidden' as const;
    };
    setMode(decide());

    const reopen = () => setMode('first');
    window.addEventListener('vale:consent-open', reopen);
    return () => window.removeEventListener('vale:consent-open', reopen);
  }, []);

  const open = mode === 'first' || mode === 'stale';

  /* The hook that lets CompareTray suppress its dock in CSS. Set on <html> rather
     than <body> so a module stylesheet can reach it with one `:global()`. */
  useEffect(() => {
    const el = document.documentElement;
    if (open) el.setAttribute('data-consent-open', '');
    else el.removeAttribute('data-consent-open');
    return () => el.removeAttribute('data-consent-open');
  }, [open]);

  /* ==========================================================================
     v7 §5.4-2 — THE BAR MAY NOT OCCLUDE A PRICE. IT PUBLISHES ITS OWN HEIGHT
     AND THE DOCUMENT RESERVES EXACTLY THAT MUCH.

     Measured live 2026-08-11, T4 at 390×844: the bar occupied y 717–844 and the
     first price sat at y=675–721 — FOUR PIXELS BEHIND IT. On T1 the price was at
     751–797, entirely behind it. A consent bar that covers the number the page
     exists to show is a defect, not a nit, and it is now gated (measure.mjs
     assertion 26).

     THE FOLD FIX (§7.1 T4-1) LIFTS THE PRICE ABOVE THE BAR ON FIRST PAINT; THIS
     CLOSES THE OTHER HALF — the bar is `position: fixed`, so without a reserved
     strip the LAST ~127px of every document stays permanently unreachable behind
     it, however far you scroll. `padding-block-end` on <body> gives that strip
     back.

     IT IS MEASURED, NOT DECLARED, AND THAT IS THE WHOLE POINT. The bar's
     height is a consequence of how the sentence wraps, which changes with the
     viewport, the font and the copy — 127 at 390, 74 at 768, 72 at 1440 today.
     A literal in a stylesheet would be a fourth copy of a number this project has
     already had to re-measure twice, and it would go stale the first time the copywriter
     edits one word. `ResizeObserver` is the native platform answer, it fires on
     the wrap change rather than on a resize event, and it costs six lines.

     NOT `position: sticky` AT THE DOCUMENT END, which was the other option
     §5.4-2 offers. The bar is deliberately FIRST IN THE TAB ORDER — appended at
     the end of the body it would sit behind the chrome's search input, six nav
     links and the whole page, so a keyboard user would reach a legal decision
     last. Reserving space keeps the honest tab order AND the honest geometry.
     ========================================================================== */
  useEffect(() => {
    const el = barRef.current;
    const root = document.documentElement;
    if (!el) return undefined;
    const set = () => root.style.setProperty('--consent-h', `${el.offsetHeight}px`);
    const ro = new ResizeObserver(set);
    ro.observe(el);
    set();
    return () => {
      ro.disconnect();
      root.style.removeProperty('--consent-h');
    };
  }, [open]);

  const decide = useCallback((c: ConsentChoice) => {
    writeConsent(c);
    pushConsentSignal(c);
    setMode('hidden');
    window.dispatchEvent(new CustomEvent('vale:consent-change'));
  }, []);

  if (!open) return null;

  return (
    /* role="region", NOT role="dialog". It does not block the page, so announcing
       itself as a dialog would misannounce. */
    <div
      ref={barRef}
      className={`consent ${s.consent}`}
      role="region"
      aria-label="Consentimiento de cookies"
    >
      <div className={s.in}>
        <p className={s.say}>
          {mode === 'stale'
            /* POLICY_VERSION is 1, so this branch renders on no build today; it
               exists because §4.6 enumerates the state. */
            ? 'Actualizamos nuestra política. Su elección anterior ya no aplica, decida de nuevo.'
            : 'Usamos analítica para ver qué productos y categorías se consultan más. No la activamos hasta que usted decide.'}{' '}
          {/* INLINE IN THE SENTENCE (§4.3), NOT A THIRD ITEM IN THE ACTION ROW — and
              the difference is 34px of bar across the whole 539–690 band. In the
              action row the row's intrinsic width is 300.5px, which does not fit
              beside the sentence until ~700; inline it, and the action row is 200.3
              and the two share one row from 539 up. Measured, not guessed. */}
          <Link href="/cookies" className={s.more}>
            Más detalles
          </Link>
        </p>
        <div className={s.acts}>
          {/* IDENTICAL RECIPE, IDENTICAL SIZE, IDENTICAL FILL — §4.3, and
              measure.mjs assertion 25 compares every one of those properties.
              `data-consent-action` is the gate hook, on both. */}
          <button
            type="button"
            className={`${p.btn} ${p.btnSolid} ${s.onDark}`}
            data-consent-action="granted"
            onClick={() => decide('granted')}
          >
            Aceptar
          </button>
          <button
            type="button"
            className={`${p.btn} ${p.btnSolid} ${s.onDark}`}
            data-consent-action="denied"
            onClick={() => decide('denied')}
          >
            Rechazar
          </button>
          {/* THERE IS NO THIRD CONTROL HERE, AND THAT IS THE POINT (§4.3). No
              "Gestionar preferencias": we run exactly one non-essential tag, a
              preferences layer for a single boolean is furniture, and a third
              quieter button is how "reject is as easy as accept" gets walked back.
              The granularity lives on /cookies, one tap away in the sentence. */}
        </div>
      </div>
    </div>
  );
}

/** The withdrawal path (§4.6). A `<button>` in the footer's legal nav row that
 *  reopens the same gate — not a link to a settings page, because the choice is
 *  one boolean and it lives in one object. */
export function ConsentReopen({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent('vale:consent-open'))}
    >
      Preferencias de cookies
    </button>
  );
}

/* ==========================================================================
   THE LIVE STATE LINE ON /cookies (§4.6)

   THESE FIVE SENTENCES ARE design-v5 §4.6's OWN STRINGS, moved from tuteo into
   the `usted` register the copywriter uses on every other trust page. The copywriter did not write
   them — flagged in the build report rather than presented as final copy.

   THE DENIED SENTENCE IS THE STRONGEST ONE AVAILABLE TO US AND IT IS TRUE: with
   analytics rejected this site keeps exactly one cookie, the one that remembers
   you said no. `functional`-side assertion 27 is what keeps it true.

   It renders nothing before hydration, on purpose: SSR-ing "no hay ninguna
   cookie activa" would state something false to a returning visitor for one
   frame. The <noscript> carries the JS-disabled truth, which is stronger than
   any of the four states — with no JavaScript, no tag can fire at all.
   ========================================================================== */
export function ConsentState() {
  const [rec, setRec] = useState<ReturnType<typeof readConsent> | 'pending'>('pending');
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const read = () => {
      setRec(readConsent());
      setBlocked(typeof navigator !== 'undefined' && navigator.cookieEnabled === false);
    };
    read();
    window.addEventListener('vale:consent-change', read);
    return () => window.removeEventListener('vale:consent-change', read);
  }, []);

  const line = (() => {
    if (blocked) {
      return 'Su navegador bloquea las cookies, así que no podemos guardar su decisión — y tampoco se activa ninguna analítica.';
    }
    if (rec === 'pending') return null;
    if (!rec) return 'Ahora mismo este sitio no tiene ninguna cookie activa.';
    if (rec.c === 'granted') {
      return `Analítica: activada desde el ${new Date(rec.ts).toLocaleDateString('es-CR')}.`;
    }
    return 'Analítica: desactivada. Este sitio guarda una sola cookie: la que recuerda su decisión.';
  })();

  return (
    <>
      {line ? <p aria-live="polite">{line}</p> : null}
      <noscript>
        <p>Sin JavaScript no se activa ninguna analítica en este sitio.</p>
      </noscript>
    </>
  );
}
