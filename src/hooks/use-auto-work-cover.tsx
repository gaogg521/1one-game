"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";

type CoverKind = "novel" | "comic";

type CoverResponse = {
  coverPath?: string;
  novel?: { coverPath?: string };
  comic?: { coverPath?: string };
};

export function useAutoWorkCover(opts: {
  kind: CoverKind;
  id: string;
  coverPath: string | null | undefined;
  locale: AppLocale;
  /** 漫画分镜首图等：有则展示且默认不触发补生成 */
  fallbackCover?: string | null;
  /** 为 false 时不自动 POST 补封面（如编辑模式） */
  autoFetch?: boolean;
  /** 封面 POST 超时（毫秒），默认无超时 */
  fetchTimeoutMs?: number;
  onUpdated?: (coverPath: string) => void;
  onFailed?: (reason: "timeout" | "api" | "network" | "empty") => void;
}) {
  const {
    kind,
    id,
    coverPath,
    locale,
    fallbackCover,
    autoFetch = true,
    fetchTimeoutMs,
    onUpdated,
    onFailed,
  } = opts;
  const coverRequested = useRef(false);
  const [localCover, setLocalCover] = useState<string | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const [coverPending, setCoverPending] = useState(false);

  useEffect(() => {
    if (coverPath) setLocalCover(null);
  }, [coverPath]);

  const displayCover = coverPath ?? localCover ?? fallbackCover ?? null;

  const requestCover = useCallback(
    async (force = false) => {
      const existing = coverPath ?? localCover ?? (!force ? fallbackCover : null);
      if (!force && (existing || coverRequested.current)) return;
      coverRequested.current = true;
      setCoverPending(true);
      setCoverFailed(false);
      const controller = fetchTimeoutMs ? new AbortController() : null;
      const timer =
        controller && fetchTimeoutMs ?
          window.setTimeout(() => controller.abort(), fetchTimeoutMs)
        : undefined;
      try {
        const base = kind === "novel" ? `/api/novel/${id}/cover` : `/api/comic/${id}/cover`;
        const url = force ? `${base}?force=1` : base;
        const res = await fetch(url, {
          method: "POST",
          headers: mergeLocaleHeaders(locale),
          signal: controller?.signal,
        });
        const data = (await res.json()) as CoverResponse;
        if (!res.ok) {
          setCoverFailed(true);
          onFailed?.("api");
          return;
        }
        const path =
          data.coverPath ??
          (kind === "novel" ? data.novel?.coverPath : data.comic?.coverPath);
        if (path) {
          setLocalCover(path);
          onUpdated?.(path);
          setCoverFailed(false);
        } else {
          setCoverFailed(true);
          onFailed?.("empty");
        }
      } catch (e) {
        setCoverFailed(true);
        if (e instanceof DOMException && e.name === "AbortError") {
          onFailed?.("timeout");
        } else {
          onFailed?.("network");
        }
      } finally {
        if (timer) window.clearTimeout(timer);
        setCoverPending(false);
      }
    },
    [coverPath, fallbackCover, fetchTimeoutMs, id, kind, locale, localCover, onFailed, onUpdated],
  );

  useEffect(() => {
    if (!autoFetch) return;
    if (displayCover) return;
    void requestCover(false);
  }, [autoFetch, displayCover, requestCover]);

  const retryCover = useCallback(
    (e?: MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      coverRequested.current = false;
      void requestCover(true);
    },
    [requestCover],
  );

  return {
    displayCover,
    coverFailed,
    coverPending,
    retryCover,
  };
}

type PlaceholderProps = {
  icon: string;
  failedLabel: string;
  generatingLabel: string;
  retryLabel: string;
  coverFailed: boolean;
  coverPending: boolean;
  onRetry: (e: MouseEvent) => void;
  testId?: string;
};

export function WorkCoverPlaceholder({
  icon,
  failedLabel,
  generatingLabel,
  retryLabel,
  coverFailed,
  coverPending,
  onRetry,
  testId,
}: PlaceholderProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-center text-[var(--gc-muted)] opacity-70">
      <span className="text-xl">{coverFailed ? "⚠" : icon}</span>
      <span className="text-[10px] leading-snug">
        {coverFailed ? failedLabel : generatingLabel}
      </span>
      {coverFailed ? (
        <button
          type="button"
          data-testid={testId}
          onClick={onRetry}
          className="mt-0.5 rounded-md border border-[color:var(--gc-border)] px-2 py-0.5 text-[10px] text-[var(--gc-text)] hover:border-[color:var(--gc-accent)]/40"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
