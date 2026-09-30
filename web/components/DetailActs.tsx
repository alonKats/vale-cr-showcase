'use client';

/* The two controls that genuinely need the browser, as a client island.

   They live on BOTH renderings of the product URL. The overlay had them and the
   standalone page did not, which meant a cold hit or a shared link — the exact
   traffic the indexable route exists to attract — lost the ability to add the
   product to the comparison. One URL, two frames, same capabilities. */

import { useState } from 'react';

import { useApp } from '@/lib/app-store';
import p from './primitives.module.css';
import s from './Sheet.module.css';

export function DetailActs({ id, name }: { id: string; name: string }) {
  const { tray, toggleTray, trayFull } = useApp();
  const [shared, setShared] = useState<string | null>(null);
  const inTray = tray.includes(id);

  const share = async () => {
    const url = window.location.href;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    try {
      if (nav.share) await nav.share({ title: name, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared('Enlace copiado');
        setTimeout(() => setShared(null), 2000);
      }
    } catch {
      /* the user dismissed the share sheet — nothing to report */
    }
  };

  return (
    <div className={s.acts}>
      <button
        type="button"
        className={p.btn}
        aria-pressed={inTray}
        disabled={!inTray && trayFull}
        onClick={() => toggleTray(id)}
      >
        {inTray ? 'Quitar de la comparación' : 'Comparar'}
      </button>
      <button type="button" className={p.btn} onClick={share}>
        {shared ?? 'Compartir'}
      </button>
    </div>
  );
}
