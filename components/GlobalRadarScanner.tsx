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
    let changeTimer: number | undefined;
    let scanRunning = false;
    let rerunRequested = false;

    const scan = async () => {
      if (cancelled) return;
      if (scanRunning) {
        rerunRequested = true;
        return;
      }
      scanRunning = true;

      try {
        await firebaseBackend.initialize();
        const current = await firebaseBackend.getOpenLoops(50);
        const changes = await syncWorkspaceRadar(current);

        if (!cancelled) {
          window.dispatchEvent(
            new CustomEvent('life-radar-scanned', {
              detail: { changes, scannedAt: Date.now() },
            })
          );
        }
      } catch (error) {
        console.warn('Background Life Radar scan skipped:', error);
      } finally {
        scanRunning = false;
        if (rerunRequested && !cancelled) {
          rerunRequested = false;
          void scan();
        }
      }
    };

    const scheduleWorkspaceScan = () => {
      if (changeTimer) window.clearTimeout(changeTimer);
      changeTimer = window.setTimeout(() => {
        void scan();
      }, 900);
    };

    const scanNow = () => {
      if (changeTimer) window.clearTimeout(changeTimer);
      void scan();
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
    window.addEventListener('life-workspace-changed', scheduleWorkspaceScan);
    window.addEventListener('life-radar-scan', scanNow);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      if (changeTimer) window.clearTimeout(changeTimer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('life-workspace-changed', scheduleWorkspaceScan);
      window.removeEventListener('life-radar-scan', scanNow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [userId]);

  return null;
}
