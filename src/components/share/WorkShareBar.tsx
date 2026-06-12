"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SocialShareBar } from "@/components/share/SocialShareBar";

type WorkType = "game" | "novel" | "comic";

type Props = {
  workType: WorkType;
  workId: string;
  title?: string;
  patchUrl: string;
  initialShareCode?: string | null;
};

function extractShareCode(data: Record<string, unknown>): string | null {
  const novel = data.novel as { shareCode?: string | null } | undefined;
  const comic = data.comic as { shareCode?: string | null } | undefined;
  const project = data.project as { shareCode?: string | null } | undefined;
  return novel?.shareCode ?? comic?.shareCode ?? project?.shareCode ?? null;
}

export function WorkShareBar({ workType, workId, title, patchUrl, initialShareCode }: Props) {
  const t = useTranslations("workShare");
  const [shareCode, setShareCode] = useState<string | null>(initialShareCode ?? null);
  const [busy, setBusy] = useState(false);

  const ensureCode = useCallback(async () => {
    if (shareCode) return shareCode;
    setBusy(true);
    try {
      const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensureShareCode: true }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      const code = extractShareCode(data);
      if (code) setShareCode(code);
      return code;
    } catch {
      return null;
    } finally {
      setBusy(false);
    }
  }, [patchUrl, shareCode]);

  useEffect(() => {
    if (initialShareCode) setShareCode(initialShareCode);
  }, [initialShareCode]);

  useEffect(() => {
    if (!shareCode && !busy) void ensureCode();
  }, [shareCode, busy, ensureCode]);

  if (!shareCode) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void ensureCode()}
        className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-xs font-medium text-[var(--gc-muted)] transition hover:border-[color:var(--gc-accent)]/40 hover:text-[var(--gc-text)] disabled:opacity-50"
      >
        {busy ? t("preparing") : t("share")}
      </button>
    );
  }

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/s/${shareCode}` : `/s/${shareCode}`;

  return (
    <SocialShareBar
      shareUrl={shareUrl}
      shareCode={shareCode}
      workType={workType}
      workId={workId}
      title={title}
    />
  );
}
