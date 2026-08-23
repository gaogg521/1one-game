"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";

export function PublishWorkButton({
  type,
  id,
  visibility,
  onVisibilityChange,
}: {
  type: "game" | "novel" | "comic";
  id: string;
  visibility?: string | null;
  onVisibilityChange?: (visibility: "public" | "hidden") => void;
}) {
  const t = useTranslations("studio");
  const locale = useLocale() as AppLocale;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isPublished = visibility === "public";

  async function changePublication() {
    if (busy) return;
    const action = isPublished ? "unpublish" : "publish";
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/works/${type}/${encodeURIComponent(id)}/publication`, {
        method: "POST",
        headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { visibility?: "public" | "hidden"; errorKey?: string };
      if (!res.ok || !data.visibility) {
        setMessage(data.errorKey === "quality_blocked" ? t("publishBlocked") : t("publishFailed"));
        return;
      }
      onVisibilityChange?.(data.visibility);
      setMessage(data.visibility === "public" ? t("publishSuccess") : t("unpublishSuccess"));
    } catch {
      setMessage(t("publishFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void changePublication()}
        disabled={busy}
        data-testid={`publish-work-${type}`}
        className={isPublished
          ? "rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-xs font-medium text-[var(--gc-muted)] transition hover:text-[var(--gc-text)] disabled:opacity-50"
          : "gc-theme-cta rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"}
      >
        {busy ? t("publishing") : isPublished ? t("unpublishWork") : t("publishWork")}
      </button>
      {message ? <span role="status" className="text-[11px] text-[var(--gc-muted)]">{message}</span> : null}
    </span>
  );
}
