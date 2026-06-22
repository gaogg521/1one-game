"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { DiscoverIntakeBanner } from "@/components/DiscoverIntakeBanner";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { SuperAdminPanel } from "@/components/SuperAdminPanel";
import { superAdminFetchInit } from "@/lib/super-admin-client";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";
import { comicCoverFromImageUrls } from "@/lib/comic-display";
import { useAutoWorkCover, WorkCoverPlaceholder } from "@/hooks/use-auto-work-cover";
import { comicCoverCardFrameClass } from "@/lib/cover-display-sizes";
import { MobileSwipeFeedPromo } from "@/components/mobile/MobileSwipeFeedPromo";
import { ComicNovelSourceMeta } from "@/components/comic/ComicNovelSourceMeta";
import { DiscoverSortBar, type ComicDiscoverSort } from "@/components/work/DiscoverSortBar";
import { DiscoverListSkeleton } from "@/components/work/DiscoverListSkeleton";
import { WorkLikeButton } from "@/components/work/WorkLikeButton";

interface Comic {
  id: string;
  title: string;
  imageUrls?: string;
  coverPath?: string | null;
  novel?: { id?: string; title: string } | null;
  createdAt: string;
  likeCount: number;
  featured?: boolean;
  isOwner?: boolean;
  canDelete?: boolean;
}

function ComicCard({
  c,
  onDeleted,
  onCoverUpdate,
}: {
  c: Comic;
  onDeleted?: (id: string) => void;
  onCoverUpdate?: (id: string, coverPath: string) => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const panelFallback = useMemo(
    () => (c.imageUrls ? comicCoverFromImageUrls(c.imageUrls) : null),
    [c.imageUrls],
  );
  const { displayCover, coverFailed, coverPending, retryCover } = useAutoWorkCover({
    kind: "comic",
    id: c.id,
    coverPath: c.coverPath,
    locale,
    fallbackCover: panelFallback,
    onUpdated: (path) => onCoverUpdate?.(c.id, path),
  });

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(t("lists.deleteConfirmComic", { title: c.title }))) return;
    const res = await fetch(
      `/api/comic/${c.id}`,
      superAdminFetchInit({ method: "DELETE", headers: mergeLocaleHeaders(locale) }),
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        errorKey?: string;
        errorParams?: Record<string, string | number>;
      };
      alert(resolveClientApiError(locale, data, "deleteFailed"));
      return;
    }
    onDeleted?.(c.id);
  }

  return (
    <Link
      href={withLocalePath(`/comic/${c.id}`, locale)}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition hover:border-[color:var(--gc-accent)]/40"
    >
      {c.isOwner || c.canDelete ? (
        <button
          type="button"
          title={c.canDelete && !c.isOwner ? t("lists.adminDelete") : t("studio.delete")}
          onClick={(e) => void handleDelete(e)}
          className="absolute right-2 top-2 z-10 rounded-lg bg-black/65 px-2 py-1 text-[10px] font-medium text-red-200 opacity-90 backdrop-blur-sm transition hover:bg-red-950/80 group-hover:opacity-100"
        >
          {c.canDelete && !c.isOwner ? t("lists.adminDelete") : t("studio.delete")}
        </button>
      ) : null}
      <div className={comicCoverCardFrameClass}>
        {displayCover ? (
          <img
            src={displayCover}
            alt={c.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <WorkCoverPlaceholder
            icon="🎨"
            failedLabel={t("lists.coverFailed")}
            generatingLabel={t("lists.coverGenerating")}
            retryLabel={t("lists.coverRetry")}
            coverFailed={coverFailed}
            coverPending={coverPending}
            onRetry={retryCover}
            testId={`comic-cover-retry-${c.id}`}
          />
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-2.5">
        <div className="flex items-start gap-1.5">
          <h3 className="line-clamp-1 flex-1 text-sm font-semibold text-[var(--gc-text)] group-hover:text-[var(--gc-accent)]">
            {c.title}
          </h3>
          {c.featured ? (
            <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--gc-accent)_18%,transparent)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--gc-accent)]">
              {t("lists.comicFeaturedBadge")}
            </span>
          ) : null}
        </div>
        <ComicNovelSourceMeta
          novel={c.novel}
          locale={locale}
          className="line-clamp-1 text-[11px] text-[var(--gc-muted)]"
          insideCardLink
        />
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--gc-muted)]">
          <span>{new Date(c.createdAt).toLocaleDateString()}</span>
          <WorkLikeButton kind="comic" id={c.id} initialCount={c.likeCount} />
        </div>
      </div>
    </Link>
  );
}

