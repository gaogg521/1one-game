"use client";

import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import {
  localizedChildrenAgeLabel,
  localizedChildrenCharRangeLabel,
  localizedChildrenStageLabel,
} from "@/lib/i18n/localized-data";
import {
  CHILDREN_AGE_LENGTH_OPTIONS,
  type ChildrenTargetAge,
} from "@/lib/children-age-length";

type Props = {
  value: ChildrenTargetAge;
  onChange: (age: ChildrenTargetAge) => void;
  disabled?: boolean;
};

/** 儿童短篇：五档读者年龄（字数与知识点侧重不同） */
export function ChildrenAgePicker({ value, onChange, disabled }: Props) {
  const t = useTranslations("novelCreate");
  const locale = useLocale() as AppLocale;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {CHILDREN_AGE_LENGTH_OPTIONS.map((opt) => {
        const selected = value === opt.age;
        return (
          <button
            key={opt.age}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.age)}
            className={`rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-50 ${
              selected
                ? "border-[color:var(--gc-accent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)]"
                : "border-[color:var(--gc-border)] bg-[var(--gc-bg)]/50 hover:border-[color:var(--gc-accent)]/30"
            }`}
          >
            <span className="block text-sm font-semibold">{localizedChildrenAgeLabel(opt.age, locale)}</span>
            <span className="mt-0.5 block text-[11px] text-[var(--gc-muted)]">
              {localizedChildrenStageLabel(opt.age, locale)}
            </span>
            <span className="mt-0.5 block text-[10px] text-[var(--gc-text-faint)]">
              {t("bodyText")} {localizedChildrenCharRangeLabel(opt.age, locale)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
