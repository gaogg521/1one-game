"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { displayNovelSummary, normalizeNovelTitle } from "@/lib/novel-display";
import { useAutoWorkCover, WorkCoverPlaceholder } from "@/hooks/use-auto-work-cover";
import { novelCoverCardFrameClass } from "@/lib/cover-display-sizes";

interface NovelWork {
  id: string;
  title: string;
  summary: string | null;
  prompt: string;
  coverPath: string | null;
  playCount: number;
  likeCount: number;
  createdAt: string;
}

function NovelCard({
  novel,
  locale,
  onCoverUpdate,
}: {
  novel: NovelWork;
  locale: AppLocale;
  onCoverUpdate?: (id: string, path: string) => void;
}) {
  const tf = useTranslations("featured");
  const tl = useTranslations("lists");
  const title = normalizeNovelTitle(novel.title, novel.prompt, undefined, locale);
  const blurb = displayNovelSummary(novel.summary, title, novel.prompt, undefined, locale);
  const { displayCover, coverFailed, coverPending, retryCover } = useAutoWorkCover({
    kind: "novel",
    id: novel.id,
    coverPath: novel.coverPath,
    locale,
    onUpdated: (path) => onCoverUpdate?.(novel.id, path),
  });

  return (
    <Link
      href={withLocalePath(`/novel/${novel.id}`, locale)}
      className="group flex flex-col overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:shadow-md"
    >
      <div className={novelCoverCardFrameClass}>
        {displayCover ? (
          <img
            src={displayCover}
            alt={title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <WorkCoverPlaceholder
            icon="📖"
            failedLabel={tl("coverFailed")}
            generatingLabel={tl("coverGenerating")}
            retryLabel={tl("coverRetry")}
            coverFailed={coverFailed}
            coverPending={coverPending}
            onRetry={retryCover}
            testId={`novel-list-cover-retry-${novel.id}`}
          />
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-3 py-2">
        <p className="line-clamp-1 text-sm font-semibold text-[var(--gc-text)]">{title}</p>
        {blurb && <p className="line-clamp-1 text-xs text-[var(--gc-muted)]">{blurb}</p>}
        <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--gc-text-faint)]">
          {novel.playCount > 0 && <span>▶ {tf("readsShort", { count: novel.playCount })}</span>}
          {novel.likeCount > 0 && <span>♥ {novel.likeCount}</span>}
        </div>
      </div>
    </Link>
  );
}

export default function NovelsPage() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("lists");
  const tc = useTranslations("common");
  const [novels, setNovels] = useState<NovelWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"playCount" | "likeCount" | "createdAt">("playCount");

  useEffect(() => {
    fetch(`/api/novel?sort=${sort}&limit=48`)
      .then((r) => r.json())
      .then((d) => {
        setNovels(d.novels ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sort]);

  return (
    <AppPageShell data-module="novel" className="text-[var(--gc-text)]">
      <SiteHeader />
      <AppMain>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:py-10 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,#818cf8_18%,transparent)] text-xl">
            📖
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--gc-text)]">{t("novelsTitle")}</h1>
            <p className="text-xs text-[var(--gc-muted)]">{t("novelsDesc")}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-0.5">
            {([
              { key: "playCount", label: t("hot") },
              { key: "likeCount", label: t("mostLiked") },
              { key: "createdAt", label: t("latest") },
            ] as const).map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  sort === s.key
                    ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] text-[var(--gc-text)]"
                    : "text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Link
            href={withLocalePath("/novel/create", locale)}
            className="gc-theme-cta ml-auto inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-semibold shadow-lg hover:brightness-110"
          >
            {t("createNovel")}
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={`${novelCoverCardFrameClass} animate-pulse rounded-xl bg-[var(--gc-surface-glass)]`} />
            ))}
          </div>
        ) : novels.length === 0 ? (
          <div className="gc-card flex flex-col items-center justify-center gap-4 px-8 py-20 text-center">
            <p className="text-sm text-[var(--gc-muted)]">{t("noNovels")}</p>
            <Link href={withLocalePath("/novel/create", locale)} className="gc-theme-cta rounded-full px-6 py-2 text-sm font-semibold">
              {tc("goCreate")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {novels.map((n) => (
              <NovelCard
                key={n.id}
                novel={n}
                locale={locale}
                onCoverUpdate={(id, coverPath) => {
                  setNovels((prev) => prev.map((x) => (x.id === id ? { ...x, coverPath } : x)));
                }}
              />
            ))}
          </div>
        )}
      </main>
      </AppMain>
    </AppPageShell>
  );
}