export default function ComicDiscoverPage() {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [comics, setComics] = useState<Comic[]>([]);
  const [featuredComics, setFeaturedComics] = useState<Comic[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<ComicDiscoverSort>("likeCount");
  const limit = 24;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => setLoading(true));
    setLoadError(null);
    fetch(
      `/api/comic?featured=1&limit=6`,
      superAdminFetchInit({ headers: mergeLocaleHeaders(locale) }),
    )
      .then(async (r) => {
        if (!r.ok) return { comics: [] as Comic[] };
        const data = (await r.json()) as { comics?: Comic[] };
        return { comics: data.comics ?? [] };
      })
      .then(({ comics: featured }) => setFeaturedComics(featured))
      .catch(() => setFeaturedComics([]));

    fetch(
      `/api/comic?page=${page}&limit=${limit}&sort=${sort}`,
      superAdminFetchInit({ headers: mergeLocaleHeaders(locale) }),
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ comics?: Comic[]; total?: number }>;
      })
      .then((data) => {
        setComics(data.comics || []);
        setTotal(data.total || 0);
      })
      .catch(() => {
        setComics([]);
        setTotal(0);
        setLoadError(t("common.loadingFailed"));
      })
      .finally(() => setLoading(false));
  }, [page, limit, sort, locale, t]);

  function handleSort(next: ComicDiscoverSort) {
    setSort(next);
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <AppPageShell className="text-[var(--gc-text)]">
      <SiteHeader />
      <AppMain>
      <main className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--gc-text)]">{t("lists.comicsTitle")}</h1>
              <p className="mt-1 text-sm text-[var(--gc-muted)]">{t("lists.comicDiscoverDesc")}</p>
            </div>
            <Link href={withLocalePath("/start", locale)} className="gc-theme-cta rounded-xl px-4 py-2 text-sm font-semibold">
              {t("common.startCreating")}
            </Link>
          </div>

          <div className="mb-6">
            <DiscoverIntakeBanner />
          </div>

          <div className="mb-6">
            <MobileSwipeFeedPromo kind="comic" />
          </div>

          <div className="mb-6">
            <DiscoverSortBar kind="comic" value={sort} onChange={handleSort} />
          </div>

          {!loading && featuredComics.length > 0 ? (
            <section className="mb-8">
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-[var(--gc-text)]">{t("lists.comicFeaturedShelfTitle")}</h2>
                <p className="mt-0.5 text-sm text-[var(--gc-muted)]">{t("lists.comicFeaturedShelfDesc")}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {featuredComics.map((c) => (
                  <ComicCard
                    key={`featured-${c.id}`}
                    c={{ ...c, featured: true }}
                    onCoverUpdate={(id, coverPath) => {
                      setFeaturedComics((prev) => prev.map((x) => (x.id === id ? { ...x, coverPath } : x)));
                      setComics((prev) => prev.map((x) => (x.id === id ? { ...x, coverPath } : x)));
                    }}
                    onDeleted={(id) => {
                      setFeaturedComics((prev) => prev.filter((x) => x.id !== id));
                      setComics((prev) => prev.filter((x) => x.id !== id));
                      setTotal((t) => Math.max(0, t - 1));
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {loadError ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center text-sm text-amber-100/90">
              <p>{loadError}</p>
              <button
                type="button"
                className="mt-3 rounded-lg border border-[color:var(--gc-border)] px-4 py-2 text-[var(--gc-text)]"
                onClick={() => window.location.reload()}
              >
                {t("common.reload")}
              </button>
            </div>
          ) : loading ? (
            <DiscoverListSkeleton frameClass={comicCoverCardFrameClass} />
          ) : comics.length === 0 ? (
            <div className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-8 text-center">
              <p className="text-[var(--gc-muted)]">{t("lists.noComics")}</p>
              <Link href={withLocalePath("/comic/create", locale)} className="mt-3 inline-block text-sm text-[var(--gc-accent)]">
                {t("common.startCreateArrow")}
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {comics.map((c) => (
                  <ComicCard
                    key={c.id}
                    c={c}
                    onCoverUpdate={(id, coverPath) => {
                      setComics((prev) => prev.map((x) => (x.id === id ? { ...x, coverPath } : x)));
                    }}
                    onDeleted={(id) => {
                      setComics((prev) => prev.filter((x) => x.id !== id));
                      setTotal((t) => Math.max(0, t - 1));
                    }}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-[color:var(--gc-border)] px-3 py-1.5 text-sm text-[var(--gc-text)] transition hover:border-[color:var(--gc-accent)]/40 disabled:opacity-40"
                  >
                    {t("common.prevPage")}
                  </button>
                  <span className="text-sm text-[var(--gc-muted)]">
                    {t("common.pageOf", { page, totalPages })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-[color:var(--gc-border)] px-3 py-1.5 text-sm text-[var(--gc-text)] transition hover:border-[color:var(--gc-accent)]/40 disabled:opacity-40"
                  >
                    {t("common.nextPage")}
                  </button>
                </div>
              )}

              <SuperAdminPanel scope="comic" />
            </>
          )}
        </div>
      </main>
      </AppMain>
    </AppPageShell>
  );
}

