"use client";

import Link from "next/link";
import { CoverThumb } from "@/components/CoverThumb";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { CreatorCenterPanel } from "@/components/CreatorCenterPanel";
import { StudioAdaptationSummary } from "@/components/studio/StudioAdaptationSummary";
import { StudioComicPanelProgress } from "@/components/studio/StudioComicPanelProgress";
import { WorkStatusBadge } from "@/components/work/WorkStatusBadge";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { superAdminFetchInit } from "@/lib/super-admin-client";
import { formatStudioWorkSummary } from "@/lib/i18n/studio-work-summary";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";
import { prefetchGameProjectsByIds } from "@/lib/studio-godot-prefetch.client";

type WorkType = "project" | "novel" | "comic";

type BaseRow = {
  id: string;
  title: string;
  prompt: string;
  status: string;
  shareCode: string | null;
  coverPath: string | null;
  playCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
};

type WorkRow = BaseRow & { type: WorkType };

function formatWhen(iso: string, localeTag: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(localeTag, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function getWorkLink(type: WorkType, id: string, locale: AppLocale): string {
  switch (type) {
    case "project":
      return withLocalePath(`/play/${id}`, locale);
    case "novel":
      return withLocalePath(`/novel/${id}`, locale);
    case "comic":
      return withLocalePath(`/comic/${id}`, locale);
    default:
      return withLocalePath(`/`, locale);
  }
}

function getWorkIcon(type: WorkType): string {
  switch (type) {
    case "project":
      return "🎮";
    case "novel":
      return "📖";
    case "comic":
      return "🎨";
    default:
      return "📦";
  }
}

function getWorkTypeLabel(type: WorkType, t: ReturnType<typeof useTranslations>): string {
  switch (type) {
    case "project":
      return t("studio.workType.project");
    case "novel":
      return t("studio.workType.novel");
    case "comic":
      return t("studio.workType.comic");
    default:
      return t("studio.workType.default");
  }
}

async function readApiJson(res: Response): Promise<unknown | null> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return null;
  try {
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function normalizeWorkRow(
  row: Partial<BaseRow> & { id?: string },
  defaults: { playCount?: number },
): BaseRow | null {
  if (!row.id || typeof row.title !== "string" || typeof row.prompt !== "string") return null;
  const createdAt =
    typeof row.createdAt === "string" ? row.createdAt : new Date(0).toISOString();
  const updatedAt =
    typeof row.updatedAt === "string" ? row.updatedAt : createdAt;
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    status: typeof row.status === "string" ? row.status : "ready",
    shareCode:
      row.shareCode === null
        ? null
        : typeof row.shareCode === "string"
          ? row.shareCode
          : null,
    coverPath:
      row.coverPath === null
        ? null
        : typeof row.coverPath === "string"
          ? row.coverPath
          : null,
    playCount: typeof row.playCount === "number" ? row.playCount : defaults.playCount ?? 0,
    likeCount: typeof row.likeCount === "number" ? row.likeCount : 0,
    createdAt,
    updatedAt,
  };
}

export default function StudioPage() {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const localeTag = locale === "zh-Hant" ? "zh-TW" : locale === "en" ? "en-US" : locale === "ms" ? "ms-MY" : locale === "th" ? "th-TH" : "zh-CN";
  const [rows, setRows] = useState<WorkRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<WorkType | "all">("all");
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!rows) return null;
    let t = rows;
    if (activeFilter !== "all") {
      t = t.filter((r) => r.type === activeFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return t;
    return t.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.prompt.toLowerCase().includes(q) ||
        (r.shareCode && r.shareCode.toLowerCase().includes(q)),
    );
  }, [rows, query, activeFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const warnings: string[] = [];

      try {
        const headers = mergeLocaleHeaders(locale);
        const [projectsRes, novelsRes, comicsRes] = await Promise.all([
          fetch("/api/projects", { headers }),
          fetch("/api/novel?limit=100&mine=1", { headers }),
          fetch("/api/comic?limit=100&mine=1", { headers }),
        ]);

        const projectsPayload = await readApiJson(projectsRes);
        const novelsPayload = await readApiJson(novelsRes);
        const comicsPayload = await readApiJson(comicsRes);

        const projectsRaw =
          projectsRes.ok &&
          projectsPayload &&
          typeof projectsPayload === "object" &&
          Array.isArray((projectsPayload as { projects?: unknown }).projects)
            ? ((projectsPayload as { projects: Partial<BaseRow>[] }).projects ?? [])
            : [];
        if (!projectsRes.ok && projectsRes.status !== 401) {
          const err =
            projectsPayload &&
            typeof projectsPayload === "object" &&
            "error" in projectsPayload
              ? String((projectsPayload as { error: unknown }).error)
              : null;
          warnings.push(
            err
              ? t("studioErrors.gamesListError", { error: err })
              : t("studioErrors.gamesListFailed", { status: String(projectsRes.status) }),
          );
        }

        const novelsRaw =
          novelsRes.ok &&
          novelsPayload &&
          typeof novelsPayload === "object" &&
          Array.isArray((novelsPayload as { novels?: unknown }).novels)
            ? ((novelsPayload as { novels: Partial<BaseRow>[] }).novels ?? [])
            : [];
        if (!novelsRes.ok) {
          const err =
            novelsPayload &&
            typeof novelsPayload === "object" &&
            "error" in novelsPayload
              ? String((novelsPayload as { error: unknown }).error)
              : null;
          warnings.push(
            err
              ? t("studioErrors.novelsListError", { error: err })
              : t("studioErrors.novelsListFailed", { status: String(novelsRes.status) }),
          );
        } else if (!novelsPayload && novelsRes.status !== 204) {
          warnings.push(t("studioErrors.novelsJsonFailed"));
        }

        const comicsRaw =
          comicsRes.ok &&
          comicsPayload &&
          typeof comicsPayload === "object" &&
          Array.isArray((comicsPayload as { comics?: unknown }).comics)
            ? ((comicsPayload as { comics: Partial<BaseRow>[] }).comics ?? [])
            : [];
        if (!comicsRes.ok) {
          const err =
            comicsPayload &&
            typeof comicsPayload === "object" &&
            "error" in comicsPayload
              ? String((comicsPayload as { error: unknown }).error)
              : null;
          warnings.push(
            err
              ? t("studioErrors.comicsListError", { error: err })
              : t("studioErrors.comicsListFailed", { status: String(comicsRes.status) }),
          );
        } else if (!comicsPayload && comicsRes.status !== 204) {
          warnings.push(t("studioErrors.comicsJsonFailed"));
        }

        const allWorks: WorkRow[] = [];
        for (const p of projectsRaw) {
          const row = normalizeWorkRow(p, {});
          if (row) allWorks.push({ ...row, type: "project" });
        }
        for (const n of novelsRaw) {
          const row = normalizeWorkRow(n, {});
          if (row) allWorks.push({ ...row, type: "novel" });
        }
        for (const c of comicsRaw) {
          const row = normalizeWorkRow(c, { playCount: 0 });
          if (row) allWorks.push({ ...row, type: "comic" });
        }

        allWorks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        if (!cancelled) {
          setRows(allWorks);
          setError(warnings.length ? warnings.join(t("studioErrors.listWarningSeparator")) : null);
          const gameIds = allWorks.filter((w) => w.type === "project").map((w) => w.id);
          prefetchGameProjectsByIds(gameIds, 8);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("studioErrors.unknownError");
        if (!cancelled) {
          setRows([]);
          setError(t("studioErrors.loadFailed", { msg }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t, locale]);

  async function remove(id: string, type: WorkType) {
    if (!confirm(t("studioErrors.confirmDeleteOne"))) return;
    let res: Response;
    const delInit = superAdminFetchInit({ method: "DELETE", headers: mergeLocaleHeaders(locale) });
    switch (type) {
      case "project":
        res = await fetch(`/api/projects/${id}`, delInit);
        break;
      case "novel":
        res = await fetch(`/api/novel/${id}`, delInit);
        break;
      case "comic":
        res = await fetch(`/api/comic/${id}`, delInit);
        break;
    }
    if (!res!.ok) return;
    setRows((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
  }

  async function duplicateProject(id: string) {
    const res = await fetch(`/api/projects/${id}/duplicate`, {
      method: "POST",
      headers: mergeLocaleHeaders(locale),
    });
    const data = (await res.json()) as {
      project?: { id: string };
      error?: string;
      errorKey?: string;
      errorParams?: Record<string, string | number>;
    };
    if (!res.ok) {
      alert(resolveClientApiError(locale, data, "duplicateFailed"));
      return;
    }
    if (data.project?.id) {
      router.push(`/play/${data.project.id}`);
    }
  }

  async function duplicateNovel(id: string) {
    const res = await fetch(`/api/novel/${id}/duplicate`, {
      method: "POST",
      headers: mergeLocaleHeaders(locale),
    });
    const data = (await res.json()) as {
      novel?: { id: string };
      error?: string;
      errorKey?: string;
      errorParams?: Record<string, string | number>;
    };
    if (!res.ok) {
      alert(resolveClientApiError(locale, data, "duplicateFailed"));
      return;
    }
    if (data.novel?.id) router.push(`/novel/${data.novel.id}`);
  }

  async function duplicateComic(id: string) {
    const res = await fetch(`/api/comic/${id}/duplicate`, {
      method: "POST",
      headers: mergeLocaleHeaders(locale),
    });
    const data = (await res.json()) as {
      comic?: { id: string };
      error?: string;
      errorKey?: string;
      errorParams?: Record<string, string | number>;
    };
    if (!res.ok) {
      alert(resolveClientApiError(locale, data, "duplicateFailed"));
      return;
    }
    if (data.comic?.id) router.push(`/comic/${data.comic.id}`);
  }

  function toggleSelect(type: WorkType, id: string) {
    const key = `${type}-${id}`;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function selectAll() {
    if (!filtered) return;
    const next = new Set<string>();
    filtered.forEach((r) => next.add(`${r.type}-${r.id}`));
    setSelectedIds(next);
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(t("studioErrors.confirmBatchDelete", { count: selectedIds.size }))) return;

    const items = Array.from(selectedIds).map((key) => {
      const [type, id] = key.split("-");
      return { id, type: type as WorkType };
    });

    try {
      const res = await fetch("/api/studio/batch-delete", superAdminFetchInit({
        method: "DELETE",
        headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
        body: JSON.stringify({ items }),
      }));

      const data = (await readApiJson(res)) as {
        ok?: boolean;
        deletedCount?: number;
        errors?: string[];
        error?: string;
        errorKey?: string;
        errorParams?: Record<string, string | number>;
      };

      if (res.ok && data?.ok) {
        const deletedSet = new Set(Array.from(selectedIds));
        setRows((prev) => (prev ? prev.filter((r) => !deletedSet.has(`${r.type}-${r.id}`)) : prev));
        setSelectedIds(new Set());
        setIsBatchMode(false);
        if (data.errors && data.errors.length > 0) {
          alert(t("studioErrors.batchDeletePartial", { errors: data.errors.join("\n") }));
        }
      } else {
        alert(resolveClientApiError(locale, data, "batchDeleteFailed"));
      }
    } catch (e) {
      alert(
        t("studioErrors.batchDeleteError", {
          msg: e instanceof Error ? e.message : t("studioErrors.unknownError"),
        }),
      );
    }
  }

  const filterButtons: { key: WorkType | "all"; label: string }[] = [
    { key: "all", label: t("studio.all") },
    { key: "project", label: t("studio.game") },
    { key: "novel", label: t("studio.novel") },
    { key: "comic", label: t("studio.comic") },
  ];

  return (
    <AppPageShell className="text-[var(--gc-text)]">
      <SiteHeader />
      <AppMain>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:py-10 lg:px-8 xl:pr-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--gc-text)]">{t("studio.title")}</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--gc-muted)]">
              {t("studio.desc")}
            </p>
          </div>
          <div className="flex gap-3">
            {rows && rows.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsBatchMode(!isBatchMode);
                  setSelectedIds(new Set());
                }}
                className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-5 py-2.5 text-sm font-semibold hover:bg-[var(--gc-surface-glass)]"
              >
                {isBatchMode ? t("studio.cancelManage") : t("studio.bulkManage")}
              </button>
            )}
            <Link
              href={withLocalePath("/start", locale)}
              className="gc-theme-cta rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg hover:brightness-110"
            >
              {t("studio.newWork")}
            </Link>
          </div>
        </div>

        {rows && rows.length > 0 ? <CreatorCenterPanel works={rows} /> : null}

        <StudioAdaptationSummary />
        <StudioComicPanelProgress />

        {error ? (
          <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
        ) : null}

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setActiveFilter(btn.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                activeFilter === btn.key
                  ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] text-[var(--gc-text)]"
                  : "text-[var(--gc-muted)] hover:text-[var(--gc-text)] border border-[color:var(--gc-border)]"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {rows && rows.length > 0 ? (
          <div className="max-w-md">
            <label htmlFor="studio-search" className="sr-only">
              {t("studio.searchWorks")}
            </label>
            <input
              id="studio-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("studio.searchPlaceholder")}
              className="w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-4 py-2.5 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--gc-accent)_25%,transparent)]"
            />
          </div>
        ) : null}

        {isBatchMode && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4 shadow-sm">
            <div className="flex items-center gap-3 text-sm">
              <span>{t("studio.selectedCount", { count: selectedIds.size })}</span>
              <button
                type="button"
                onClick={selectedIds.size === filtered?.length ? clearSelection : selectAll}
                className="text-xs font-semibold text-[color:var(--gc-accent)] hover:underline cursor-pointer"
              >
                {selectedIds.size === filtered?.length ? t("studio.clearSelect") : t("studio.selectAll")}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={handleBatchDelete}
                className={`rounded-full px-5 py-2 text-xs font-semibold text-white transition ${
                  selectedIds.size === 0
                    ? "bg-red-500/30 text-white/50 cursor-not-allowed border border-transparent"
                    : "bg-red-500 hover:bg-red-600 active:scale-95 shadow-md cursor-pointer border border-transparent"
                }`}
              >
                {t("studio.batchDelete")}
              </button>
            </div>
          </div>
        )}

        {rows === null ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="gc-card h-36 animate-pulse bg-[var(--gc-surface-glass)]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="gc-card flex flex-col items-center justify-center gap-4 px-8 py-20 text-center">
            <p className="text-sm text-[var(--gc-muted)]">{t("studio.empty")}</p>
            <Link
              href={withLocalePath("/start", locale)}
              className="gc-theme-cta rounded-full px-6 py-2 text-sm font-semibold hover:brightness-110"
            >
              {t("studio.goCreate")}
            </Link>
          </div>
        ) : filtered?.length === 0 ? (
          <div className="gc-card px-8 py-14 text-center text-sm text-[var(--gc-muted)]">
            {t("studio.noMatch")}
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2">
            {filtered?.map((r) => {
              const isSelected = selectedIds.has(`${r.type}-${r.id}`);
              return (
                <li
                  key={`${r.type}-${r.id}`}
                  onClick={(e) => {
                    if (isBatchMode) {
                      e.preventDefault();
                      toggleSelect(r.type, r.id);
                    }
                  }}
                  className={`gc-card flex flex-col gap-3 overflow-hidden p-0 transition cursor-pointer relative ${
                    isBatchMode && isSelected
                      ? "border-[color:var(--gc-accent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)] shadow-lg scale-[1.01]"
                      : isBatchMode
                        ? "border-[color:var(--gc-border)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_30%,transparent)]"
                        : "hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,transparent)]"
                  }`}
                >
                  <Link
                    href={getWorkLink(r.type, r.id, locale)}
                    onClick={(e) => {
                      if (isBatchMode) e.preventDefault();
                    }}
                    className="relative block aspect-video w-full overflow-hidden bg-[var(--gc-bg-elevated)]"
                  >
                    {isBatchMode && (
                      <div className="absolute left-3 top-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/60 shadow backdrop-blur-md">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="h-3.5 w-3.5 accent-[var(--gc-accent)] cursor-pointer"
                        />
                      </div>
                    )}
                    <CoverThumb
                      coverPath={r.coverPath}
                      alt={t("studioErrors.coverAlt", { title: r.title })}
                      className="h-full min-h-[140px] w-full object-cover transition duration-300 hover:scale-[1.03]"
                      placeholder={
                        <div className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[color:color-mix(in_srgb,var(--gc-accent)_28%,var(--gc-bg))] to-[color:color-mix(in_srgb,var(--gc-cyan)_18%,var(--gc-bg))]">
                          <span className="text-3xl opacity-50" aria-hidden>
                            {getWorkIcon(r.type)}
                          </span>
                          <span className="text-[11px] font-medium text-[var(--gc-text-faint)]">
                            {r.type === "project" ? t("studio.autoCover") : t("studio.coverGenerating")}
                          </span>
                        </div>
                      }
                    />
                    <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
                      {getWorkTypeLabel(r.type, t)}
                    </span>
                  </Link>
                  <div className="flex flex-col gap-2 px-5 pb-5 pt-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={getWorkLink(r.type, r.id, locale)}
                        onClick={(e) => {
                          if (isBatchMode) e.preventDefault();
                        }}
                        className="truncate text-lg font-semibold text-[var(--gc-text)] hover:text-[color:var(--gc-accent)]"
                      >
                        {r.title}
                      </Link>
                      <WorkStatusBadge status={r.status} />
                    </div>
                    <p className="line-clamp-2 text-sm text-[var(--gc-muted)]">
                      {formatStudioWorkSummary(r, locale)}
                    </p>
                    {r.shareCode ? (
                      <p className="font-mono text-[11px] text-[color:color-mix(in_srgb,var(--gc-accent)_85%,white)]">
                        {t("studio.shortLink", { code: r.shareCode })}
                      </p>
                    ) : null}
                    <p className="text-[11px] uppercase tracking-wider text-[var(--gc-text-faint)]">
                      {t("studio.updatedAt", { time: formatWhen(r.updatedAt, localeTag) })}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-[var(--gc-text-faint)]">
                      {r.playCount > 0 && <span>{t("studio.playCount", { count: r.playCount })}</span>}
                      {r.likeCount > 0 && <span>{t("studio.likeCount", { count: r.likeCount })}</span>}
                    </div>
                  </div>
                  {!isBatchMode && (
                    <div className="flex flex-wrap gap-2 border-t border-[color:var(--gc-border)] px-5 pb-5 pt-3">
                      <Link
                        href={getWorkLink(r.type, r.id, locale)}
                        className="rounded-full bg-[var(--gc-surface-glass-strong)] px-4 py-1.5 text-xs font-medium text-[var(--gc-text)] hover:bg-[color:color-mix(in_srgb,var(--gc-text)_14%,transparent)]"
                      >
                        {t("studio.open")}
                      </Link>
                      {r.type === "project" && (
                        <>
                          <Link
                            href={withLocalePath(`/create?from=${encodeURIComponent(r.id)}`, locale)}
                            className="rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_14%,transparent)] px-4 py-1.5 text-xs font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_22%,transparent)]"
                          >
                            {t("studio.regenerate")}
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void duplicateProject(r.id);
                            }}
                            className="rounded-full border border-[color:var(--gc-border)] px-4 py-1.5 text-xs font-medium text-[var(--gc-text-soft)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_50%,transparent)] hover:text-[var(--gc-text)]"
                          >
                            {t("studio.duplicate")}
                          </button>
                        </>
                      )}
                      {r.type === "novel" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void duplicateNovel(r.id);
                          }}
                          className="rounded-full border border-[color:var(--gc-border)] px-4 py-1.5 text-xs font-medium text-[var(--gc-text-soft)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_50%,transparent)] hover:text-[var(--gc-text)]"
                        >
                          {t("studio.duplicate")}
                        </button>
                      )}
                      {r.type === "comic" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void duplicateComic(r.id);
                          }}
                          className="rounded-full border border-[color:var(--gc-border)] px-4 py-1.5 text-xs font-medium text-[var(--gc-text-soft)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_50%,transparent)] hover:text-[var(--gc-text)]"
                        >
                          {t("studio.duplicate")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void remove(r.id, r.type);
                        }}
                        className="ml-auto rounded-full px-3 py-1.5 text-xs text-[var(--gc-muted)] hover:text-red-400"
                      >
                        {t("studio.delete")}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
      </AppMain>
    </AppPageShell>
  );
}
