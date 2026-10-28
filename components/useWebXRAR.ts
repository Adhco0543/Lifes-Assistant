'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  startWebXRARSession,
  type WebXRARController,
  type WebXRPlacedBox,
  type WebXRPoint,
} from '../lib/webxrSpatial';

type XRCapabilityNavigator = Navigator & {
  xr?: { isSessionSupported: (mode: string) => Promise<boolean> };
};

export function useWebXRAR(onPoint: (point: WebXRPoint, transform: number[] | null) => void) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRootRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<WebXRARController | null>(null);
  const startingRef = useRef(false);
  const onPointRef = useRef(onPoint);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [surfaceAvailable, setSurfaceAvailable] = useState(false);

  onPointRef.current = onPoint;

  const resetState = useCallback(() => {
    controllerRef.current = null;
    startingRef.current = false;
    setActive(false);
    setStarting(false);
    setSurfaceAvailable(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    const xr = (navigator as XRCapabilityNavigator).xr;
    if (!xr) {
      setSupported(false);
      return () => { mounted = false; };
    }
    void xr.isSessionSupported('immersive-ar')
      .then((value) => { if (mounted) setSupported(value); })
      .catch(() => { if (mounted) setSupported(false); });
    return () => { mounted = false; };
  }, []);

  const start = useCallback(async () => {
    if (controllerRef.current || startingRef.current) return;
    const canvas = canvasRef.current;
    const overlayRoot = overlayRootRef.current;
    if (!canvas || !overlayRoot) throw new Error('The AR view is not ready yet.');

    startingRef.current = true;
    setStarting(true);
    try {
      const controller = await startWebXRARSession({
        canvas,
        overlayRoot,
        onSurfaceChange: setSurfaceAvailable,
        onSelect: (point, transform) => { if (point) onPointRef.current(point, transform); },
        onEnd: resetState,
      });
      if (controller.isEnded()) {
        resetState();
      } else {
        controllerRef.current = controller;
        setActive(true);
      }
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [resetState]);

  const stop = useCallback(async () => {
    const controller = controllerRef.current;
    controllerRef.current = null;
    try {
      await controller?.end();
    } catch {
      // Local state is reset below even when the session fails to end cleanly.
    } finally {
      setActive(false);
      setSurfaceAvailable(false);
    }
  }, []);

  const placeCurrentPoint = useCallback((): boolean => {
    const point = controllerRef.current?.getLatestHit();
    if (!point) return false;
    onPointRef.current(point, controllerRef.current?.getLatestHitTransform() || null);
    return true;
  }, []);

  const getLatestHitTransform = useCallback(() => controllerRef.current?.getLatestHitTransform() || null, []);

  const setObjects = useCallback((objects: WebXRPlacedBox[]) => {
    controllerRef.current?.setObjects(objects);
  }, []);

  const setAnchor = useCallback((point: WebXRPoint | null) => {
    controllerRef.current?.setAnchor(point);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void stop();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' || controllerRef.current?.isEnded()) void stop();
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, stop]);

  useEffect(() => () => {
    const controller = controllerRef.current;
    controllerRef.current = null;
    if (controller) void controller.end().catch(() => undefined);
  }, []);

  return {
    canvasRef,
    overlayRootRef,
    supported,
    active,
    starting,
    surfaceAvailable,
    start,
    stop,
    placeCurrentPoint,
    getLatestHitTransform,
    setObjects,
    setAnchor,
  };
}
