"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { useIdleEffect } from "@/hooks/use-idle-effect";
import { comicCoverFeaturedFrameClass } from "@/lib/cover-display-sizes";
import { deriveFeaturedBlurb } from "@/lib/featured-blurb";
import { ComicNovelSourceMeta } from "@/components/comic/ComicNovelSourceMeta";

interface FeaturedComic {
  id: string;
  title: string;
  prompt?: string | null;
  imageUrls?: string;
  coverPath?: string | null;
  novel?: { id?: string; title: string } | null;
  likeCount: number;
}

const shelfGrid =
  "mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:mt-6 lg:grid-cols-3 lg:gap-6";
const cardClass =
  "group flex flex-col overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition duration-300 hover:-translate-y-1 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,var(--gc-border))] hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.55)]";

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
    <section className="border-t border-[color:var(--gc-border)] px-5 py-8 sm:px-10 sm:py-10 lg:px-14 xl:px-20 2xl:px-28">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--gc-text-faint)]">{t("manga")}</p>
          <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--gc-text)] sm:text-2xl">{t("hotComics")}</h2>
        </div>
        <Link
          href={withLocalePath("/comic/discover", locale)}
          className="shrink-0 text-xs font-medium text-[var(--gc-muted)] underline-offset-4 hover:text-[var(--gc-text)] hover:underline"
        >
          {tc("viewAllArrow")}
        </Link>
      </div>

      <div className={shelfGrid}>
        {!loaded
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`${comicCoverFeaturedFrameClass} animate-pulse rounded-2xl bg-[var(--gc-surface-glass)]`} />
            ))
          : comics.map((c, i) => {
              const img = coverImage(c);
              const blurb = deriveFeaturedBlurb(c.prompt);
              return (
                <Link
                  key={c.id}
                  href={withLocalePath(`/comic/${c.id}`, locale)}
                  className={`${cardClass} gc-home-reveal`}
                  style={{ animationDelay: `${Math.min(i, 5) * 0.06}s` }}
                >
                  <div className={comicCoverFeaturedFrameClass}>
                    {img ? (
                      <img
                        src={img}
                        alt={c.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl text-[var(--gc-muted)] opacity-30">
                        🎨
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-70 transition duration-300 group-hover:opacity-90" />
                    <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black opacity-0 translate-y-1 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      {t("ctaComic")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 px-3.5 py-3 sm:px-4 sm:py-3.5">
                    <p className="line-clamp-2 text-[14px] font-semibold leading-snug tracking-tight text-[var(--gc-text)]">
                      {c.title}
                    </p>
                    {blurb ? (
                      <p className="line-clamp-2 text-[12px] leading-relaxed text-[var(--gc-muted)]">{blurb}</p>
                    ) : null}
                    <ComicNovelSourceMeta
                      novel={c.novel}
                      locale={locale}
                      className="line-clamp-1 text-[11px] text-[var(--gc-text-faint)]"
                      insideCardLink
                    />
                    <div className="flex items-center gap-2 text-[11px] text-[var(--gc-text-faint)]">
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
