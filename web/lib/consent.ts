/* ==========================================================================
   THE CONSENT RECORD — one constant, four readers (design-v5 §4.6)

   Ley 8968 wants consent EXPRESS, INFORMED and DOCUMENTED. "Documented" is why
   this is a first-party cookie rather than localStorage: a cookie is the durable
   form, it is what Google Consent Mode reads, and it survives the partitioned-
   storage regimes localStorage does not.

   THE VERSION ON THE PAGE AND THE VERSION IN THE COOKIE ARE ONE VALUE. The stamp
   line on all six trust pages, the cookie's `v`, the "stale policy" branch of the
   banner and /cookies' live state line all read POLICY_VERSION from here. Two
   copies of that number is how a policy update silently stops re-asking.

   NOTHING IN THIS FILE FIRES A TAG. The banner writes the record and pushes the
   Consent Mode signal; GTM gates the tag against that signal. That separation
   is the whole mechanism.
   ========================================================================== */

/** Bump this when the policy text changes materially. The banner re-shows on a
 *  cookie whose `v` does not match, with a different first line (§4.6). */
export const POLICY_VERSION = 1;

/** The date the six trust pages took effect, in the stamp's own register. */
export const POLICY_DATE_LONG = '5 de agosto de 2026';

/** 46 characters. measure.mjs assertion 17a fails a --t1 node over 60, and the
 *  stamp is the floor's third role (eyebrow/caption). Keep it short.
 *  NO `·` SEPARATOR: assertion 5 fails a middot at a rendered line boundary and
 *  this line wraps at 320. A comma carries the same join and cannot fail. */
export const POLICY_STAMP = `Vigente desde el ${POLICY_DATE_LONG}, versión ${POLICY_VERSION}`;

export const COOKIE_NAME = 'vale_consent';
/** one year, in seconds */
export const COOKIE_MAX_AGE = 31_536_000;

export type ConsentChoice = 'granted' | 'denied';

export interface ConsentRecord {
  v: number;
  c: ConsentChoice;
  ts: string;
}

/** `null` = no usable record: absent, unparseable, or from an unknown version.
 *  ALL THREE ARE TREATED AS "NO COOKIE" (§5.5-2) — show the gate, fire nothing,
 *  overwrite on the next decision. Never parse-and-guess. */
export function readConsent(): ConsentRecord | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  if (!m) return null;
  try {
    const raw: unknown = JSON.parse(decodeURIComponent(m[1]));
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Partial<ConsentRecord>;
    if (r.c !== 'granted' && r.c !== 'denied') return null;
    if (typeof r.v !== 'number' || typeof r.ts !== 'string') return null;
    return { v: r.v, c: r.c, ts: r.ts };
  } catch {
    return null;
  }
}

/** Writes the record and returns it. THE WRITE MAY SILENTLY FAIL — private mode,
 *  blocked cookies — and that is a designed state, not an error: the gate stays
 *  up for this page view, nothing fires, and /cookies says so. It must not retry,
 *  log or show an error (§5.5-1).
 *
 *  `Secure` only on https. On http://localhost Chromium treats the origin as
 *  potentially trustworthy and would accept it anyway, but a conditional is one
 *  expression and removes the whole class of "the gate works everywhere except
 *  the one place we test it". */
export function writeConsent(c: ConsentChoice): ConsentRecord {
  const record: ConsentRecord = { v: POLICY_VERSION, c, ts: new Date().toISOString() };
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie =
    `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(record))}` +
    `; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  return record;
}

/** THE ONLY THING THAT TOUCHES ANALYTICS, and it touches a signal rather than a
 *  tag. `consent default: denied` is set inline in <head> before any tag can
 *  load (layout.tsx); this is the `update` half. With no GTM container published
 *  it is inert — which is correct, and is why assertion 26's negative half holds
 *  by construction rather than by timing. */
export function pushConsentSignal(c: ConsentChoice): void {
  const w = window as unknown as {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  w.dataLayer = w.dataLayer || [];
  /* THROUGH `gtag`, NOT A RAW ARRAY PUSH. Consent Mode reads an `arguments`
     object; the shim in layout.tsx's head declares `gtag` and is what produces
     one. Pushing `['consent','update',…]` by hand is the same shape only by
     accident, and it is the kind of thing that works until it does not. */
  if (typeof w.gtag === 'function') w.gtag('consent', 'update', { analytics_storage: c });
  // a plain event too, so a GTM trigger can fire on the decision itself
  w.dataLayer.push({ event: 'vale_consent', vale_consent_state: c });
}
