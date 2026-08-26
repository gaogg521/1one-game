"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { useIdleEffect } from "@/hooks/use-idle-effect";
import { novelCoverFeaturedFrameClass } from "@/lib/cover-display-sizes";
import { deriveFeaturedBlurb } from "@/lib/featured-blurb";

interface FeaturedNovel {
  id: string;
  title: string;
  summary: string | null;
  prompt?: string | null;
  coverPath: string | null;
  playCount: number;
  likeCount: number;
}

/** 小说竖图略收：4 列 + 更紧字阶，避免封面压过样品馆 */
const shelfGrid =
  "mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:mt-6 lg:grid-cols-4 lg:gap-4";
const cardClass =
  "group flex flex-col overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition duration-300 hover:-translate-y-1 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,var(--gc-border))] hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.55)]";

export function FeaturedNovelsSection() {
  const t = useTranslations("featured");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const [novels, setNovels] = useState<FeaturedNovel[]>([]);
  const [loaded, setLoaded] = useState(false);

  useIdleEffect(() => {
    const ac = new AbortController();
    fetch("/api/novel?limit=8", { signal: ac.signal })
      .then((r) => r.json())
      .then((d: { novels?: FeaturedNovel[] }) => {
        setNovels((d.novels ?? []).slice(0, 8));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => ac.abort();
  }, []);

  if (loaded && novels.length === 0) return null;

  return (
    <section className="border-t border-[color:var(--gc-border)] px-5 py-8 sm:px-10 sm:py-10 lg:px-14 xl:px-20 2xl:px-28">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--gc-text-faint)]">{t("stories")}</p>
          <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--gc-text)] sm:text-2xl">{t("hotNovels")}</h2>
        </div>
        <Link
          href={withLocalePath("/novel/discover", locale)}
          className="shrink-0 text-xs font-medium text-[var(--gc-muted)] underline-offset-4 hover:text-[var(--gc-text)] hover:underline"
        >
          {tc("viewAllArrow")}
        </Link>
      </div>

      <div className={shelfGrid}>
        {!loaded
          ? Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={`${novelCoverFeaturedFrameClass} animate-pulse rounded-2xl bg-[var(--gc-surface-glass)]`} />
            ))
          : novels.map((n, i) => {
              const blurb = deriveFeaturedBlurb(n.summary, n.prompt);
              return (
                <Link
                  key={n.id}
                  href={withLocalePath(`/novel/${n.id}`, locale)}
                  className={`${cardClass} gc-home-reveal`}
                  style={{ animationDelay: `${Math.min(i, 7) * 0.05}s` }}
                >
                  <div className={novelCoverFeaturedFrameClass}>
                    {n.coverPath ? (
                      <img
                        src={n.coverPath}
                        alt={n.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-[var(--gc-muted)] opacity-30">
                        📖
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-70 transition duration-300 group-hover:opacity-90" />
                    <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-black opacity-0 translate-y-1 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      {t("ctaRead")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 px-3 py-2.5">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug tracking-tight text-[var(--gc-text)]">
                      {n.title}
                    </p>
                    {blurb ? (
                      <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--gc-muted)]">{blurb}</p>
                    ) : null}
                    <div className="flex items-center gap-2 pt-0.5 text-[10px] text-[var(--gc-text-faint)]">
                      {n.playCount > 0 && <span>{t("readsShort", { count: n.playCount })}</span>}
                      {n.likeCount > 0 && <span>♥ {n.likeCount}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>
    </section>
  );
}
