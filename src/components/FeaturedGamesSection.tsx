"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { useIdleEffect } from "@/hooks/use-idle-effect";
import { gameCoverFeaturedFrameClass } from "@/lib/cover-display-sizes";
import { deriveFeaturedBlurb } from "@/lib/featured-blurb";

type FeaturedGame = {
  id: string;
  title: string;
  prompt: string;
  coverPath: string | null;
  playCount: number;
  likeCount: number;
};

const shelfGrid =
  "mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:mt-6 lg:grid-cols-3 lg:gap-6";
const cardClass =
  "group flex flex-col overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition duration-300 hover:-translate-y-1 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,var(--gc-border))] hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.55)]";

export function FeaturedGamesSection() {
  const t = useTranslations("featured");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const [games, setGames] = useState<FeaturedGame[]>([]);
  const [loaded, setLoaded] = useState(false);

  useIdleEffect(() => {
    const ac = new AbortController();
    fetch("/api/discover?limit=6", { signal: ac.signal })
      .then((r) => r.json())
      .then((d: { projects?: FeaturedGame[] }) => {
        setGames((d.projects ?? []).slice(0, 6));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => ac.abort();
  }, []);

  if (loaded && games.length === 0) return null;

  return (
    <section className="border-t border-[color:var(--gc-border)] px-5 py-8 sm:px-10 sm:py-10 lg:px-14 xl:px-20 2xl:px-28">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--gc-text-faint)]">{t("community")}</p>
          <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--gc-text)] sm:text-2xl">{t("hotGames")}</h2>
        </div>
        <Link
          href={withLocalePath("/discover", locale)}
          className="shrink-0 text-xs font-medium text-[var(--gc-muted)] underline-offset-4 hover:text-[var(--gc-text)] hover:underline"
        >
          {tc("viewAllArrow")}
        </Link>
      </div>

      <div className={shelfGrid}>
        {!loaded
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`${gameCoverFeaturedFrameClass} animate-pulse rounded-2xl bg-[var(--gc-surface-glass)]`} />
            ))
          : games.map((g, i) => {
              const blurb = deriveFeaturedBlurb(g.prompt);
              return (
                <Link
                  key={g.id}
                  href={withLocalePath(`/play/${g.id}`, locale)}
                  className={`${cardClass} gc-home-reveal`}
                  style={{ animationDelay: `${Math.min(i, 5) * 0.06}s` }}
                >
                  <div className={gameCoverFeaturedFrameClass}>
                    {g.coverPath ? (
                      <img
                        src={g.coverPath}
                        alt={g.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl text-[var(--gc-muted)] opacity-30">
                        ▶
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-70 transition duration-300 group-hover:opacity-90" />
                    <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-black opacity-0 translate-y-1 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      {t("ctaPlay")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 px-4 py-3.5 sm:px-5 sm:py-4">
                    <p className="line-clamp-1 text-[15px] font-semibold tracking-tight text-[var(--gc-text)] sm:text-base">
                      {g.title}
                    </p>
                    {blurb ? (
                      <p className="line-clamp-2 text-[12px] leading-relaxed text-[var(--gc-muted)] sm:text-[13px]">
                        {blurb}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2 pt-0.5 text-[11px] text-[var(--gc-text-faint)]">
                      {g.playCount > 0 && <span>{t("playsShort", { count: g.playCount })}</span>}
                      {g.likeCount > 0 && <span>♥ {g.likeCount}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>
    </section>
  );
}
