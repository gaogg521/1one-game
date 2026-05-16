"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface FeaturedComic {
  id: string;
  title: string;
  imageUrls: string;
  novel: { title: string };
  likeCount: number;
}

interface ComicPanel {
  caption: string;
  prompt: string;
  imageUrl?: string;
}

export function FeaturedComicsSection() {
  const [comics, setComics] = useState<FeaturedComic[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/comic?limit=6")
      .then((r) => r.json())
      .then((d: { comics?: FeaturedComic[] }) => {
        setComics((d.comics ?? []).slice(0, 6));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (loaded && comics.length === 0) return null;

  function firstImage(c: FeaturedComic): string | null {
    try {
      const panels: ComicPanel[] = JSON.parse(c.imageUrls);
      return panels[0]?.imageUrl || null;
    } catch {
      return null;
    }
  }

  return (
    <section className="border-t border-[color:var(--gc-border)] px-6 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-20 xl:px-20 2xl:px-28">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--gc-text-faint)]">Manga</p>
          <h2 className="mt-2 text-xl font-medium tracking-tight text-[var(--gc-text)] sm:text-2xl">社区热门漫画</h2>
        </div>
        <Link
          href="/comic/discover"
          className="text-xs font-medium text-[var(--gc-muted)] underline-offset-4 hover:text-[var(--gc-text)] hover:underline"
        >
          查看全部 →
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:mt-10 lg:grid-cols-6 lg:gap-3">
        {!loaded
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-[var(--gc-surface-glass)]" />
            ))
          : comics.map((c) => {
              const img = firstImage(c);
              return (
                <Link
                  key={c.id}
                  href={`/comic/${c.id}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--gc-bg-elevated)]">
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
