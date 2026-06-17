"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { DiscoverIntakeBanner } from "@/components/DiscoverIntakeBanner";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { prefetchGameProjectsByIds } from "@/lib/studio-godot-prefetch.client";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";
import { superAdminFetchInit } from "@/lib/super-admin-client";
import { listDiscoverTemplateIds } from "@/lib/game-templates/registry";

type DiscoverProject = {
  id: string;
  title: string;
  prompt: string;
  coverPath: string | null;
  playCount: number;
  likeCount: number;
  shareCode: string | null;
  templateId: string | null;
  createdAt: string;
  isOwner?: boolean;
  canDelete?: boolean;
};

const ALL_TEMPLATES = listDiscoverTemplateIds();

function GameCard({ p, locale, onDeleted }: { p: DiscoverProject; locale: AppLocale; onDeleted?: (id: string) => void }) {
  const t = useTranslations();
  const tl = useTranslations("lists");
  const label = p.templateId ? (t.has(`discover.templateLabels.${p.templateId}`) ? t(`discover.templateLabels.${p.templateId}`) : p.templateId) : null;
  const [liked, setLiked] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return !!localStorage.getItem(`liked:${p.id}`);
  });
  const [likes, setLikes] = useState(p.likeCount);

  function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (liked) return;
    setLiked(true);
    setLikes((n) => n + 1);
    localStorage.setItem(`liked:${p.id}`, "1");
    void fetch(`/api/projects/${p.id}/like`, { method: "POST", headers: mergeLocaleHeaders(locale) });
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(tl("deleteConfirmGame", { title: p.title }))) return;
    const res = await fetch(
      `/api/projects/${p.id}`,
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
    onDeleted?.(p.id);
  }

  return (
    <Link
      href={withLocalePath(`/play/${p.id}`, locale)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:shadow-lg"
    >
      <div className="relative aspect-[920/560] w-full overflow-hidden bg-[var(--gc-bg-elevated)]">
        {p.isOwner || p.canDelete ? (
          <button
            type="button"
            title={p.canDelete && !p.isOwner ? tl("adminDelete") : t("studio.delete")}
            onClick={(e) => void handleDelete(e)}
            className="absolute right-2 top-2 z-10 rounded-lg bg-black/65 px-2 py-1 text-[10px] font-medium text-red-200 opacity-90 backdrop-blur-sm transition hover:bg-red-950/80 group-hover:opacity-100"
          >
            {p.canDelete && !p.isOwner ? tl("adminDelete") : t("studio.delete")}
          </button>
        ) : null}
        {p.coverPath ? (
          <img
            src={p.coverPath}
            alt={p.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-[var(--gc-muted)] opacity-30">
            ▶
          </div>
        )}
        {label ? (
          <span className="absolute left-2.5 top-2.5 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
            {label}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 py-3">
        <p className="line-clamp-1 text-sm font-semibold text-[var(--gc-text)]">{p.title}</p>
        <p className="line-clamp-2 text-xs text-[var(--gc-muted)]">{p.prompt}</p>
        <div className="mt-auto flex items-center justify-between pt-1">
          <p className="text-[11px] text-[var(--gc-text-faint)]">
            {p.playCount > 0 ? t("discover.playedTimes", { count: p.playCount }) : t("discover.firstPlayer")}
          </p>
          <button
            type="button"
            onClick={handleLike}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition ${
              liked
                ? "text-red-400"
                : "text-[var(--gc-text-faint)] hover:text-red-400"
            }`}
          >
            {liked ? "♥" : "♡"} {likes > 0 ? likes : ""}
          </button>
        </div>
      </div>
    </Link>
  );
}

type SortKey = "playCount" | "likeCount" | "createdAt" | "hot";

export default function DiscoverPage() {
  const t = useTranslations();
  const tl = useTranslations("lists");
  const locale = useLocale() as AppLocale;
  const [, startTransition] = useTransition();
  const [projects, setProjects] = useState<DiscoverProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("playCount");

  const SORT_OPTIONS = [
    { key: "playCount", label: t("discover.sort.playCount"), subtitle: t("discover.sortSubtitle.playCount") },
    { key: "likeCount", label: t("discover.sort.likeCount"), subtitle: t("discover.sortSubtitle.likeCount") },
    { key: "createdAt", label: t("discover.sort.createdAt"), subtitle: t("discover.sortSubtitle.createdAt") },
    { key: "hot", label: t("discover.sort.hot"), subtitle: t("discover.sortSubtitle.hot") },
  ] as const;

  useEffect(() => {
    let stale = false;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 45_000);
    startTransition(() => {
      setLoading(true);
      setLoadError(null);
    });
    const params = new URLSearchParams();
    if (filter) params.set("template", filter);
    if (sort !== "playCount") params.set("sort", sort);
    const url = `/api/discover${params.size > 0 ? `?${params.toString()}` : ""}`;
    fetch(url, superAdminFetchInit({ signal: ac.signal, headers: mergeLocaleHeaders(locale) }))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { projects?: DiscoverProject[] }) => {
        if (stale) return;
        const list = d.projects ?? [];
        setProjects(list);
        prefetchGameProjectsByIds(
          list.map((p) => p.id),
          8,
        );
      })
      .catch((e: unknown) => {
        if (stale) return;
        setProjects([]);
        const aborted = e instanceof DOMException && e.name === "AbortError";
        setLoadError(
          aborted
            ? t("common.loadingTimeout")
            : t("common.loadingFailed"),
        );
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
  }, [filter, sort, t, locale]);

  const sortMeta = SORT_OPTIONS.find((o) => o.key === sort) ?? SORT_OPTIONS[0];

  return (
    <AppPageShell className="text-[var(--gc-text)]">
      <SiteHeader />
      <AppMain>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:py-10 lg:px-8 xl:pr-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--gc-text)]">{t("discover.title")}</h1>
            <p className="mt-1 text-sm text-[var(--gc-muted)]">{t("discover.desc", { subtitle: sortMeta.subtitle })}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <Link
              href={withLocalePath("/samples", locale)}
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--gc-border)] px-4 py-2 text-xs font-medium text-[var(--gc-muted)] transition hover:border-sky-500/40 hover:text-sky-300"
            >
              {tl("browseSampleGallery")}
            </Link>
            <Link
              href={withLocalePath("/start", locale)}
              className="gc-theme-cta inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold"
            >
              {t("common.startCreating")}
            </Link>
          </div>
        </div>

        <DiscoverIntakeBanner />

        {/* Template filter chips */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              filter === null
                ? "border-[color:color-mix(in_srgb,var(--gc-accent)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_16%,transparent)] text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)]"
                : "border-[color:var(--gc-border)] text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
            }`}
          >
            {t("discover.all")}
          </button>
          {ALL_TEMPLATES.map((templateId) => (
            <button
              key={templateId}
              type="button"
              onClick={() => setFilter(filter === templateId ? null : templateId)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                filter === templateId
                  ? "border-[color:color-mix(in_srgb,var(--gc-accent)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_16%,transparent)] text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)]"
                  : "border-[color:var(--gc-border)] text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
              }`}
            >
              {t.has(`discover.templateLabels.${templateId}`) ? t(`discover.templateLabels.${templateId}`) : templateId}
            </button>
          ))}
        </div>

        {/* Sort tabs */}
        <div className="flex items-center gap-1 border-b border-[color:var(--gc-border)]">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSort(opt.key)}
              className={`-mb-px border-b-2 px-4 py-2 text-xs font-medium transition ${
                sort === opt.key
                  ? "border-[color:var(--gc-accent)] text-[var(--gc-text)]"
                  : "border-transparent text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loadError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-amber-200/90">{loadError}</p>
            <button
              type="button"
              className="rounded-full border border-[color:var(--gc-border)] px-4 py-2 text-sm text-[var(--gc-text)]"
              onClick={() => window.location.reload()}
            >
              {t("common.reload")}
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="aspect-[920/560] animate-pulse rounded-2xl bg-[var(--gc-surface-glass)]" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-[var(--gc-muted)]">
              {t("discover.noGames", {
                suffix: filter ? `（${t.has(`discover.templateLabels.${filter}`) ? t(`discover.templateLabels.${filter}`) : filter}）` : "",
              })}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href={withLocalePath("/samples", locale)}
                className="rounded-full border border-[color:var(--gc-border)] px-6 py-2 text-sm font-medium text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
              >
                {tl("browseSampleGallery")}
              </Link>
              <Link href={withLocalePath("/create", locale)} className="text-sm text-[color:color-mix(in_srgb,var(--gc-accent)_90%,white)] underline underline-offset-4">
                {t("discover.beFirstCreator")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {projects.map((p) => (
              <GameCard
                key={p.id}
                p={p}
                locale={locale}
                onDeleted={(id) => setProjects((prev) => prev.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        )}
      </main>
      </AppMain>
    </AppPageShell>
  );
}
