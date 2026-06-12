"use client";

import { useEffect, useState, useTransition } from "react";
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

interface Comic {
  id: string;
  title: string;
  imageUrls?: string;
  coverPath?: string | null;
  novel: { title: string };
  createdAt: string;
  likeCount: number;
  isOwner?: boolean;
  canDelete?: boolean;
}

function ComicCard({ c, onDeleted }: { c: Comic; onDeleted?: (id: string) => void }) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [liked, setLiked] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return !!localStorage.getItem(`liked:comic:${c.id}`);
  });
  const [likes, setLikes] = useState(c.likeCount);

  function coverImage(): string | null {
    if (c.coverPath?.trim()) return c.coverPath.trim();
    if (!c.imageUrls) return null;
    try {
      const parsed = JSON.parse(c.imageUrls) as unknown;
      if (Array.isArray(parsed)) {
        return (parsed[0] as { imageUrl?: string } | undefined)?.imageUrl?.trim() || null;
      }
      if (parsed && typeof parsed === "object" && "pages" in parsed) {
        const pages = (parsed as { pages: { panels?: { imageUrl?: string }[] }[] }).pages;
        for (const page of pages) {
          for (const panel of page.panels ?? []) {
            if (panel.imageUrl?.trim()) return panel.imageUrl.trim();
          }
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (liked) return;
    setLiked(true);
    setLikes((n) => n + 1);
    localStorage.setItem(`liked:comic:${c.id}`, "1");
    void fetch(`/api/comic/${c.id}/like`, { method: "POST", headers: mergeLocaleHeaders(locale) });
  }

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

  const img = coverImage();

  return (
    <Link
      href={withLocalePath(`/comic/${c.id}`, locale)}
      className="group relative flex flex-col rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4 transition hover:border-[color:var(--gc-accent)]/40"
    >
      {c.isOwner || c.canDelete ? (
        <button
          type="button"
          title={c.canDelete && !c.isOwner ? t("lists.adminDelete") : t("studio.delete")}
          onClick={(e) => void handleDelete(e)}
          className="absolute right-3 top-3 z-10 rounded-lg bg-black/65 px-2 py-1 text-[10px] font-medium text-red-200 opacity-90 backdrop-blur-sm transition hover:bg-red-950/80 group-hover:opacity-100"
        >
          {c.canDelete && !c.isOwner ? t("lists.adminDelete") : t("studio.delete")}
        </button>
      ) : null}
      {img ? (
        <div className="mb-3 aspect-[4/3] overflow-hidden rounded-lg bg-[var(--gc-bg)]">
          <img
            src={img}
            alt={c.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="mb-3 flex aspect-[4/3] items-center justify-center rounded-lg bg-[var(--gc-bg)] text-xs text-[var(--gc-muted)]">
          {t("lists.noPreview")}
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--gc-text)] group-hover:text-[var(--gc-accent)]">
        {c.title}
      </h3>
      <p className="mt-1 text-xs text-[var(--gc-muted)]">{t("lists.basedOnNovel", { title: c.novel.title })}</p>
      <div className="mt-auto flex items-center justify-between pt-3 text-[10px] text-[var(--gc-muted)]">
        <span>{new Date(c.createdAt).toLocaleDateString()}</span>
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
    </Link>
  );
}

export default function ComicDiscoverPage() {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [comics, setComics] = useState<Comic[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 24;
  const [loading, setLoading] = useState(true);

  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => setLoading(true));
    fetch(
      `/api/comic?page=${page}&limit=${limit}`,
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
      })
      .finally(() => setLoading(false));
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

          {loading ? (
            <p className="text-[var(--gc-muted)]">{t("common.loading")}</p>
          ) : comics.length === 0 ? (
            <div className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-8 text-center">
              <p className="text-[var(--gc-muted)]">{t("lists.noComics")}</p>
              <Link href={withLocalePath("/comic/create", locale)} className="mt-3 inline-block text-sm text-[var(--gc-accent)]">
                {t("common.startCreateArrow")}
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {comics.map((c) => (
                  <ComicCard
                    key={c.id}
                    c={c}
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

