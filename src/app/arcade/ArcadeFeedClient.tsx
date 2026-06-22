"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { GameSpec } from "@/lib/game-spec";
import { GamePlayer } from "@/components/GamePlayer";
import { MobileFeedTabs } from "@/components/mobile/MobileBrowseDock";
import { FeedScrollRail } from "@/components/mobile/FeedScrollRail";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

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

const SWIPE_HINT_KEY = "operone-arcade-swipe-hint-v1";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function ArcadeFeedClient() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("mobileArcade");
  const [feed, setFeed] = useState<FeedState>({
    items: [],
    nextCursor: null,
    loading: true,
    error: null,
  });
  const [activeIdx, setActiveIdx] = useState(0);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [endToastIdx, setEndToastIdx] = useState<number | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const advanceTimers = useRef<Map<number, number>>(new Map());

  const loadFeed = useCallback(async (cursor?: string) => {
    setFeed((prev) => ({ ...prev, loading: true }));
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
      setFeed((prev) => ({ ...prev, loading: false, error: t("loadFailed") }));
    }
  }, [t]);

  useEffect(() => {
    void loadFeed();
    try {
      if (!localStorage.getItem(SWIPE_HINT_KEY)) setShowSwipeHint(true);
    } catch {
      setShowSwipeHint(true);
    }
  }, [loadFeed]);

  useEffect(() => {
    if (!showSwipeHint) return;
    const t = window.setTimeout(() => {
      setShowSwipeHint(false);
      try {
        localStorage.setItem(SWIPE_HINT_KEY, "1");
      } catch {
        /* ignore */
      }
    }, 3200);
    return () => window.clearTimeout(t);
  }, [showSwipeHint]);

  // IntersectionObserver: track centered card
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
      { root: containerRef.current, threshold: [0.55, 0.75, 0.9] },
    );
    cardRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, [feed.items.length]);

  useEffect(() => {
    if (activeIdx >= feed.items.length - 3 && feed.nextCursor && !feed.loading) {
      void loadFeed(feed.nextCursor);
    }
  }, [activeIdx, feed.items.length, feed.nextCursor, feed.loading, loadFeed]);

  const scrollToCard = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, cardRefs.current.length - 1));
    cardRefs.current[clamped]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const cancelAdvance = useCallback((idx: number) => {
    const t = advanceTimers.current.get(idx);
    if (t) {
      clearTimeout(t);
      advanceTimers.current.delete(idx);
    }
  }, []);

  const handleGameEnd = useCallback(
    (idx: number) => {
      setEndToastIdx(idx);
      cancelAdvance(idx);
      const timer = window.setTimeout(() => {
        setEndToastIdx(null);
        if (idx + 1 < cardRefs.current.length) scrollToCard(idx + 1);
        advanceTimers.current.delete(idx);
      }, 1400);
      advanceTimers.current.set(idx, timer);
    },
    [cancelAdvance, scrollToCard],
  );

  useEffect(
    () => () => {
      advanceTimers.current.forEach((t) => clearTimeout(t));
      advanceTimers.current.clear();
    },
    [],
  );

  const handleLike = useCallback((itemId: string) => {
    setLikedSet((prev) => {
      if (prev.has(itemId)) return prev;
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
    void fetch(`/api/projects/${itemId}/like`, { method: "POST" });
  }, []);

  const handleShare = useCallback(async (itemId: string, title: string) => {
    const url = `${window.location.origin}/play/${itemId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      /* user cancelled */
    }
  }, []);

  if (feed.loading && feed.items.length === 0) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </div>
    );
  }

  if (feed.error || feed.items.length === 0) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black px-6">
        <div className="flex max-w-xs flex-col items-center gap-4 text-center text-white/70">
          <p className="text-sm">{feed.error ?? t("emptyGames")}</p>
          <button
            type="button"
            onClick={() => void loadFeed()}
            className="rounded-full bg-white/15 px-5 py-2 text-sm text-white"
          >
            {t("retry")}
          </button>
          <Link href={withLocalePath("/samples", locale)} className="text-xs text-white/45 underline">
            {t("goSamples")}
          </Link>
        </div>
      </div>
    );
  }

  const activeItem = feed.items[activeIdx];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 overflow-y-scroll overscroll-y-contain bg-black snap-y snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ touchAction: "pan-y" }}
    >
      {feed.items.map((item, idx) => {
        const isActive = idx === activeIdx;
        const shouldMount = Math.abs(idx - activeIdx) <= 1;
        const liked = likedSet.has(item.id);
        const showEndToast = endToastIdx === idx;

        return (
          <div
            key={item.id}
            ref={(el) => {
              cardRefs.current[idx] = el;
            }}
            className="relative h-[100dvh] w-full shrink-0 snap-start snap-always"
          >
            {/* 全屏游戏 */}
            <div className="absolute inset-0 bg-black">
              {shouldMount ? (
                <GamePlayer
                  key={`${item.id}-${isActive ? "on" : "off"}`}
                  spec={item.spec}
                  projectId={item.id}
                  promptHint={item.prompt}
                  arcadeMode
                  immersive
                  onEnd={() => handleGameEnd(idx)}
                />
              ) : item.coverPath ? (
                <img src={item.coverPath} alt="" className="h-full w-full object-cover opacity-35" />
              ) : (
                <div className="flex h-full items-center justify-center text-5xl opacity-20">🎮</div>
              )}
            </div>

            {/* 渐变遮罩 — 保证文字可读 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />

            {/* 顶栏：返回 + 计数 */}
            {isActive ? (
              <>
                <FeedScrollRail
                  onSwipeNext={() => scrollToCard(idx + 1)}
                  onSwipePrev={() => scrollToCard(idx - 1)}
                />

                <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between px-3 pt-[max(0.65rem,env(safe-area-inset-top))]">
                  <Link
                    href={withLocalePath("/", locale)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-lg text-white backdrop-blur-md"
                    aria-label={t("back")}
                  >
                    ←
                  </Link>
                  <div className="flex flex-col items-center gap-0.5">
                    <MobileFeedTabs active="arcade" />
                    <span className="text-[10px] tabular-nums text-white/45">
                      {idx + 1}/{feed.items.length}
                      {feed.nextCursor ? "+" : ""}
                    </span>
                  </div>
                  <Link
                    href={withLocalePath("/create", locale)}
                    className="rounded-full bg-black/35 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-md"
                  >
                    {t("create")}
                  </Link>
                </div>
              </>
            ) : null}

            {/* 右侧操作栏 — 抖音式 */}
            {isActive ? (
              <div className="absolute bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] right-3 z-30 flex flex-col items-center gap-5">
                <button
                  type="button"
                  onClick={() => handleLike(item.id)}
                  className="flex flex-col items-center gap-1"
                  aria-label={t("like")}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-xl backdrop-blur-md transition-transform active:scale-90 ${
                      liked ? "text-red-400" : "text-white"
                    }`}
                  >
                    {liked ? "♥" : "♡"}
                  </span>
                  <span className="text-[10px] font-medium tabular-nums text-white/75">
                    {formatCount(item.likeCount + (liked ? 1 : 0))}
                  </span>
                </button>

                <Link
                  href={withLocalePath(`/play/${item.id}`, locale)}
                  className="flex flex-col items-center gap-1"
                  aria-label={t("detail")}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-lg text-white backdrop-blur-md">
                    ⤢
                  </span>
                  <span className="text-[10px] text-white/55">{t("detail")}</span>
                </Link>

                <button
                  type="button"
                  onClick={() => void handleShare(item.id, item.title)}
                  className="flex flex-col items-center gap-1"
                  aria-label={t("share")}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-lg text-white backdrop-blur-md">
                    ↗
                  </span>
                  <span className="text-[10px] text-white/55">{t("share")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => scrollToCard(idx + 1)}
                  className="flex flex-col items-center gap-1"
                  aria-label={t("next")}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-lg text-white backdrop-blur-md animate-bounce">
                    ↓
                  </span>
                  <span className="text-[10px] text-white/55">{t("next")}</span>
                </button>
              </div>
            ) : null}

            {/* 左下标题 — 单行，不堆 prompt */}
            {isActive ? (
              <div className="absolute bottom-0 left-0 right-16 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-white drop-shadow-sm">
                  {item.title}
                </h2>
                <p className="mt-1 text-[11px] tabular-nums text-white/50">
                  {t("playCount", { count: formatCount(item.playCount) })}
                </p>
              </div>
            ) : null}

            {/* 结算轻提示 */}
            {showEndToast ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+3.5rem))] z-40 flex justify-center">
                <span className="rounded-full bg-black/55 px-4 py-2 text-xs text-white/85 backdrop-blur-md">
                  {t("swipeContinue")}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}

      {/* 首次进入：上滑引导 */}
      {showSwipeHint && activeItem ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))] z-50 flex justify-center">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/60 px-5 py-3 backdrop-blur-md">
            <span className="text-2xl animate-bounce">↑</span>
            <span className="text-xs text-white/80">{t("swipeHint")}</span>
          </div>
        </div>
      ) : null}

      {feed.loading && feed.items.length > 0 ? (
        <div className="flex h-[100dvh] shrink-0 snap-start items-center justify-center bg-black">
          <span className="text-xs text-white/40">{t("loadMore")}</span>
        </div>
      ) : null}
    </div>
  );
}
