"use client";

import { useEffect } from "react";
import { isStaleClientBundleError, reloadOnceForStaleClientBundle } from "@/lib/stale-client-bundle";

/** 根布局自身崩溃时替换整页（无法使用 next-intl Provider）。 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = isStaleClientBundleError(error);

  useEffect(() => {
    console.error("[global-error]", error);
    if (stale) reloadOnceForStaleClientBundle();
  }, [error, stale]);

  return (
    <html lang="zh-Hans">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07080c",
          color: "#f4f4f5",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, margin: "0 0 12px" }}>页面加载失败</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa" }}>
            {stale
              ? "站点刚更新，正在加载最新页面…"
              : "页面暂时打不开。请点重试或刷新浏览器。"}
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 20 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: 0,
                borderRadius: 999,
                padding: "8px 20px",
                background: "#6366f1",
                color: "#fff",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              重试
            </button>
            <a
              href="/"
              style={{
                borderRadius: 999,
                padding: "8px 20px",
                border: "1px solid #3f3f46",
                color: "#f4f4f5",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              回首页
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
