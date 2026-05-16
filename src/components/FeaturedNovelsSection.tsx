"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface FeaturedNovel {
  id: string;
  title: string;
  summary: string | null;
  coverPath: string | null;
  playCount: number;
  likeCount: number;
}

export function FeaturedNovelsSection() {
  const [novels, setNovels] = useState<FeaturedNovel[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/novel?limit=6")
      .then((r) => r.json())
      .then((d: { novels?: FeaturedNovel[] }) => {
        setNovels((d.novels ?? []).slice(0, 6));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (loaded && novels.length === 0) return null;

  return (
    <section className="border-t border-[color:var(--gc-border)] px-6 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-20 xl:px-20 2xl:px-28">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--gc-text-faint)]">Stories</p>
          <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--gc-text)] sm:text-2xl">社区热门小说</h2>
        </div>
        <Link
          href="/novel/discover"
          className="text-xs font-medium text-[var(--gc-muted)] underline-offset-4 hover:text-[var(--gc-text)] hover:underline"
        >
          查看全部 →
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:mt-10 lg:grid-cols-6 lg:gap-3">
        {!loaded
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-[var(--gc-surface-glass)]" />
            ))
          : novels.map((n) => (
              <Link
                key={n.id}
                href={`/novel/${n.id}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:shadow-md"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--gc-bg-elevated)]">
                  {n.coverPath ? (
                    <img
                      src={n.coverPath}
                      alt={n.title}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-[var(--gc-muted)] opacity-30">
                      📖
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 px-3 py-2">
                  <p className="line-clamp-1 text-xs font-semibold text-[var(--gc-text)]">{n.title}</p>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--gc-text-faint)]">
                    {n.playCount > 0 && <span>{n.playCount} 读</span>}
                    {n.likeCount > 0 && <span>♥ {n.likeCount}</span>}
                  </div>
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}
