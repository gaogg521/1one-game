"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { GameSpec } from "@/lib/game-spec";
import { GamePlayer } from "@/components/GamePlayer";

type FeedItem = {
  id: string;
  title: string;
  prompt: string;
  spec: GameSpec;
  coverPath: string | null;
  playCount: number;
  likeCount: number;
};

type FeedState = {
  items: FeedItem[];
  nextCursor: string | null;
  loading: boolean;
  error: string | null;
};

export function ArcadeFeedClient() {
  const [feed, setFeed] = useState<FeedState>({
    items: [],
    nextCursor: null,
    loading: true,
    error: null,
  });
  const [activeIdx, setActiveIdx] = useState(0);
  const [endedSet, setEndedSet] = useState<Set<number>>(new Set());
  const [likedSet, setLikedSet] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const advanceTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const loadFeed = useCallback(async (cursor?: string) => {
    try {
      const qs = `limit=10${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const res = await fetch(`/api/arcade/feed?${qs}`);
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as { items: FeedItem[]; nextCursor: string | null };
      setFeed((prev) => ({
        items: cursor ? [...prev.items, ...data.items] : data.items,
        nextCursor: data.nextCursor,
        loading: false,
        error: null,
      }));
    } catch {
      setFeed((prev) => ({ ...prev, loading: false, error: "加载失败，请重试" }));
    }
  }, []);

  useEffect(() => {
    void loadFeed();
    // Try to lock orientation to landscape on Android for best experience
    if (typeof screen !== "undefined" && "orientation" in screen) {
      (screen.orientation as { lock?: (o: string) => Promise<void> }).lock?.("landscape").catch(() => {});
    }
    return () => {
      if (typeof screen !== "undefined" && "orientation" in screen) {
        (screen.orientation as { unlock?: () => void }).unlock?.();
      }
    };
  }, [loadFeed]);

  // IntersectionObserver: track which card is centered
  useEffect(() => {
    if (feed.items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null;
        entries.forEach((entry) => {
          const idx = cardRefs.current.findIndex((r) => r === entry.target);
          if (idx !== -1 && entry.intersectionRatio > (best?.ratio ?? 0)) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        });
        if (best) setActiveIdx((best as { idx: number; ratio: number }).idx);
      },
      { threshold: [0.3, 0.6, 0.9] },
    );
    cardRefs.current.forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, [feed.items.length]);

  // Load more when near the end
  useEffect(() => {
    if (activeIdx >= feed.items.length - 3 && feed.nextCursor && !feed.loading) {
      void loadFeed(feed.nextCursor);
    }
  }, [activeIdx, feed.items.length, feed.nextCursor, feed.loading, loadFeed]);

  function scrollToCard(idx: number) {
    cardRefs.current[idx]?.scrollIntoView({ behavior: "smooth" });
  }

  function handleGameEnd(idx: number) {
    setEndedSet((prev) => new Set([...prev, idx]));
    // Auto-advance after 3s
    const timer = setTimeout(() => {
      if (idx + 1 < (cardRefs.current.length)) {
        scrollToCard(idx + 1);
      }
      advanceTimers.current.delete(idx);
    }, 3000);
    advanceTimers.current.set(idx, timer);
  }

  function cancelAdvance(idx: number) {
    const t = advanceTimers.current.get(idx);
    if (t) {
      clearTimeout(t);
      advanceTimers.current.delete(idx);
    }
  }

  function handleLike(idx: number, itemId: string) {
    if (likedSet.has(idx)) return;
    setLikedSet((prev) => new Set([...prev, idx]));
    void fetch(`/api/projects/${itemId}/like`, { method: "POST" });
  }

  async function enterFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    try {
      await el.requestFullscreen();
      (screen.orientation as { lock?: (o: string) => Promise<void> }).lock?.("landscape").catch(() => {});
    } catch {}
  }

  // Keyboard support: arrow keys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown" || e.key === "j") scrollToCard(activeIdx + 1);
      if (e.key === "ArrowUp" || e.key === "k") scrollToCard(activeIdx - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdx]);

  if (feed.loading) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <span className="text-3xl animate-bounce">🎮</span>
          <span className="text-sm">加载游戏中…</span>
        </div>
      </div>
    );
  }

  if (feed.error || feed.items.length === 0) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4 text-center text-white/60">
          <span className="text-4xl">😵</span>
          <p className="text-sm">{feed.error ?? "暂无游戏"}</p>
          <button
            onClick={() => void loadFeed()}
            className="rounded-full bg-white/10 px-5 py-2 text-sm text-white hover:bg-white/20"
          >
            重试
          </button>
          <Link href="/samples" className="text-xs text-white/40 underline">
            前往样品馆
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 overflow-y-scroll snap-y snap-mandatory bg-black"
      style={{ scrollbarWidth: "none" }}
    >
      {/* Back button */}
      <Link
        href="/"
        className="fixed top-3 left-3 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
        aria-label="返回"
      >
        ←
      </Link>

      {/* Fullscreen button */}
      <button
        onClick={() => void enterFullscreen()}
        className="fixed top-3 right-3 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
        aria-label="全屏"
        title="全屏（横屏体验更佳）"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      </button>

      {feed.items.map((item, idx) => {
        const isActive = idx === activeIdx;
        // Mount current card plus one ahead/behind for smooth transitions
        const shouldMount = Math.abs(idx - activeIdx) <= 1;
        const ended = endedSet.has(idx);
        const liked = likedSet.has(idx);

        return (
          <div
            key={item.id}
            ref={(el) => { cardRefs.current[idx] = el; }}
            className="relative flex h-screen snap-start flex-col overflow-hidden"
          >
            {/* Game viewport — fills available space above info bar */}
            <div className="relative min-h-0 flex-1">
              {shouldMount ? (
                <GamePlayer
                  key={`${item.id}-${idx}`}
                  spec={item.spec}
                  projectId={item.id}
                  promptHint={item.prompt}
                  arcadeMode
                  immersive
                  onEnd={() => handleGameEnd(idx)}
                />
              ) : (
                /* Placeholder cover while out of view */
                <div className="flex h-full items-center justify-center bg-black">
                  {item.coverPath ? (
                    <img
                      src={item.coverPath}
                      alt={item.title}
                      className="h-full w-full object-cover opacity-60"
                    />
                  ) : (
                    <span className="text-6xl opacity-30">🎮</span>
                  )}
                </div>
              )}

              {/* Game-end result overlay */}
              {ended && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3 text-center text-white">
                    <span className="text-5xl">🏆</span>
                    <p className="text-lg font-bold">游戏结束</p>
                    <p className="text-xs text-white/60">3 秒后自动切换…</p>
                    <div className="mt-1 flex gap-3">
                      <button
                        onClick={() => {
                          cancelAdvance(idx);
                          setEndedSet((prev) => { const s = new Set(prev); s.delete(idx); return s; });
                        }}
                        className="rounded-full border border-white/30 px-4 py-1.5 text-sm hover:bg-white/10"
                      >
                        再玩一次
                      </button>
                      <button
                        onClick={() => { cancelAdvance(idx); scrollToCard(idx + 1); }}
                        className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium hover:bg-white/30"
                      >
                        下一个 ↓
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Portrait hint — only show when active and not fullscreen */}
              {isActive && (
                <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 landscape:hidden">
                  <span className="rounded-full bg-black/50 px-3 py-1 text-[11px] text-white/50 backdrop-blur-sm">
                    横屏或点击全屏以获得最佳体验
                  </span>
                </div>
              )}
            </div>

            {/* Bottom info bar */}
            <div className="shrink-0 border-t border-white/10 bg-black px-4 pb-safe-or-4 pt-3">
              <div className="flex items-start gap-3">
                {/* Title + prompt */}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-white">{item.title}</h2>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-white/50">
                    {item.prompt}
                  </p>
                </div>

                {/* Right-side action buttons */}
                <div className="flex shrink-0 items-center gap-3">
                  {/* Like */}
                  <button
                    onClick={() => handleLike(idx, item.id)}
                    className="flex flex-col items-center gap-0.5"
                    aria-label="点赞"
                  >
                    <span className={`text-xl transition-transform active:scale-125 ${liked ? "text-red-400" : "text-white/70"}`}>
                      {liked ? "♥" : "♡"}
                    </span>
                    <span className="text-[10px] text-white/40">
                      {(item.likeCount + (liked ? 1 : 0)).toLocaleString()}
                    </span>
                  </button>

                  {/* Open full play page */}
                  <Link
                    href={`/play/${item.id}`}
                    className="flex flex-col items-center gap-0.5"
                    aria-label="完整页面"
                  >
                    <span className="text-xl text-white/70">⤢</span>
                    <span className="text-[10px] text-white/40">详情</span>
                  </Link>

                  {/* Next */}
                  <button
                    onClick={() => scrollToCard(idx + 1)}
                    className="flex flex-col items-center gap-0.5"
                    aria-label="下一个"
                  >
                    <span className="text-xl text-white/70">↓</span>
                    <span className="text-[10px] text-white/40">下一个</span>
                  </button>
                </div>
              </div>

              {/* Progress dots */}
              {feed.items.length > 1 && (
                <div className="mt-2 flex justify-center gap-1">
                  {feed.items.slice(Math.max(0, idx - 2), idx + 3).map((_, dotOffset) => {
                    const dotIdx = Math.max(0, idx - 2) + dotOffset;
                    return (
                      <button
                        key={dotIdx}
                        onClick={() => scrollToCard(dotIdx)}
                        className={`h-1 rounded-full transition-all ${
                          dotIdx === activeIdx ? "w-4 bg-white" : "w-1 bg-white/30"
                        }`}
                        aria-label={`第 ${dotIdx + 1} 个游戏`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Loading more indicator */}
      {feed.loading && feed.items.length > 0 && (
        <div className="flex h-dvh snap-start items-center justify-center bg-black">
          <span className="text-sm text-white/40">加载更多…</span>
        </div>
      )}
    </div>
  );
}
