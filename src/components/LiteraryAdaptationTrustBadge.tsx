"use client";

import { useTranslations } from "next-intl";
import type { LiteraryAdaptationUserInfo } from "@/lib/literary-adaptation-user";

type Props = {
  info: LiteraryAdaptationUserInfo;
  compact?: boolean;
};

/** 让用户看见「小说→漫画」不是随便贴图，而是 Brief + 正文绑定管线 */
export function LiteraryAdaptationTrustBadge({ info, compact = false }: Props) {
  const t = useTranslations("literaryAdaptation");

  const bodyKey =
    info.pipelineSummary === "chapter_scope"
      ? "bodyChapter"
      : info.pipelineSummary === "full_read"
        ? "bodyFullRead"
        : "bodyKeyMoments";

  return (
    <div
      className="rounded-xl border border-[color:color-mix(in_srgb,var(--gc-accent)_28%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)] px-4 py-3 text-sm text-[var(--gc-text-soft)]"
      data-testid="literary-adaptation-trust-badge"
    >
      <p className="font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_92%,white)]">
        {t("title", { novel: info.novelTitle })}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--gc-muted)]">
        {t(bodyKey, {
          novel: info.novelTitle,
          genre: info.genreVisualLabel,
          chapter: info.chapterLabel ?? t("wholeBook"),
        })}
      </p>
      {!compact ? (
        <p className="mt-2 text-[11px] text-[var(--gc-text-faint)]">{t("footnote")}</p>
      ) : null}
    </div>
  );
}
