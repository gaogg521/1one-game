"use client";

import { NOVEL_GENRE_TAGS, type NovelGenreTagId } from "@/lib/novel-genre-tags";

type Props = {
  value: NovelGenreTagId | null;
  onChange: (id: NovelGenreTagId) => void;
  disabled?: boolean;
};

/** 网文类型标签单选 */
export function NovelGenreTagPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {NOVEL_GENRE_TAGS.map((tag) => {
        const selected = value === tag.id;
        return (
          <button
            key={tag.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(tag.id)}
            className={`rounded-xl border px-4 py-3 text-left transition disabled:opacity-50 ${
              selected
                ? "border-[color:var(--gc-accent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_14%,transparent)] ring-1 ring-[color:var(--gc-accent)]/40"
                : "border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] hover:border-[color:var(--gc-accent)]/35"
            }`}
          >
            <span className="block text-sm font-semibold text-[var(--gc-text)]">{tag.label}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--gc-muted)]">{tag.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
