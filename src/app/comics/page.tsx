"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { useAutoWorkCover, WorkCoverPlaceholder } from "@/hooks/use-auto-work-cover";
import { comicCoverFromImageUrls } from "@/lib/comic-display";
import { comicCoverCardFrameClass } from "@/lib/cover-display-sizes";
import { MobileSwipeFeedPromo } from "@/components/mobile/MobileSwipeFeedPromo";
import { ComicNovelSourceMeta } from "@/components/comic/ComicNovelSourceMeta";

interface ComicWork {
  id: string;
  title: string;
  prompt: string;
  coverPath: string | null;
  imageUrls?: string;
  likeCount: number;
  createdAt: string;
  novel?: { id?: string; title: string } | null;
}

function ComicCard({
  comic,
  locale,
  onCoverUpdate,
}: {
  comic: ComicWork;
  locale: AppLocale;
  onCoverUpdate?: (id: string, path: string) => void;
}) {
  const t = useTranslations("lists");
  const panelFallback = comic.imageUrls ? comicCoverFromImageUrls(comic.imageUrls) : null;
  const { displayCover, coverFailed, coverPending, retryCover } = useAutoWorkCover({
    kind: "comic",
    id: comic.id,
    coverPath: comic.coverPath,
    locale,
    fallbackCover: panelFallback,
    onUpdated: (path) => onCoverUpdate?.(comic.id, path),
  });

  return (
    <Link
      href={withLocalePath(`/comic/${comic.id}`, locale)}
      className="group flex flex-col overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:shadow-md"
    >
      <div className={comicCoverCardFrameClass}>
        {displayCover ? (
          <img
            src={displayCover}
            alt={comic.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <WorkCoverPlaceholder
            icon="🎨"
            failedLabel={t("coverFailed")}
            generatingLabel={t("coverGenerating")}
            retryLabel={t("coverRetry")}
            coverFailed={coverFailed}
            coverPending={coverPending}
            onRetry={retryCover}
            testId={`comic-list-cover-retry-${comic.id}`}
          />
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-3 py-2">
        <p className="line-clamp-1 text-sm font-semibold text-[var(--gc-text)]">{comic.title}</p>
        <ComicNovelSourceMeta
          novel={comic.novel}
          locale={locale}
          className="line-clamp-1 text-xs text-[var(--gc-muted)]"
          insideCardLink
        />
        <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--gc-text-faint)]">
          {comic.likeCount > 0 && <span>♥ {comic.likeCount}</span>}
        </div>
      </div>
    </Link>
  );
}

export default function ComicsPage() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("lists");
  const tc = useTranslations("common");
  const [comics, setComics] = useState<ComicWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"likeCount" | "createdAt">("likeCount");

  useEffect(() => {
    fetch(`/api/comic?sort=${sort}&limit=48`)
      .then((r) => r.json())
      .then((d) => {
        setComics(d.comics ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sort]);

  return (
    <AppPageShell data-module="comic" className="text-[var(--gc-text)]">
      <SiteHeader />
      <AppMain>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:py-10 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,#c084fc_18%,transparent)] text-xl">
            🎨
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--gc-text)]">{t("comicsTitle")}</h1>
            <p className="text-xs text-[var(--gc-muted)]">{t("comicsDesc")}</p>
          </div>
        </div>

        <MobileSwipeFeedPromo kind="comic" />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-0.5">
            {([
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
            href={withLocalePath("/comic/create", locale)}
            className="gc-theme-cta ml-auto inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-semibold shadow-lg hover:brightness-110"
          >
            {t("createComic")}
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={`${comicCoverCardFrameClass} animate-pulse rounded-xl bg-[var(--gc-surface-glass)]`} />
            ))}
          </div>
        ) : comics.length === 0 ? (
          <div className="gc-card flex flex-col items-center justify-center gap-4 px-8 py-20 text-center">
            <p className="text-sm text-[var(--gc-muted)]">{t("noComics")}</p>
            <Link href={withLocalePath("/comic/create", locale)} className="gc-theme-cta rounded-full px-6 py-2 text-sm font-semibold">
              {tc("goCreate")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {comics.map((c) => (
              <ComicCard
                key={c.id}
                comic={c}
                locale={locale}
                onCoverUpdate={(id, coverPath) => {
                  setComics((prev) => prev.map((x) => (x.id === id ? { ...x, coverPath } : x)));
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
