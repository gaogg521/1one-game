"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type ComicRow = {
  id: string;
  title: string;
  imageUrls: string;
  status: string;
};

function countPanels(imageUrls: string): { total: number; withImage: number } {
  try {
    const doc = JSON.parse(imageUrls) as { panels?: { imageUrl?: string }[] };
    const panels = doc.panels ?? [];
    const withImage = panels.filter((p) => p.imageUrl && !p.imageUrl.includes("placeholder")).length;
    return { total: panels.length, withImage };
  } catch {
    return { total: 0, withImage: 0 };
  }
}

export function StudioComicPanelProgress() {
  const t = useTranslations("studioComicProgress");
  const locale = useLocale() as AppLocale;
  const [rows, setRows] = useState<ComicRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/comic?mine=1&limit=40");
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { comics?: ComicRow[] };
      const pending = (data.comics ?? []).filter((c) => {
        const { total, withImage } = countPanels(c.imageUrls);
        return total > 0 && withImage < total;
      });
      if (!cancelled) setRows(pending.slice(0, 8));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-violet-200/80 bg-violet-50/50 p-4 dark:border-violet-800/40 dark:bg-violet-950/20">
      <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-200">{t("title")}</h3>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("desc")}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((c) => {
          const { total, withImage } = countPanels(c.imageUrls);
          const pct = total > 0 ? Math.round((withImage / total) * 100) : 0;
          return (
            <li key={c.id} className="flex items-center gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-800 dark:text-zinc-200">{c.title}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-violet-200/80 dark:bg-violet-900/40">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {t("progress", { withImage, total, pct })}
                </p>
              </div>
              <Link
                href={withLocalePath(`/comic/${c.id}?renderPanels=1`, locale)}
                className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
              >
                {t("continueBtn")}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
