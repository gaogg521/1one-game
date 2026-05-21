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

/** 儿童短篇：按目标读者年龄选择正文字数上限 */
export function ChildrenAgePicker({ value, onChange, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
            <span className="mt-0.5 block text-[11px] text-[var(--gc-muted)]">约 {opt.maxChars} 字</span>
          </button>
        );
      })}
    </div>
  );
}
