'use client';

import { useEffect } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';
import { syncWorkspaceRadar } from '../lib/workspaceRadar';

interface GlobalRadarScannerProps {
  userId: string;
}

export default function GlobalRadarScanner({
  userId,
}: GlobalRadarScannerProps) {
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let scanRunning = false;

    const scan = async () => {
      if (cancelled || scanRunning) return;
      scanRunning = true;

      try {
        await firebaseBackend.initialize();
        const current = await firebaseBackend.getOpenLoops(50);
        await syncWorkspaceRadar(current);
      } catch (error) {
        console.warn('Background Life Radar scan skipped:', error);
      } finally {
        scanRunning = false;
      }
    };

    const onFocus = () => {
      void scan();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void scan();
      }
    };

    void scan();
    timer = window.setInterval(() => {
      void scan();
    }, 5 * 60 * 1000);

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [userId]);

  return null;
}
