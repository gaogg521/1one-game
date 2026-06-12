"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { ResultMomentBanner } from "@/components/ResultMomentBanner";
import { ComicEightGridPageGrid } from "@/components/comic/ComicEightGridPageGrid";
import { ComicPictureBookPageGrid } from "@/components/comic/ComicPictureBookPageGrid";
import type { ComicChapterScope } from "@/lib/comic-chapter-scope";
import { parseComicImageUrls, type ComicPage } from "@/lib/comic-format";
import { type ComicLayoutId } from "@/lib/comic-layout";
import type { ComicStylePresetId } from "@/lib/comic-style-presets";
import { formatImageGenElapsed } from "@/lib/format-duration";
import { consumeSSE } from "@/lib/read-sse";
import { WorkShareBar } from "@/components/share/WorkShareBar";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";

interface Comic {
  id: string;
  title: string;
  displayTitle?: string;
  imageUrls: string;
  novel: { id: string; title: string; displayTitle?: string };
  createdAt: string;
  shareCode: string | null;
  isOwner?: boolean;
  status?: string;
  panelsWithImage?: number;
  panelsTotal?: number;
}

export default function ComicDetailPage() {
  const tr = useTranslations("comicRead");
  const locale = useLocale() as AppLocale;
  const { id } = useParams();
  const searchParams = useSearchParams();
  const autoRenderStarted = useRef(false);
  const [comic, setComic] = useState<Comic | null>(null);
  const [pages, setPages] = useState<ComicPage[]>([]);
  const [stylePreset, setStylePreset] = useState<ComicStylePresetId | undefined>();
  const [layoutId, setLayoutId] = useState<ComicLayoutId>("grid_8");
  const [chapterScopeLabel, setChapterScopeLabel] = useState<string | undefined>();
  const [chapterScope, setChapterScope] = useState<ComicChapterScope | null>(null);
  const [readMode, setReadMode] = useState<string | undefined>();
  const applyComicDoc = useCallback((doc: ReturnType<typeof parseComicImageUrls>) => {
    setPages(doc.pages);
    if (doc.stylePreset) setStylePreset(doc.stylePreset);
    if (doc.layoutId) {
      setLayoutId(doc.layoutId);
    } else if (doc.stylePreset === "children_picture_book") {
      setLayoutId("picture_book_5");
    } else if (doc.pages[0]?.panels.length === 5) {
      setLayoutId("picture_book_5");
    } else if ((doc.pages[0]?.panels.length ?? 0) >= 8) {
      setLayoutId("grid_8");
    } else {
      setLayoutId("grid_8");
    }
    if (doc.chapterScopeLabel) setChapterScopeLabel(doc.chapterScopeLabel);
    if (doc.chapterScope) setChapterScope(doc.chapterScope);
    if (doc.readMode) setReadMode(doc.readMode);
  }, []);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(false);
  const [renderMsg, setRenderMsg] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState<{
    total: number;
    current: number;
    withImage: number;
    message: string;
    elapsedMs?: number;
  } | null>(null);

  const loadComic = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/comic/${encodeURIComponent(id as string)}`, {
      headers: mergeLocaleHeaders(locale),
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      throw new Error(tr("loadFailedHttp", { status: String(res.status) }));
    }
    const data = (await res.json()) as {
      comic?: Comic;
      error?: string;
      errorKey?: string;
      errorParams?: Record<string, string | number>;
    };
    if (!res.ok) {
      throw new Error(
        resolveClientApiError(
          locale,
          { ...data, errorParams: data.errorParams ?? { status: String(res.status) } },
          "loadFailedHttp",
        ),
      );
    }
    if (!data.comic) throw new Error(tr("notFound"));
    setComic(data.comic);
    applyComicDoc(parseComicImageUrls(data.comic.imageUrls));
  }, [id, locale, applyComicDoc, tr]);

  const runLoadComic = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await loadComic();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [loadComic]);

  useEffect(() => {
    if (!id) return;
    queueMicrotask(() => {
      void runLoadComic();
    });
  }, [id, runLoadComic]);

  const panelStats = useMemo(() => {
    let total = 0;
    let withImage = 0;
    for (const p of pages) {
      for (const panel of p.panels) {
        total += 1;
        if (panel.imageUrl?.trim()) withImage += 1;
      }
    }
    if (total === 0 && comic?.panelsTotal) {
      const t = comic.panelsTotal;
      const w = comic.panelsWithImage ?? 0;
      return { total: t, withImage: w, missing: Math.max(0, t - w) };
    }
    return { total, withImage, missing: Math.max(0, total - withImage) };
  }, [pages, comic]);

  const missingImages = panelStats.total > 0 && panelStats.missing > 0;

  const handleRenderPanels = useCallback(
    async (opts?: { regenerate?: boolean; page?: number }) => {
      if (!comic) return;
      setRendering(true);
      setRenderMsg(null);
      setError("");
    const regenPage = opts?.page;
    setRenderProgress({
      total: panelStats.total || comic.panelsTotal || 4,
      current: opts?.regenerate ? 0 : panelStats.withImage,
      withImage: opts?.regenerate ? 0 : panelStats.withImage,
      message: opts?.regenerate
        ? regenPage != null
          ? tr("clearingPage", { page: regenPage })
          : tr("clearingAll")
        : tr("connectingImage"),
    });

    try {
      const res = await fetch(`/api/comic/${comic.id}/panels/stream`, {
        method: "POST",
        headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
        body: JSON.stringify(
          opts?.regenerate
            ? { regenerate: true, ...(regenPage != null ? { page: regenPage } : {}) }
            : {},
        ),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          errorKey?: string;
          errorParams?: Record<string, string | number>;
        };
        setError(
          resolveClientApiError(
            locale,
            { ...data, errorParams: data.errorParams ?? { status: String(res.status) } },
            "comicPanelRenderFailed",
          ),
        );
        return;
      }

      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/event-stream") || !res.body) {
        setError(tr("noStream"));
        return;
      }

      await consumeSSE(
        res,
        (ev) => {
        const t = ev.type as string | undefined;
        if (t === "status" && typeof ev.message === "string") {
          if (typeof ev.imageUrls === "string") {
            applyComicDoc(parseComicImageUrls(ev.imageUrls as string));
          }
          setRenderProgress((p) =>
            p
              ? {
                  ...p,
                  message: ev.message as string,
                  ...(opts?.regenerate ? { current: 0, withImage: 0 } : {}),
                }
              : { total: 4, current: 0, withImage: 0, message: ev.message as string },
          );
        }
        if (t === "start") {
          const total = typeof ev.total === "number" ? ev.total : 4;
          setRenderProgress({
            total,
            current: 0,
            withImage: comic.panelsWithImage ?? 0,
            message: typeof ev.message === "string" ? ev.message : tr("panelsPending", { total }),
          });
        }
        if (t === "panel_start") {
          const index = typeof ev.index === "number" ? ev.index : 0;
          const total = typeof ev.total === "number" ? ev.total : 4;
          setRenderProgress({
            total,
            current: index,
            withImage: comic.panelsWithImage ?? 0,
            message: tr("panelProgress", { index, total }),
          });
        }
        if (t === "heartbeat") {
          const elapsedMs = typeof ev.elapsedMs === "number" ? ev.elapsedMs : undefined;
          setRenderProgress((p) =>
            p
              ? {
                  ...p,
                  elapsedMs: elapsedMs ?? p.elapsedMs,
                  message: typeof ev.message === "string" ? (ev.message as string) : p.message,
                }
              : p,
          );
        }
        if (t === "panel_done") {
          const index = typeof ev.index === "number" ? ev.index : 0;
          const total = typeof ev.total === "number" ? ev.total : 4;
          const withImage = typeof ev.withImage === "number" ? ev.withImage : 0;
          const ok = ev.ok === true;
          const elapsedMs = typeof ev.elapsedMs === "number" ? ev.elapsedMs : undefined;
          const durationMs = typeof ev.durationMs === "number" ? ev.durationMs : undefined;
          if (typeof ev.imageUrls === "string") {
            applyComicDoc(parseComicImageUrls(ev.imageUrls as string));
          }
          const elapsedLabel =
            elapsedMs != null ? formatImageGenElapsed(elapsedMs, locale) : undefined;
          const apiLabel =
            durationMs != null ? formatImageGenElapsed(durationMs, locale) : undefined;
          setRenderProgress({
            total,
            current: index,
            withImage,
            elapsedMs,
            message: ok
              ? tr("panelDone", {
                  index,
                  total,
                  elapsed: elapsedLabel ?? "—",
                  api: apiLabel ? tr("panelDoneApi", { api: apiLabel }) : "",
                  withImage,
                })
              : tr("panelFailed", {
                  index,
                  elapsed: elapsedLabel ?? "—",
                  error: typeof ev.error === "string" ? ev.error : tr("unknownError"),
                }),
          });
        }
        if (t === "done") {
          const withImage = typeof ev.withImage === "number" ? ev.withImage : 0;
          const total = typeof ev.total === "number" ? ev.total : 4;
          const doneMsg = typeof ev.message === "string" ? ev.message : tr("renderComplete");
          if (ev.comic && typeof ev.comic === "object" && "imageUrls" in ev.comic) {
            const urls = (ev.comic as { imageUrls?: string }).imageUrls;
            if (urls) applyComicDoc(parseComicImageUrls(urls));
          }
          setRenderProgress({
            total,
            current: total,
            withImage,
            message: doneMsg,
          });
          if (withImage === 0) {
            setError(doneMsg);
            setRenderMsg(null);
          } else {
            setRenderMsg(doneMsg);
            setError("");
          }
        }
        if (t === "error") {
          const errMsg = typeof ev.error === "string" ? ev.error : tr("renderFailedGeneric");
          setError(errMsg);
          setRenderProgress((p) => (p ? { ...p, message: errMsg } : p));
        }
      },
        { locale },
      );

      await runLoadComic();
    } catch {
      setError(tr("renderRequestFailed"));
    } finally {
      setRendering(false);
      setTimeout(() => setRenderProgress(null), 8000);
    }
    },
    [comic, runLoadComic, applyComicDoc, panelStats.total, panelStats.withImage, tr, locale],
  );

  const confirmRegenerate = useCallback(
    (scope: "all" | "page") => {
      if (!comic || rendering) return;
      const pageNum = pages[currentPage]?.page ?? currentPage + 1;
      const msg =
        scope === "all"
          ? tr("confirmRegenAll", { count: panelStats.withImage })
          : tr("confirmRegenPage", { page: pageNum });
      if (!window.confirm(msg)) return;
      void handleRenderPanels(
        scope === "all" ? { regenerate: true } : { regenerate: true, page: pageNum },
      );
    },
    [comic, rendering, pages, currentPage, panelStats.withImage, handleRenderPanels, tr],
  );

  useEffect(() => {
    if (autoRenderStarted.current || !comic?.isOwner || rendering || !missingImages) return;
    if (searchParams.get("renderPanels") !== "1") return;
    autoRenderStarted.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    queueMicrotask(() => {
      void handleRenderPanels();
    });
  }, [comic?.isOwner, missingImages, rendering, searchParams, handleRenderPanels]);

  if (loading) {
    return (
      <AppPageShell className="text-[var(--gc-text)]">
        <SiteHeader />
        <AppMain>
        <main className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
          <p className="text-[var(--gc-muted)]">{tr("loading")}</p>
        </main>
        </AppMain>
      </AppPageShell>
    );
  }

  if (error && !comic) {
    return (
      <AppPageShell className="text-[var(--gc-text)]">
        <SiteHeader />
        <AppMain>
        <main className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
          <p className="text-red-400">{error}</p>
        </main>
        </AppMain>
      </AppPageShell>
    );
  }

  if (!comic) return null;

  const page = pages[currentPage];
  const total = pages.length;
  const heading = comic.displayTitle ?? comic.title;
  const novelLabel = comic.novel.displayTitle ?? comic.novel.title;

  return (
    <AppPageShell className="text-[var(--gc-text)]">
      <SiteHeader />
      <AppMain>
      <main className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
          <ResultMomentBanner
            mode="comic"
            title={heading}
            subtitle={tr("subtitle", {
              novel: novelLabel,
              total,
              scope: chapterScopeLabel ? tr("scopeSuffix", { scope: chapterScopeLabel }) : "",
            })}
            actions={
              <>
                {comic.isOwner && chapterScope ? (
                  <Link
                    href={`/novel/${comic.novel.id}?comicChapter=${chapterScope.toChapter + 1}`}
                    className="gc-theme-cta rounded-lg px-4 py-2 text-xs font-semibold"
                  >
                    {tr("adaptNext")}
                  </Link>
                ) : null}
                <WorkShareBar
                  workType="comic"
                  workId={comic.id}
                  title={comic.title}
                  patchUrl={`/api/comic/${comic.id}`}
                  initialShareCode={comic.shareCode}
                />
              </>
            }
            details={
              <p className="text-xs leading-relaxed text-[var(--gc-muted)]">
                {tr("basedOn")}
                <Link href={`/novel/${comic.novel.id}`} className="mx-1 underline hover:text-[var(--gc-accent)]">
                  《{novelLabel}》
                </Link>
                · {layoutId === "picture_book_5" ? tr("layoutChildren") : tr("layoutGrid")}
                {readMode === "full" ? tr("readModeFull") : ""} · {new Date(comic.createdAt).toLocaleDateString()}
                <br />
                {tr("metaHint")}
              </p>
            }
          />
          </div>

          {(missingImages || rendering || (comic.isOwner && panelStats.withImage > 0)) && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              {error && !rendering ? (
                <p className="mb-3 text-sm text-red-300">{error}</p>
              ) : null}
              {rendering ? (
                <div className="space-y-3">
                  {!renderProgress ? (
                    <p className="text-sm text-amber-100/90">{tr("connectingWait")}</p>
                  ) : (
                    <>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--gc-accent)] border-t-transparent"
                      aria-hidden
                    />
                    <p className="text-sm font-medium text-amber-100">{tr("rendering")}</p>
                  </div>
                  <p className="text-sm text-amber-100/90">
                    {renderProgress.message || tr("renderingDefault")}
                  </p>
                  <div className="h-2 overflow-hidden rounded-full bg-black/30">
                    <div
                      className="h-full rounded-full bg-[var(--gc-accent)] transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          renderProgress.total > 0
                            ? Math.round((renderProgress.current / renderProgress.total) * 100)
                            : 8,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-amber-200/80">
                    {tr("progress", {
                      current: renderProgress.current,
                      total: renderProgress.total,
                      withImage: renderProgress.withImage,
                    })}
                    {renderProgress.elapsedMs != null
                      ? tr("elapsed", { elapsed: formatImageGenElapsed(renderProgress.elapsedMs, locale) })
                      : null}
                    {tr("etaHint")}
                  </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-100">{tr("panelArtTitle")}</p>
                  <p className="text-sm text-amber-100/90">
                    {panelStats.withImage === 0
                      ? tr("panelArtPending", { total: panelStats.total })
                      : panelStats.missing === 0
                        ? tr("panelArtDone", {
                            withImage: panelStats.withImage,
                            total: panelStats.total,
                          })
                        : tr("panelArtPartial", {
                            withImage: panelStats.withImage,
                            total: panelStats.total,
                          })}
                  </p>
                </div>
              )}
              {comic.isOwner && !rendering ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {panelStats.missing > 0 ? (
                    <button
                      type="button"
                      onClick={() => void handleRenderPanels()}
                      className="rounded-lg bg-[var(--gc-accent)] px-4 py-2 text-sm font-medium text-white"
                    >
                      {panelStats.withImage > 0 ? tr("continueRender") : tr("startRender")}
                    </button>
                  ) : null}
                  {panelStats.withImage > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => confirmRegenerate("all")}
                        className="rounded-lg border border-amber-400/50 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-950/70"
                      >
                        {tr("regenAll")}
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmRegenerate("page")}
                        className="rounded-lg border border-[color:var(--gc-border)] px-4 py-2 text-sm font-medium text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
                      >
                        {tr("regenPage")}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : !comic.isOwner ? (
                <p className="mt-2 text-xs text-amber-200/70">
                  {tr.rich("loginToRender", {
                    login: (chunks) => (
                      <Link href="/login" className="underline">
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
              ) : null}
            </div>
          )}

          {renderMsg && !error ? (
            <p className="mb-4 text-sm text-[color:var(--gc-accent)]">{renderMsg}</p>
          ) : null}
          {error && rendering ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

          {total === 0 ? (
            <p className="text-[var(--gc-muted)]">{tr("noPanels")}</p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 0}
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-sm disabled:opacity-40"
                >
                  {tr("prevPage")}
                </button>
                <span className="text-sm text-[var(--gc-muted)]">
                  {tr("pageOf", { current: currentPage + 1, total })}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= total - 1}
                  onClick={() => setCurrentPage((p) => Math.min(total - 1, p + 1))}
                  className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-sm disabled:opacity-40"
                >
                  {tr("nextPage")}
                </button>
              </div>

              {page &&
                (layoutId === "picture_book_5" ? (
                  <ComicPictureBookPageGrid
                    page={page}
                    rendering={rendering}
                    stylePreset={stylePreset}
                  />
                ) : (
                  <ComicEightGridPageGrid page={page} rendering={rendering} stylePreset={stylePreset} />
                ))}

              {total > 1 && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {pages.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentPage(i)}
                      className={`h-9 w-9 rounded-lg text-sm font-medium transition ${
                        i === currentPage
                          ? "bg-[var(--gc-accent)] text-white"
                          : "border border-[color:var(--gc-border)] text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      </AppMain>
    </AppPageShell>
  );
}
