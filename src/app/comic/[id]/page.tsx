"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ComicPictureBookPageGrid } from "@/components/comic/ComicPictureBookPageGrid";
import { ComicPanelOverlay } from "@/components/comic/ComicPanelOverlay";
import { parseComicImageUrls, type ComicPage } from "@/lib/comic-format";
import { type ComicLayoutId } from "@/lib/comic-layout";
import type { ComicStylePresetId } from "@/lib/comic-style-presets";
import { formatImageGenElapsed } from "@/lib/format-duration";
import { consumeSSE } from "@/lib/read-sse";

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

function ShareButton({ comicId }: { comicId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      const res = await fetch(`/api/comic/${comicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensureShareCode: true }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { comic?: { shareCode?: string | null } };
      const code = data.comic?.shareCode;
      if (!code) return;
      const url = `${window.location.origin}/s/${code}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-xs font-medium text-[var(--gc-muted)] transition hover:border-[color:var(--gc-accent)]/40 hover:text-[var(--gc-text)]"
    >
      {copied ? "已复制" : "分享"}
    </button>
  );
}

function ComicPageGrid({
  page,
  rendering,
  stylePreset,
}: {
  page: ComicPage;
  rendering?: boolean;
  stylePreset?: ComicStylePresetId;
}) {
  const panels = page.panels.slice(0, 4);
  while (panels.length < 4) {
    panels.push({ caption: "", prompt: "" });
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {panels.map((panel, idx) => {
        const hasImage = Boolean(panel.imageUrl?.trim());
        return (
          <div
            key={idx}
            className="relative aspect-square overflow-hidden rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)]"
          >
            {hasImage ? (
              <img
                src={panel.imageUrl}
                alt={panel.caption || `第${page.page}页-${idx + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
                <span className="text-[10px] uppercase tracking-wider text-[var(--gc-muted)]">
                  {rendering ? "生成中…" : "待配图"}
                </span>
                {panel.caption ? (
                  <p className="line-clamp-3 text-xs leading-relaxed text-[var(--gc-text-soft)]">
                    {panel.caption}
                  </p>
                ) : null}
              </div>
            )}
            <ComicPanelOverlay panel={panel} stylePreset={stylePreset} hasImage={hasImage} />
          </div>
        );
      })}
    </div>
  );
}

export default function ComicDetailPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const autoRenderStarted = useRef(false);
  const [comic, setComic] = useState<Comic | null>(null);
  const [pages, setPages] = useState<ComicPage[]>([]);
  const [stylePreset, setStylePreset] = useState<ComicStylePresetId | undefined>();
  const [layoutId, setLayoutId] = useState<ComicLayoutId>("grid_4");
  const [chapterScopeLabel, setChapterScopeLabel] = useState<string | undefined>();
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
    } else {
      setLayoutId("grid_4");
    }
    if (doc.chapterScopeLabel) setChapterScopeLabel(doc.chapterScopeLabel);
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
    const res = await fetch(`/api/comic/${encodeURIComponent(id as string)}`);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      throw new Error(`加载失败（HTTP ${res.status}）`);
    }
    const data = (await res.json()) as { comic?: Comic; error?: string };
    if (!res.ok) throw new Error(data.error || `加载失败（HTTP ${res.status}）`);
    if (!data.comic) throw new Error("漫画不存在");
    setComic(data.comic);
    applyComicDoc(parseComicImageUrls(data.comic.imageUrls));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    loadComic()
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [id, loadComic]);

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
          ? `正在清空第 ${regenPage} 页配图并重新生成…`
          : "正在清空已有配图并重新生成…"
        : "正在连接文生图服务…",
    });

    try {
      const res = await fetch(`/api/comic/${comic.id}/panels/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          opts?.regenerate
            ? { regenerate: true, ...(regenPage != null ? { page: regenPage } : {}) }
            : {},
        ),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || `配图生成失败（${res.status}）`);
        return;
      }

      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/event-stream") || !res.body) {
        setError("服务器未返回流式进度，请稍后重试");
        return;
      }

      await consumeSSE(res, (ev) => {
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
            message: typeof ev.message === "string" ? ev.message : `共 ${total} 格待生成`,
          });
        }
        if (t === "panel_start") {
          const index = typeof ev.index === "number" ? ev.index : 0;
          const total = typeof ev.total === "number" ? ev.total : 4;
          setRenderProgress({
            total,
            current: index,
            withImage: comic.panelsWithImage ?? 0,
            message: `正在生成第 ${index}/${total} 格配图…`,
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
            elapsedMs != null ? formatImageGenElapsed(elapsedMs) : undefined;
          const apiLabel =
            durationMs != null ? formatImageGenElapsed(durationMs) : undefined;
          setRenderProgress({
            total,
            current: index,
            withImage,
            elapsedMs,
            message: ok
              ? `第 ${index}/${total} 格已完成（${elapsedLabel ?? "—"}${apiLabel ? `，网关 ${apiLabel}` : ""}）· 已有 ${withImage} 张图`
              : `第 ${index} 格失败（${elapsedLabel ?? "—"}）：${typeof ev.error === "string" ? ev.error : "未知错误"}`,
          });
        }
        if (t === "done") {
          const withImage = typeof ev.withImage === "number" ? ev.withImage : 0;
          const total = typeof ev.total === "number" ? ev.total : 4;
          const doneMsg = typeof ev.message === "string" ? ev.message : "配图完成";
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
          const errMsg = typeof ev.error === "string" ? ev.error : "配图生成失败";
          setError(errMsg);
          setRenderProgress((p) => (p ? { ...p, message: errMsg } : p));
        }
      });

      await loadComic();
    } catch {
      setError("配图请求失败，请稍后重试");
    } finally {
      setRendering(false);
      setTimeout(() => setRenderProgress(null), 8000);
    }
    },
    [comic, loadComic, panelStats.total, panelStats.withImage],
  );

  const confirmRegenerate = useCallback(
    (scope: "all" | "page") => {
      if (!comic || rendering) return;
      const pageNum = pages[currentPage]?.page ?? currentPage + 1;
      const msg =
        scope === "all"
          ? `将清空全部 ${panelStats.withImage} 格已有配图，按小说都市题材重生成封面与配图（不使用旧玄幻图作参考）。\n\n过程较长，请勿关闭页面。确定继续？`
          : `将清空第 ${pageNum} 页的配图并重新生成（共 4 格）。\n\n确定继续？`;
      if (!window.confirm(msg)) return;
      void handleRenderPanels(
        scope === "all" ? { regenerate: true } : { regenerate: true, page: pageNum },
      );
    },
    [comic, rendering, pages, currentPage, panelStats.withImage, handleRenderPanels],
  );

  useEffect(() => {
    if (autoRenderStarted.current || !comic?.isOwner || rendering || !missingImages) return;
    if (searchParams.get("renderPanels") !== "1") return;
    autoRenderStarted.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    void handleRenderPanels();
  }, [comic?.isOwner, missingImages, rendering, searchParams, handleRenderPanels]);

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <SiteHeader />
        <main className="flex-1 px-6 py-10 lg:px-10">
          <p className="text-[var(--gc-muted)]">加载中…</p>
        </main>
      </div>
    );
  }

  if (error && !comic) {
    return (
      <div className="flex min-h-screen">
        <SiteHeader />
        <main className="flex-1 px-6 py-10 lg:px-10">
          <p className="text-red-400">{error}</p>
        </main>
      </div>
    );
  }

  if (!comic) return null;

  const page = pages[currentPage];
  const total = pages.length;
  const heading = comic.displayTitle ?? comic.title;
  const novelLabel = comic.novel.displayTitle ?? comic.novel.title;

  return (
    <div className="flex min-h-screen">
      <SiteHeader />
      <main className="flex-1 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--gc-text)]">{heading}</h1>
              <p className="mt-1 text-xs text-[var(--gc-muted)]">
                基于《
                <Link href={`/novel/${comic.novel.id}`} className="underline hover:text-[var(--gc-accent)]">
                  {novelLabel}
                </Link>
                》· {total} 页（每页 4 格）
                {chapterScopeLabel ? ` · ${chapterScopeLabel}` : ""}
                {readMode === "full" ? " · 全书精读" : ""}
                · {new Date(comic.createdAt).toLocaleDateString()}
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-[var(--gc-text-faint)]">
                对白为气泡、旁白为页脚解说（不画进图内）；缺图格会先展示分镜文字。重新生成可选用创作页画风预设。
              </p>
            </div>
            <ShareButton comicId={comic.id} />
          </div>

          {(missingImages || rendering || (comic.isOwner && panelStats.withImage > 0)) && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              {error && !rendering ? (
                <p className="mb-3 text-sm text-red-300">{error}</p>
              ) : null}
              {rendering ? (
                <div className="space-y-3">
                  {!renderProgress ? (
                    <p className="text-sm text-amber-100/90">正在连接文生图服务，请稍候…</p>
                  ) : (
                    <>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--gc-accent)] border-t-transparent"
                      aria-hidden
                    />
                    <p className="text-sm font-medium text-amber-100">正在生成中</p>
                  </div>
                  <p className="text-sm text-amber-100/90">
                    {renderProgress.message || "四宫格分镜配图生成中，与列表封面无关，请勿关闭页面。"}
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
                    进度 {renderProgress.current}/{renderProgress.total} 格 · 已完成配图{" "}
                    {renderProgress.withImage} 张
                    {renderProgress.elapsedMs != null
                      ? ` · 当前格已用时 ${formatImageGenElapsed(renderProgress.elapsedMs)}`
                      : null}{" "}
                    · 单格通常约 2～8 分钟（视网关负载），请勿关闭页面
                  </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-100">四宫格分镜配图（不是封面）</p>
                  <p className="text-sm text-amber-100/90">
                    {panelStats.withImage === 0
                      ? `分镜脚本已就绪，共 ${panelStats.total} 格尚未出图。中文对白在格子下方/叠字显示，配图应为无字纯画面；小说页「生成漫画」超过 1 页时只生成分镜，需在本页配图。`
                      : panelStats.missing === 0
                        ? `配图已全部完成（${panelStats.withImage}/${panelStats.total} 格）。若不满意可重新生成；续画会跳过已有图。`
                        : `配图未完成：已完成 ${panelStats.withImage}/${panelStats.total} 格。续画逐格串行，以首张分镜+封面为风格锚点（需 GEMINI_API_KEY），跳过已有图。`}
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
                      {panelStats.withImage > 0 ? "继续生成配图" : "开始生成配图"}
                    </button>
                  ) : null}
                  {panelStats.withImage > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => confirmRegenerate("all")}
                        className="rounded-lg border border-amber-400/50 bg-amber-950/40 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-950/70"
                      >
                        重新生成全部
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmRegenerate("page")}
                        className="rounded-lg border border-[color:var(--gc-border)] px-4 py-2 text-sm font-medium text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
                      >
                        重新生成本页
                      </button>
                    </>
                  ) : null}
                </div>
              ) : !comic.isOwner ? (
                <p className="mt-2 text-xs text-amber-200/70">请使用创作时的浏览器登录态后重试。</p>
              ) : null}
            </div>
          )}

          {renderMsg && !error ? (
            <p className="mb-4 text-sm text-[color:var(--gc-accent)]">{renderMsg}</p>
          ) : null}
          {error && rendering ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

          {total === 0 ? (
            <p className="text-[var(--gc-muted)]">暂无分镜数据</p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 0}
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-sm disabled:opacity-40"
                >
                  上一页
                </button>
                <span className="text-sm text-[var(--gc-muted)]">
                  第 {currentPage + 1} / {total} 页
                </span>
                <button
                  type="button"
                  disabled={currentPage >= total - 1}
                  onClick={() => setCurrentPage((p) => Math.min(total - 1, p + 1))}
                  className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-sm disabled:opacity-40"
                >
                  下一页
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
                  <ComicPageGrid page={page} rendering={rendering} stylePreset={stylePreset} />
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
    </div>
  );
}
