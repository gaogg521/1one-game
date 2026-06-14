"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";

type WorkKind = "game" | "novel" | "comic";

type Props = {
  kind: WorkKind;
  id: string;
  initialCount?: number;
  /** 详情页大按钮样式 */
  variant?: "card" | "banner";
  className?: string;
};

function storageKey(kind: WorkKind, id: string) {
  return `liked:${kind}:${id}`;
}

function likeEndpoint(kind: WorkKind, id: string) {
  if (kind === "game") return `/api/projects/${id}/like`;
  return `/api/${kind}/${id}/like`;
}

export function WorkLikeButton({
  kind,
  id,
  initialCount = 0,
  variant = "card",
  className = "",
}: Props) {
  const locale = useLocale() as AppLocale;
  const [liked, setLiked] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return !!localStorage.getItem(storageKey(kind, id));
  });
  const [count, setCount] = useState(initialCount);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (liked) return;
    setLiked(true);
    setCount((c) => c + 1);
    localStorage.setItem(storageKey(kind, id), "1");
    void fetch(likeEndpoint(kind, id), {
      method: "POST",
      headers: mergeLocaleHeaders(locale),
    });
  }

  const cardCls =
    "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition";
  const bannerCls =
    "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition";
  const likedCls =
    variant === "banner"
      ? "border-red-400/40 bg-red-400/10 text-red-400"
      : "text-red-400";
  const idleCls =
    variant === "banner"
      ? "border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] text-[var(--gc-text)] hover:border-red-400/40 hover:text-red-400"
      : "text-[var(--gc-text-faint)] hover:text-red-400";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${variant === "banner" ? bannerCls : cardCls} ${liked ? likedCls : idleCls} ${className}`}
      data-testid={`work-like-${kind}-${id}`}
    >
      {liked ? "♥" : "♡"} {count > 0 ? count : ""}
    </button>
  );
}
