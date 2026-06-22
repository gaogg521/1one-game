"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { useAutoWorkCover, WorkCoverPlaceholder } from "@/hooks/use-auto-work-cover";
import { displayNovelSummary, normalizeNovelTitle } from "@/lib/novel-display";
import { comicCoverFromImageUrls } from "@/lib/comic-display";
import { MobileFeedTabs } from "@/components/mobile/MobileBrowseDock";
import { FeedScrollRail } from "@/components/mobile/FeedScrollRail";

export type LiteraryFeedKind = "novel" | "comic";

export type LiteraryFeedItem = {
  id: string;
  title: string;
  subtitle?: string;
  coverPath: string | null;
  fallbackCover?: string | null;
  playCount?: number;
  likeCount?: number;
};

type Props = {
  kind: LiteraryFeedKind;
  activeTab: "novel" | "comic";
  fetchUrl: string;
  readLabel: string;
  emptyLabel: string;
  placeholderIcon: string;
};

function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function FeedCardCover({
  kind,
  item,
  isActive,
  placeholderIcon,
}: {
  kind: LiteraryFeedKind;
  item: LiteraryFeedItem;
  isActive: boolean;
  placeholderIcon: string;
}) {
  const locale = useLocale() as AppLocale;
  const tl = useTranslations("lists");
  const { displayCover, coverFailed, coverPending, retryCover } = useAutoWorkCover({
    kind,
    id: item.id,
    coverPath: item.coverPath,
    locale,
    fallbackCover: item.fallbackCover ?? null,
    autoFetch: isActive,
  });

  if (displayCover) {
    return (
      <img
        src={displayCover}
        alt=""
        className="h-full w-full object-cover"
        loading={isActive ? "eager" : "lazy"}
      />
    );
  }

  return (
    <WorkCoverPlaceholder
      icon={placeholderIcon}
      failedLabel={tl("coverFailed")}
      generatingLabel={tl("coverGenerating")}
      retryLabel={tl("coverRetry")}
      coverFailed={coverFailed}
      coverPending={coverPending}
      onRetry={retryCover}
      testId={`${kind}-feed-cover-${item.id}`}
    />
  );
}

