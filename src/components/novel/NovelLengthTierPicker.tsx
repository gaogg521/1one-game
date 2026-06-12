"use client";

import { useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { getNovelLengthTierUiCopy } from "@/lib/i18n/localized-data";
import {
  NOVEL_LENGTH_TIERS_FOR_UI,
  novelGenerationEtaHint,
  type NovelLengthTier,
} from "@/lib/novel-length";

type Props = {
  value: NovelLengthTier;
  onChange: (tier: NovelLengthTier) => void;
  disabled?: boolean;
  /** 选中项下方显示预计耗时 */
  showEta?: boolean;
  etaPrefix?: string;
  className?: string;
};

/** 短篇 / 中篇 / 长篇 — 全 locale 统一走 novelCreate i18n，禁止直接用 NOVEL_LENGTH_TIERS_FOR_UI.label */
export function NovelLengthTierPicker({
  value,
  onChange,
  disabled,
  showEta,
  etaPrefix,
  className,
}: Props) {
  const locale = useLocale() as AppLocale;

  return (
    <div className={`grid gap-2 sm:grid-cols-3 ${className ?? ""}`}>
      {NOVEL_LENGTH_TIERS_FOR_UI.map((tier) => {
        const ui = getNovelLengthTierUiCopy(tier.id, locale);
        const selected = value === tier.id;
        return (
          <button
            key={tier.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(tier.id)}
            className={`rounded-xl border px-4 py-3 text-left transition disabled:opacity-50 ${
              selected
                ? "border-[color:var(--gc-accent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)]"
                : "border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] hover:border-[color:var(--gc-accent)]/30"
            }`}
          >
            <span className="block text-sm font-semibold text-[var(--gc-text)]">{ui.label}</span>
            <span className="mt-0.5 block text-xs text-[var(--gc-muted)]">{ui.desc}</span>
            {showEta && selected && !disabled && etaPrefix ? (
              <span className="mt-1 block text-[10px] text-[var(--gc-accent)]">
                {etaPrefix} {novelGenerationEtaHint(tier.id, locale)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
