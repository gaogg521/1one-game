"use client";

import { useTranslations } from "next-intl";
import { COMIC_DEFAULT_PAGES } from "@/lib/comic-generate-config";
import type { NovelLengthTier } from "@/lib/novel-length";

const TIERS: NovelLengthTier[] = ["short", "medium", "long"];

type Props = {
  value: NovelLengthTier;
  onChange: (tier: NovelLengthTier) => void;
  disabled?: boolean;
  className?: string;
};

/** 独立漫画篇幅：按页数展示，内部仍映射 lengthTier 供生成管线使用 */
export function ComicLengthTierPicker({ value, onChange, disabled, className }: Props) {
  const t = useTranslations("comicLengthTier");

  return (
    <div className={`grid gap-2 sm:grid-cols-3 ${className ?? ""}`}>
      {TIERS.map((tier) => {
        const pages = COMIC_DEFAULT_PAGES[tier];
        const selected = value === tier;
        return (
          <button
            key={tier}
            type="button"
            disabled={disabled}
            onClick={() => onChange(tier)}
            className={`rounded-xl border px-4 py-3 text-left transition disabled:opacity-50 ${
              selected
                ? "border-[color:var(--gc-accent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)]"
                : "border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] hover:border-[color:var(--gc-accent)]/30"
            }`}
          >
            <span className="block text-sm font-semibold text-[var(--gc-text)]">
              {t(`${tier}Label`)}
            </span>
            <span className="mt-1 block text-xs text-[var(--gc-muted)]">
              {t("pagesDesc", { count: pages })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