export function LiterarySwipeFeed({
  kind,
  activeTab,
  fetchUrl,
  readLabel,
  emptyLabel,
  placeholderIcon,
}: Props) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("mobileFeed");
  const [items, setItems] = useState<LiteraryFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch(fetchUrl)
      .then((r) => r.json())
      .then((d) => {
        if (kind === "novel") {
          const raw = (d.novels ?? []) as Array<{
            id: string;
            title: string;
            summary: string | null;
            prompt: string;
            coverPath: string | null;
            playCount: number;
            likeCount: number;
          }>;
          setItems(
            raw.map((n) => ({
              id: n.id,
              title: normalizeNovelTitle(n.title, n.prompt, undefined, locale),
              subtitle: displayNovelSummary(n.summary, n.title, n.prompt, undefined, locale) ?? undefined,
              coverPath: n.coverPath,
              playCount: n.playCount,
              likeCount: n.likeCount,
            })),
          );
        } else {
          const raw = (d.comics ?? []) as Array<{
            id: string;
            title: string;
            coverPath: string | null;
            imageUrls?: string;
            likeCount: number;
            novel?: { title: string } | null;
          }>;
          setItems(
            raw.map((c) => ({
              id: c.id,
              title: c.title,
              subtitle: c.novel?.title ? t("adaptedFrom", { title: c.novel.title }) : undefined,
              coverPath: c.coverPath ?? null,
              fallbackCover: c.imageUrls ? comicCoverFromImageUrls(c.imageUrls) : null,
              likeCount: c.likeCount,
            })),
          );
        }
        setError(null);
      })
      .catch(() => setError(t("loadFailed")))
      .finally(() => setLoading(false));
  }, [fetchUrl, kind, locale, t]);

  useEffect(() => {
    if (!items.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null;
        entries.forEach((entry) => {
          const idx = cardRefs.current.findIndex((r) => r === entry.target);
          if (idx !== -1 && entry.intersectionRatio > (best?.ratio ?? 0)) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        });
        if (best) setActiveIdx((best as { idx: number }).idx);
      },
      { root: containerRef.current, threshold: [0.55, 0.75] },
    );
    cardRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, [items.length]);

  const scrollTo = useCallback((idx: number) => {
    const i = Math.max(0, Math.min(idx, cardRefs.current.length - 1));
    cardRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleLike = useCallback(
    (id: string) => {
      setLiked((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      void fetch(`/api/${kind}/${id}/like`, { method: "POST" });
    },
    [kind],
  );

  if (loading) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </div>
    );
  }

  if (error || items.length === 0) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white/70">
        <p className="text-sm">{error ?? emptyLabel}</p>
        <Link
          href={withLocalePath(kind === "novel" ? "/novels" : "/comics", locale)}
          className="rounded-full bg-white/15 px-5 py-2 text-sm text-white"
        >
          {t("browseList")}
        </Link>
      </div>
    );
  }

  const detailPrefix = kind === "novel" ? "/novel" : "/comic";

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 overflow-y-scroll overscroll-y-contain bg-black snap-y snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ touchAction: "pan-y" }}
    >
      {items.map((item, idx) => {
        const isActive = idx === activeIdx;
        const isLiked = liked.has(item.id);
        const href = withLocalePath(`${detailPrefix}/${item.id}`, locale);
        const likeDisplay = (item.likeCount ?? 0) + (isLiked ? 1 : 0);

        return (
          <div
            key={item.id}
            ref={(el) => {
              cardRefs.current[idx] = el;
            }}
            className="relative h-[100dvh] w-full shrink-0 snap-start snap-always"
          >
            <div className="absolute inset-0 bg-neutral-900">
              <FeedCardCover
                kind={kind}
                item={item}
                isActive={Math.abs(idx - activeIdx) <= 1}
                placeholderIcon={placeholderIcon}
              />
            </div>

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/80" />

            {isActive ? (
              <>
                <FeedScrollRail
                  onSwipeNext={() => scrollTo(idx + 1)}
                  onSwipePrev={() => scrollTo(idx - 1)}
                />

                <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-3 pt-[max(0.65rem,env(safe-area-inset-top))]">
                  <Link
                    href={withLocalePath("/", locale)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-lg text-white backdrop-blur-md"
                    aria-label={t("back")}
                  >
                    ←
                  </Link>
                  <MobileFeedTabs active={activeTab} />
                  <span className="w-9 text-right text-[10px] tabular-nums text-white/45">
                    {idx + 1}/{items.length}
                  </span>
                </div>

                <div className="absolute bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] right-3 z-30 flex flex-col items-center gap-5">
                  <button
                    type="button"
                    onClick={() => handleLike(item.id)}
                    className="flex flex-col items-center gap-1"
                    aria-label={t("like")}
                  >
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-xl backdrop-blur-md ${
                        isLiked ? "text-red-400" : "text-white"
                      }`}
                    >
                      {isLiked ? "♥" : "♡"}
                    </span>
                    <span className="text-[10px] tabular-nums text-white/75">{formatCount(likeDisplay)}</span>
                  </button>

                  <Link href={href} className="flex flex-col items-center gap-1">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-black">
                      {readLabel}
                    </span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => scrollTo(idx + 1)}
                    className="flex flex-col items-center gap-1"
                    aria-label={t("next")}
                  >
                    <span className="flex h-11 w-11 animate-bounce items-center justify-center rounded-full bg-black/35 text-lg text-white backdrop-blur-md">
                      ↓
                    </span>
                  </button>
                </div>

                <div className="absolute bottom-0 left-0 right-16 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <Link href={href}>
                    <h2 className="line-clamp-2 text-[16px] font-semibold leading-snug text-white drop-shadow">
                      {item.title}
                    </h2>
                    {item.subtitle ? (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/65">
                        {item.subtitle}
                      </p>
                    ) : null}
                    {kind === "novel" && (item.playCount ?? 0) > 0 ? (
                      <p className="mt-1.5 text-[11px] tabular-nums text-white/45">
                        {t("readsCount", { count: formatCount(item.playCount!) })}
                      </p>
                    ) : null}
                  </Link>
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
