"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { prefetchGameProjectsByIds } from "@/lib/studio-godot-prefetch.client";

type FeaturedGame = {
  id: string;
  title: string;
  prompt: string;
  coverPath: string | null;
  playCount: number;
  likeCount: number;
};

export function FeaturedGamesSection() {
  const t = useTranslations("featured");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const [games, setGames] = useState<FeaturedGame[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/discover?limit=6")
      .then((r) => r.json())
      .then((d: { projects?: FeaturedGame[] }) => {
        const list = (d.projects ?? []).slice(0, 6);
        setGames(list);
        prefetchGameProjectsByIds(
          list.map((g) => g.id),
          6,
        );
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (loaded && games.length === 0) return null;

  return (
    <section className="border-t border-[color:var(--gc-border)] px-6 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-20 xl:px-20 2xl:px-28">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--gc-text-faint)]">{t("community")}</p>
          <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--gc-text)] sm:text-2xl">{t("hotGames")}</h2>
        </div>
        <Link
          href={withLocalePath("/discover", locale)}
          className="text-xs font-medium text-[var(--gc-muted)] underline-offset-4 hover:text-[var(--gc-text)] hover:underline"
        >
          {tc("viewAllArrow")}
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:mt-10 lg:grid-cols-6 lg:gap-3">
        {!loaded
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="aspect-[920/560] animate-pulse rounded-xl bg-[var(--gc-surface-glass)]" />
            ))
          : games.map((g) => (
              <Link
                key={g.id}
                href={withLocalePath(`/play/${g.id}`, locale)}
                className="group flex flex-col overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:shadow-md"
              >
                <div className="relative aspect-[920/560] w-full overflow-hidden bg-[var(--gc-bg-elevated)]">
                  {g.coverPath ? (
                    <img
                      src={g.coverPath}
                      alt={g.title}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-[var(--gc-muted)] opacity-30">
                      ▶
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 px-3 py-2">
                  <p className="line-clamp-1 text-xs font-semibold text-[var(--gc-text)]">{g.title}</p>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--gc-text-faint)]">
                    {g.playCount > 0 && <span>{t("playsShort", { count: g.playCount })}</span>}
                    {g.likeCount > 0 && <span>♥ {g.likeCount}</span>}
                  </div>
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}
