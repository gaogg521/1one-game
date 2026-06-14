"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { COMIC_DEFAULT_PAGES, COMIC_MAX_PAGES } from "@/lib/comic-generate-config";
import { COMIC_LAYOUTS, type ComicLayoutId } from "@/lib/comic-layout";
import type { NovelLengthTier } from "@/lib/novel-length";

const LAYOUT_OPTIONS: ComicLayoutId[] = ["grid_4", "grid_8", "picture_book_5"];
const PAGE_PRESETS = [2, 4, 6, 8, 12, 16, 24, 32] as const;

export type ComicStandaloneAdvancedState = {
  enabled: boolean;
  pageCount: number;
  layoutId: ComicLayoutId;
};

export function defaultComicStandaloneAdvanced(lengthTier: NovelLengthTier = "medium"): ComicStandaloneAdvancedState {
  return {
    enabled: false,
    pageCount: COMIC_DEFAULT_PAGES[lengthTier],
    layoutId: "grid_8",
  };
}

type Props = {
  lengthTier: NovelLengthTier;
  value: ComicStandaloneAdvancedState;
  onChange: (next: ComicStandaloneAdvancedState) => void;
  disabled?: boolean;
};

export function ComicStandaloneAdvancedOptions({ lengthTier, value, onChange, disabled }: Props) {
  const t = useTranslations("comicStandaloneAdvanced");
  const presetPages = COMIC_DEFAULT_PAGES[lengthTier];

  useEffect(() => {
    if (value.enabled) return;
    onChange({ ...value, pageCount: presetPages });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 篇幅档位变化时同步默认页数
  }, [lengthTier, presetPages]);

  function patch(partial: Partial<ComicStandaloneAdvancedState>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]/60 p-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => patch({ enabled: !value.enabled })}
        className="text-xs font-medium text-[var(--gc-accent)] disabled:opacity-50"
        data-testid="comic-standalone-advanced-toggle"
      >
        {value.enabled ? t("hideAdvanced") : t("showAdvanced")}
      </button>

      {value.enabled ? (
        <div className="mt-3 space-y-4">
          <p className="text-[11px] leading-relaxed text-[var(--gc-muted)]">
            {t("hint", { preset: presetPages })}
          </p>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
              {t("pageCountLabel")}
            </p>
            <div className="flex flex-wrap gap-2">
              {PAGE_PRESETS.filter((n) => n <= COMIC_MAX_PAGES).map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => patch({ pageCount: n })}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition disabled:opacity-50 ${
                    value.pageCount === n
                      ? "border-[color:var(--gc-accent)] text-[var(--gc-accent)]"
                      : "border-[color:var(--gc-border)] text-[var(--gc-muted)]"
                  }`}
                  data-testid={`comic-advanced-pages-${n}`}
                >
                  {t("pagesOption", { count: n })}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
              {t("layoutLabel")}
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {LAYOUT_OPTIONS.map((id) => {
                const layout = COMIC_LAYOUTS[id];
                const selected = value.layoutId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={disabled}
                    onClick={() => patch({ layoutId: id })}
                    className={`rounded-lg border px-2.5 py-2 text-left text-xs transition disabled:opacity-50 ${
                      selected
                        ? "border-[color:var(--gc-accent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)]"
                        : "border-[color:var(--gc-border)] hover:border-[color:var(--gc-accent)]/30"
                    }`}
                    data-testid={`comic-advanced-layout-${id}`}
                  >
                    <span className="font-semibold text-[var(--gc-text)]">{t(`layout_${id}`)}</span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-[var(--gc-muted)]">
                      {t("panelsPerPage", { count: layout.panelsPerPage })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
