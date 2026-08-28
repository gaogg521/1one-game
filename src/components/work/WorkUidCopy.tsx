"use client";

import { useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";

type Props = {
  id: string;
  className?: string;
  compact?: boolean;
};

export function WorkUidCopy({ id, className = "", compact = false }: Props) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);

  async function copy(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => void copy(e)}
      title={t("copyWorkUid")}
      data-testid="work-uid-copy"
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-left text-[10px] leading-tight text-[var(--gc-text-faint)] transition hover:border-[color:var(--gc-border)] hover:text-[var(--gc-text)] ${className}`}
    >
      <span className="shrink-0">{t("workUid")}</span>
      <span className={`font-mono ${compact ? "max-w-[11rem] truncate" : "break-all"}`}>{id}</span>
      <span className="shrink-0">{copied ? t("workUidCopied") : t("copyWorkUid")}</span>
    </button>
  );
}
