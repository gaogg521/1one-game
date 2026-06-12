"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { DiscoverIntakeBanner } from "@/components/DiscoverIntakeBanner";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { displayNovelSummary, normalizeNovelTitle } from "@/lib/novel-display";
import { SuperAdminPanel } from "@/components/SuperAdminPanel";
import { superAdminFetchInit } from "@/lib/super-admin-client";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";

interface Novel {
  id: string;
  title: string;
  summary: string | null;
  prompt: string;
  coverPath: string | null;
  createdAt: string;
  playCount: number;
  likeCount: number;
  isOwner?: boolean;
  canDelete?: boolean;
}

function NovelCard({ n, onDeleted }: { n: Novel; onDeleted?: (id: string) => void }) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const title = normalizeNovelTitle(n.title, n.prompt, undefined, locale);
  const blurb = displayNovelSummary(n.summary, title, n.prompt, undefined, locale);
  const [liked, setLiked] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return !!localStorage.getItem(`liked:novel:${n.id}`);
  });
  const [likes, setLikes] = useState(n.likeCount);

  function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (liked) return;
    setLiked(true);
    setLikes((c) => c + 1);
    localStorage.setItem(`liked:novel:${n.id}`, "1");
    void fetch(`/api/novel/${n.id}/like`, { method: "POST", headers: mergeLocaleHeaders(locale) });
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const title = normalizeNovelTitle(n.title, n.prompt, undefined, locale);
    if (!confirm(t("lists.deleteConfirmNovel", { title }))) return;
    const res = await fetch(
      `/api/novel/${n.id}`,
      superAdminFetchInit({ method: "DELETE", headers: mergeLocaleHeaders(locale) }),
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        errorKey?: string;
        errorParams?: Record<string, string | number>;
      };
      alert(resolveClientApiError(locale, data, "deleteFailedSession"));
      return;
    }
    onDeleted?.(n.id);
  }

  return (
    <Link
      href={withLocalePath(`/novel/${n.id}`, locale)}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition hover:border-[color:var(--gc-accent)]/40"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--gc-bg-elevated)]">
        {n.isOwner || n.canDelete ? (
          <button
            type="button"
            title={n.canDelete && !n.isOwner ? t("lists.adminDelete") : t("studio.delete")}
            onClick={(e) => void handleDelete(e)}
            className="absolute right-2 top-2 z-10 rounded-lg bg-black/65 px-2 py-1 text-[10px] font-medium text-red-200 opacity-90 backdrop-blur-sm transition hover:bg-red-950/80 group-hover:opacity-100"
          >
            {n.canDelete && !n.isOwner ? t("lists.adminDelete") : t("studio.delete")}
          </button>
        ) : null}
        {n.coverPath ? (
          <img
            src={n.coverPath}
            alt={title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--gc-muted)] opacity-60">
            <span className="text-2xl">📖</span>
            <span className="text-[10px]">{t("studio.coverGenerating")}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-[var(--gc-text)] group-hover:text-[var(--gc-accent)]">
          {title}
        </h3>
        {blurb && <p className="line-clamp-2 text-xs text-[var(--gc-text-soft)]">{blurb}</p>}
        <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--gc-muted)]">
          <div className="flex items-center gap-3">
            <span>▶ {n.playCount}</span>
            <span>{new Date(n.createdAt).toLocaleDateString()}</span>
          </div>
          <button
            type="button"
            onClick={handleLike}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition ${
              liked ? "text-red-400" : "text-[var(--gc-text-faint)] hover:text-red-400"
            }`}
          >
            {liked ? "♥" : "♡"} {likes > 0 ? likes : ""}
          </button>
        </div>
      </div>
    </Link>
  );
}

export default function NovelDiscoverPage() {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [novels, setNovels] = useState<Novel[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 24;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let stale = false;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 45_000);
    startTransition(() => setLoading(true));
    setLoadError(null);
    fetch(
      `/api/novel?page=${page}&limit=${limit}`,
      superAdminFetchInit({ signal: ac.signal, headers: mergeLocaleHeaders(locale) }),
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (stale) return;
        setNovels(data.novels || []);
        setTotal(data.total || 0);
      })
      .catch((e: unknown) => {
        if (stale) return;
        setNovels([]);
        setTotal(0);
        const aborted = e instanceof DOMException && e.name === "AbortError";
        setLoadError(aborted ? t("common.loadingTimeout") : t("common.loadingFailed"));
      })
      .finally(() => {
        clearTimeout(timer);
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
      ac.abort();
      clearTimeout(timer);
    };
  }, [page, limit, locale]);

  const totalPages = Math.ceil(total / limit);

  return (
    <AppPageShell className="text-[var(--gc-text)]">
      <SiteHeader />
      <AppMain>
      <main className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--gc-text)]">{t("lists.novelsTitle")}</h1>
              <p className="mt-1 text-sm text-[var(--gc-muted)]">{t("lists.novelDiscoverDesc")}</p>
            </div>
            <Link href={withLocalePath("/start", locale)} className="gc-theme-cta rounded-xl px-4 py-2 text-sm font-semibold">
              {t("common.startCreating")}
            </Link>
          </div>

          <div className="mb-6">
            <DiscoverIntakeBanner />
          </div>

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
            <p className="text-[var(--gc-muted)]">{t("common.loading")}</p>
          ) : novels.length === 0 ? (
            <div className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-8 text-center">
              <p className="text-[var(--gc-muted)]">{t("lists.noNovels")}</p>
              <Link href={withLocalePath("/novel/create", locale)} className="mt-3 inline-block text-sm text-[var(--gc-accent)]">
                {t("common.startCreateArrow")}
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {novels.map((n) => (
                  <NovelCard
                    key={n.id}
                    n={n}
                    onDeleted={(id) => {
                      setNovels((prev) => prev.filter((x) => x.id !== id));
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

              <SuperAdminPanel scope="novel" />
            </>
          )}
        </div>
      </main>
      </AppMain>
    </AppPageShell>
  );
}
