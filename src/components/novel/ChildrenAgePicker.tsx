"use client";

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
            <span className="block text-sm font-semibold">{opt.label}</span>
            <span className="mt-0.5 block text-[11px] text-[var(--gc-muted)]">{opt.stage}</span>
            <span className="mt-0.5 block text-[10px] text-[var(--gc-text-faint)]">
              正文 {opt.charRangeLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
