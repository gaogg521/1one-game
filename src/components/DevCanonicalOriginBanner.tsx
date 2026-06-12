"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

const STORAGE_DISMISS = "gc:devCanonDismiss";

/**
 * 开发环境下：NEXT_PUBLIC_DEV_CANONICAL_ORIGIN 与当前 window.location.origin 不一致时，
 * 提示统一到同一局域网地址访问，使 localhost 与局域网手机共享同源（主题 / sessionStorage / owner Cookie）。
 */
export function DevCanonicalOriginBanner() {
  const t = useTranslations("devBanner");
  const canonRaw = process.env.NEXT_PUBLIC_DEV_CANONICAL_ORIGIN?.trim();
  const canonUrl = useMemo(() => {
    if (!canonRaw) return null;
    try {
      return new URL(canonRaw);
    } catch {
      return null;
    }
  }, [canonRaw]);

  const [visible, setVisible] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState("");

  useEffect(() => {
    if (!canonUrl) return;
    if (process.env.NODE_ENV === "production") return;

    try {
      if (sessionStorage.getItem(STORAGE_DISMISS) === "1") return;
    } catch {
      /* ignore */
    }

    queueMicrotask(() => {
      if (typeof window === "undefined") return;
      const o = window.location.origin;
      setCurrentOrigin(o);
      if (o !== canonUrl.origin) setVisible(true);
    });
  }, [canonUrl]);

  if (!canonUrl || !visible) return null;

  const jump = () => {
    const { pathname, search, hash } = window.location;
    window.location.replace(`${canonUrl.origin}${pathname}${search}${hash}`);
  };

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_DISMISS, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[200] border-t border-amber-500/35 bg-zinc-950/95 px-4 py-3 text-sm text-amber-100 shadow-[0_-8px_30px_rgba(0,0,0,0.45)] backdrop-blur-md"
      role="region"
      aria-label={t("aria")}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="leading-relaxed text-amber-50/95">
          <span className="font-semibold text-amber-200">{t("title")}</span>{" "}
          {t("body", {
            current: currentOrigin || "…",
            canonical: canonUrl.origin,
          })}
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
            onClick={jump}
          >
            {t("switch")}
          </button>
          <button
            type="button"
            className="rounded-full border border-amber-500/45 px-3 py-2 text-xs text-amber-200/85 hover:bg-amber-500/15"
            onClick={dismiss}
          >
            {t("dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
