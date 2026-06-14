"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { useIdleEffect } from "@/hooks/use-idle-effect";
import { comicCoverFeaturedFrameClass } from "@/lib/cover-display-sizes";
import { ComicNovelSourceMeta } from "@/components/comic/ComicNovelSourceMeta";

interface FeaturedComic {
  id: string;
  title: string;
  imageUrls?: string;
  coverPath?: string | null;
  novel?: { id?: string; title: string } | null;
  likeCount: number;
}

export function FeaturedComicsSection() {
  const t = useTranslations("featured");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const [comics, setComics] = useState<FeaturedComic[]>([]);
  const [loaded, setLoaded] = useState(false);

  useIdleEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const featuredRes = await fetch("/api/comic?featured=1&limit=6", { signal: ac.signal });
        const featuredData = (await featuredRes.json()) as { comics?: FeaturedComic[] };
        const featured = featuredData.comics ?? [];
        if (featured.length > 0) {
          setComics(featured.slice(0, 6));
          setLoaded(true);
          return;
        }
        const fallbackRes = await fetch("/api/comic?sort=likeCount&limit=6", { signal: ac.signal });
        const fallbackData = (await fallbackRes.json()) as { comics?: FeaturedComic[] };
        setComics((fallbackData.comics ?? []).slice(0, 6));
        setLoaded(true);
      } catch {
        if (!ac.signal.aborted) setLoaded(true);
      }
    })();
    return () => ac.abort();
  }, []);

  if (loaded && comics.length === 0) return null;

  function coverImage(c: FeaturedComic): string | null {
    if (c.coverPath?.trim()) return c.coverPath.trim();
    if (!c.imageUrls) return null;
    try {
      const parsed = JSON.parse(c.imageUrls) as unknown;
      if (Array.isArray(parsed)) {
        const first = parsed[0] as { imageUrl?: string } | undefined;
        return first?.imageUrl?.trim() || null;
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

  return (
    <section className="border-t border-[color:var(--gc-border)] px-6 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-20 xl:px-20 2xl:px-28">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--gc-text-faint)]">{t("manga")}</p>
          <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--gc-text)] sm:text-2xl">{t("hotComics")}</h2>
        </div>
        <Link
          href={withLocalePath("/comic/discover", locale)}
          className="text-xs font-medium text-[var(--gc-muted)] underline-offset-4 hover:text-[var(--gc-text)] hover:underline"
        >
          {tc("viewAllArrow")}
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:mt-10 lg:grid-cols-6 lg:gap-3">
        {!loaded
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`${comicCoverFeaturedFrameClass} animate-pulse rounded-xl bg-[var(--gc-surface-glass)]`} />
            ))
          : comics.map((c) => {
              const img = coverImage(c);
              return (
                <Link
                  key={c.id}
                  href={withLocalePath(`/comic/${c.id}`, locale)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:shadow-md"
                >
                  <div className={comicCoverFeaturedFrameClass}>
                    {img ? (
                      <img
                        src={img}
                        alt={c.title}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-[var(--gc-muted)] opacity-30">
                        🎨
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 px-3 py-2">
                    <p className="line-clamp-1 text-xs font-semibold text-[var(--gc-text)]">{c.title}</p>
                    <ComicNovelSourceMeta
                      novel={c.novel}
                      locale={locale}
                      className="line-clamp-1 text-[10px] text-[var(--gc-text-faint)]"
                      insideCardLink
                    />
                    <div className="flex items-center gap-2 text-[10px] text-[var(--gc-text-faint)]">
                      {c.likeCount > 0 && <span>♥ {c.likeCount}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>
    </section>
  );
}
