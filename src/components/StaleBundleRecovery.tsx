"use client";

import { useEffect } from "react";
import { isStaleClientBundleError, reloadOnceForStaleClientBundle } from "@/lib/stale-client-bundle";

/**
 * 发布后旧页还握着过期 JS/CSS 分块时，在 React 错误边界之前先自动刷新一次。
 */
export function StaleBundleRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (!isStaleClientBundleError(event.error ?? event.message)) return;
      reloadOnceForStaleClientBundle();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isStaleClientBundleError(event.reason)) return;
      reloadOnceForStaleClientBundle();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
