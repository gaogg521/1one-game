"use client";

import { useEffect } from "react";

/** 空闲时再跑副作用，避免与首屏导航/点击争抢主线程与带宽 */
export function useIdleEffect(effect: () => void | (() => void), deps: unknown[]): void {
  useEffect(() => {
    let cancelled = false;
    let cleanup: void | (() => void);

    const run = () => {
      if (cancelled) return;
      cleanup = effect();
    };

    const idleId =
      typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback(run, { timeout: 1800 })
        : null;
    const timeoutId = idleId === null ? window.setTimeout(run, 250) : null;

    return () => {
      cancelled = true;
      if (idleId !== null && typeof cancelIdleCallback !== "undefined") {
        cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (typeof cleanup === "function") cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  }, deps);
}
