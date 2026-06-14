"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";

type Props = {
  disabled?: boolean;
  onMerged: (text: string) => void;
  onError?: (message: string) => void;
};

export function ComicCreativeMaterialsField({ disabled, onMerged, onError }: Props) {
  const t = useTranslations("comicCreatePage");
  const locale = useLocale() as AppLocale;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lastSummary, setLastSummary] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files?.length || busy || disabled) return;
    setBusy(true);
    setLastSummary("");
    onError?.("");

    const fd = new FormData();
    for (let i = 0; i < files.length; i += 1) {
      const f = files.item(i);
      if (f) fd.append("files", f);
    }
    fd.append("vision", "1");

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: mergeLocaleHeaders(locale),
        body: fd,
      });
      const data = (await res.json()) as {
        text?: string;
        warnings?: string[];
        error?: string;
        errorKey?: string;
        errorParams?: Record<string, string | number>;
      };
      if (!res.ok) {
        onError?.(resolveClientApiError(locale, data, "ingestFailed"));
        return;
      }
      const merged = (data.text ?? "").trim();
      if (!merged) {
        onError?.(t("materialsEmpty"));
        return;
      }
      onMerged(merged);
      const warnCount = data.warnings?.length ?? 0;
      setLastSummary(
        warnCount > 0
          ? t("materialsMergedWithWarnings", { chars: merged.length, warnings: warnCount })
          : t("materialsMerged", { chars: merged.length }),
      );
    } catch {
      onError?.(t("networkError"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-[var(--gc-text)]">{t("materialsLabel")}</p>
          <p className="mt-0.5 text-[11px] text-[var(--gc-muted)]">{t("materialsHint")}</p>
        </div>
        <label className="cursor-pointer rounded-lg border border-[color:var(--gc-border)] px-3 py-1.5 text-xs text-[var(--gc-text-soft)] hover:border-[color:var(--gc-accent)]/40">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,.pdf,.docx,.txt,.md,.zip"
            className="sr-only"
            disabled={disabled || busy}
            onChange={(e) => void handleFiles(e.target.files)}
          />
          {busy ? t("materialsParsing") : t("materialsUpload")}
        </label>
      </div>
      {lastSummary ? <p className="mt-2 text-[11px] text-[var(--gc-accent)]">{lastSummary}</p> : null}
    </div>
  );
}
