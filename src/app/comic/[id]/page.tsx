"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { parseComicImageUrls, type ComicPage } from "@/lib/comic-format";
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

function ComicPageGrid({ page }: { page: ComicPage }) {
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
                <span className="text-[10px] uppercase tracking-wider text-[var(--gc-muted)]">待生成</span>
                {panel.caption ? (
                  <p className="line-clamp-3 text-xs leading-relaxed text-[var(--gc-text-soft)]">
                    {panel.caption}
                  </p>
                ) : null}
              </div>
            )}
            {hasImage && panel.caption ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pb-2 pt-6">
                <p className="text-xs font-medium leading-snug text-white">{panel.caption}</p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function ComicDetailPage() {
  const { id } = useParams();
  const [comic, setComic] = useState<Comic | null>(null);
  const [pages, setPages] = useState<ComicPage[]>([]);
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
    setPages(parseComicImageUrls(data.comic.imageUrls).pages);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    loadComic()
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [id, loadComic]);

  const missingImages = useMemo(() => {
    if (comic?.panelsTotal != null && comic.panelsWithImage != null) {
      return comic.panelsWithImage < comic.panelsTotal;
    }
    let total = 0;
    let withImg = 0;
    for (const p of pages) {
      for (const panel of p.panels) {
        total += 1;
        if (panel.imageUrl?.trim()) withImg += 1;
      }
    }
    return total > 0 && withImg < total;
  }, [comic, pages]);

  async function handleRenderPanels() {
    if (!comic || rendering) return;
    setRendering(true);
    setRenderMsg(null);
    setError("");
    setRenderProgress({
      total: comic.panelsTotal ?? 4,
      current: 0,
      withImage: comic.panelsWithImage ?? 0,
      message: "正在连接文生图服务…",
    });

    try {
      const res = await fetch(`/api/comic/${comic.id}/panels/stream`, { method: "POST" });
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
          setRenderProgress((p) =>
            p ? { ...p, message: ev.message as string } : { total: 4, current: 0, withImage: 0, message: ev.message as string },
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
            setPages(parseComicImageUrls(ev.imageUrls as string).pages);
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
          if (ev.comic && typeof ev.comic === "object" && "imageUrls" in ev.comic) {
            const urls = (ev.comic as { imageUrls?: string }).imageUrls;
            if (urls) setPages(parseComicImageUrls(urls).pages);
          }
          setRenderProgress({
            total,
            current: total,
            withImage,
            message: typeof ev.message === "string" ? (ev.message as string) : "配图完成",
          });
          setRenderMsg(typeof ev.message === "string" ? (ev.message as string) : "配图已更新");
        }
        if (t === "error") {
          setError(typeof ev.error === "string" ? (ev.error as string) : "配图生成失败");
        }
      });

      await loadComic();
    } catch {
      setError("配图请求失败，请稍后重试");
    } finally {
      setRendering(false);
      setTimeout(() => setRenderProgress(null), 4000);
    }
  }

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
                》· {total} 页（每页 4 格）· {new Date(comic.createdAt).toLocaleDateString()}
              </p>
            </div>
            <ShareButton comicId={comic.id} />
          </div>

          {(missingImages || rendering) && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              {rendering && renderProgress ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--gc-accent)] border-t-transparent"
                      aria-hidden
                    />
                    <p className="text-sm font-medium text-amber-100">配图生成进行中</p>
                  </div>
                  <p className="text-sm text-amber-100/90">{renderProgress.message}</p>
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
                </div>
              ) : (
                <p className="text-sm text-amber-100/90">
                  分镜脚本已生成，但配图尚未就绪。点击后逐格调用文生图，界面会显示实时进度与每格耗时。
                </p>
              )}
              {comic.isOwner && !rendering ? (
                <button
                  type="button"
                  onClick={() => void handleRenderPanels()}
                  className="mt-3 rounded-lg bg-[var(--gc-accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  生成配图
                </button>
              ) : !comic.isOwner ? (
                <p className="mt-2 text-xs text-amber-200/70">请使用创作时的浏览器登录态后重试。</p>
              ) : null}
            </div>
          )}

          {renderMsg ? <p className="mb-4 text-sm text-[color:var(--gc-accent)]">{renderMsg}</p> : null}
          {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

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

              {page && <ComicPageGrid page={page} />}

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
