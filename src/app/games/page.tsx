"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { prefetchGameProjectsByIds } from "@/lib/studio-godot-prefetch.client";

interface GameWork {
  id: string;
  title: string;
  prompt: string;
  coverPath: string | null;
  playCount: number;
  likeCount: number;
  shareCode: string | null;
  createdAt: string;
  templateId: string | null;
}

const TEMPLATE_LABELS: Record<string, string> = {
  avoider: "躲避",
  collector: "收集",
  survivor: "生存",
  platformer: "平台",
  towerDefense: "塔防",
  shooter: "射击",
};

function GameCard({ game }: { game: GameWork }) {
  return (
    <Link
      href={`/play/${game.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:shadow-md"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-[var(--gc-bg-elevated)]">
        {game.coverPath ? (
          <img
            src={game.coverPath}
            alt={game.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-[var(--gc-muted)] opacity-30">
            🎮
          </div>
        )}
        {game.templateId && (
          <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
            {TEMPLATE_LABELS[game.templateId] ?? game.templateId}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-3 py-2">
        <p className="line-clamp-1 text-sm font-semibold text-[var(--gc-text)]">{game.title}</p>
        <p className="line-clamp-1 text-xs text-[var(--gc-muted)]">{game.prompt}</p>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--gc-text-faint)]">
          {game.playCount > 0 && <span>▶ {game.playCount}</span>}
          {game.likeCount > 0 && <span>♥ {game.likeCount}</span>}
        </div>
      </div>
    </Link>
  );
}

export default function GamesPage() {
  const [games, setGames] = useState<GameWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"playCount" | "likeCount" | "createdAt">("playCount");
  const pathname = usePathname();

  useEffect(() => {
    fetch(`/api/discover?sort=${sort}&limit=48`)
      .then((r) => r.json())
      .then((d) => {
        const list = d.projects ?? [];
        setGames(list);
        prefetchGameProjectsByIds(
          list.map((g: GameWork) => g.id),
          8,
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sort]);

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row" data-module="game">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-6 px-4 py-10 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,#60a5fa_18%,transparent)] text-xl">
            🎮
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--gc-text)]">游戏作品</h1>
            <p className="text-xs text-[var(--gc-muted)]">探索社区创作的 AI 生成游戏</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-0.5">
            {([
              { key: "playCount", label: "最热" },
              { key: "likeCount", label: "最多赞" },
              { key: "createdAt", label: "最新" },
            ] as const).map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  sort === s.key
                    ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] text-[var(--gc-text)]"
                    : "text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Link
            href="/create"
            className="gc-theme-cta ml-auto inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-semibold shadow-lg hover:brightness-110"
          >
            创作游戏
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-xl bg-[var(--gc-surface-glass)]" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="gc-card flex flex-col items-center justify-center gap-4 px-8 py-20 text-center">
            <p className="text-sm text-[var(--gc-muted)]">还没有游戏作品</p>
            <Link href="/create" className="gc-theme-cta rounded-full px-6 py-2 text-sm font-semibold">
              去创作
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {games.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
