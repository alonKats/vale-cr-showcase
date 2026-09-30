'use client';

import { useEffect } from 'react';

/* Registered in production only. In dev it would cache the HMR chunks and make
   every edit a mystery. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* an unregistered SW costs offline, not the app */
    });
  }, []);
  return null;
}
