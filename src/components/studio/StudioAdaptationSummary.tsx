"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { ComicChapterScope } from "@/lib/comic-chapter-scope";

type Item = {
  novelId: string;
  title: string;
  totalChapters: number;
  adaptedCount: number;
  percent: number;
  nextChapter: ComicChapterScope | null;
};

export function StudioAdaptationSummary() {
  const t = useTranslations("adaptation");
  const locale = useLocale() as AppLocale;
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/studio/adaptation-summary")
      .then((r) => r.json())
      .then((d: { items?: Item[] }) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section className="mb-8 rounded-2xl border border-[color:color-mix(in_srgb,var(--gc-accent)_22%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_5%,transparent)] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--gc-text)]">{t("title")}</h2>
        <span className="text-[11px] text-[var(--gc-muted)]">{t("countLabel", { count: items.length })}</span>
      </div>
      <ul className="flex flex-col gap-3">
        {items.slice(0, 6).map((item) => (
          <li key={item.novelId} className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={withLocalePath(`/novel/${item.novelId}`, locale)}
                className="text-sm font-medium text-[var(--gc-text)] hover:text-[var(--gc-accent)]"
              >
                {item.title}
              </Link>
              <span className="text-[11px] text-[var(--gc-muted)]">
                {t("chapterProgress", {
                  adapted: item.adaptedCount,
                  total: item.totalChapters,
                  percent: item.percent,
                })}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--gc-border)_80%,transparent)]">
              <div
                className="h-full rounded-full bg-[color:color-mix(in_srgb,var(--gc-accent)_75%,white)]"
                style={{ width: `${item.percent}%` }}
              />
            </div>
            {item.nextChapter ? (
              <Link
                href={withLocalePath(
                  `/novel/${item.novelId}?comicChapter=${item.nextChapter.fromChapter}`,
                  locale,
                )}
                className="mt-2 inline-block text-[11px] text-[var(--gc-accent)]"
              >
                {t("continueAdapt", { label: item.nextChapter.label })}
              </Link>
            ) : (
              <p className="mt-2 text-[11px] text-[var(--gc-text-faint)]">{t("allAdapted")}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
