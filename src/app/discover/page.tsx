"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";

type DiscoverProject = {
  id: string;
  title: string;
  prompt: string;
  coverPath: string | null;
  playCount: number;
  likeCount: number;
  shareCode: string | null;
  templateId: string | null;
  createdAt: string;
};

const TEMPLATE_LABELS: Record<string, string> = {
  avoider: "躲避",
  collector: "收集",
  survivor: "生存",
  platformer: "平台",
  towerDefense: "塔防",
  shooter: "射击",
};

const ALL_TEMPLATES = ["avoider", "collector", "survivor", "platformer", "towerDefense", "shooter"];

function GameCard({ p }: { p: DiscoverProject }) {
  const label = p.templateId ? (TEMPLATE_LABELS[p.templateId] ?? p.templateId) : null;
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(p.likeCount);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      setLiked(!!localStorage.getItem(`liked:${p.id}`));
    }
  }, [p.id]);

  function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (liked) return;
    setLiked(true);
    setLikes((n) => n + 1);
    localStorage.setItem(`liked:${p.id}`, "1");
    void fetch(`/api/projects/${p.id}/like`, { method: "POST" });
  }

  return (
    <Link
      href={`/play/${p.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:shadow-lg"
    >
      <div className="relative aspect-[920/560] w-full overflow-hidden bg-[var(--gc-bg-elevated)]">
        {p.coverPath ? (
          <img
            src={p.coverPath}
            alt={p.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-[var(--gc-muted)] opacity-30">
            ▶
          </div>
        )}
        {label ? (
          <span className="absolute left-2.5 top-2.5 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
            {label}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 py-3">
        <p className="line-clamp-1 text-sm font-semibold text-[var(--gc-text)]">{p.title}</p>
        <p className="line-clamp-2 text-xs text-[var(--gc-muted)]">{p.prompt}</p>
        <div className="mt-auto flex items-center justify-between pt-1">
          <p className="text-[11px] text-[var(--gc-text-faint)]">
            {p.playCount > 0 ? `${p.playCount} 次试玩` : "等待首位玩家"}
          </p>
          <button
            type="button"
            onClick={handleLike}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition ${
              liked
                ? "text-red-400"
                : "text-[var(--gc-text-faint)] hover:text-red-400"
            }`}
          >
            {liked ? "♥" : "♡"} {likes > 0 ? likes : ""}
          </button>
        </div>
      </div>
    </Link>
  );
}

const SORT_OPTIONS = [
  { key: "playCount", label: "最多试玩", subtitle: "按累计试玩次数排行" },
  { key: "likeCount", label: "最多点赞", subtitle: "按累计点赞数排行" },
  { key: "createdAt", label: "最新发布", subtitle: "按发布时间从新到旧" },
  { key: "hot", label: "综合推荐", subtitle: "试玩与点赞加权综合排行" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

export default function DiscoverPage() {
  const [projects, setProjects] = useState<DiscoverProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("playCount");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set("template", filter);
    if (sort !== "playCount") params.set("sort", sort);
    const url = `/api/discover${params.size > 0 ? `?${params.toString()}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: { projects?: DiscoverProject[] }) => {
        setProjects(d.projects ?? []);
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [filter, sort]);

  const sortMeta = SORT_OPTIONS.find((o) => o.key === sort) ?? SORT_OPTIONS[0];

  return (
    <div className="flex min-h-full flex-1 flex-col text-[var(--gc-text)] lg:flex-row">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-8 px-4 py-10 lg:px-8 xl:pr-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--gc-text)]">发现游戏</h1>
            <p className="mt-1 text-sm text-[var(--gc-muted)]">社区共创的一句话小游戏，{sortMeta.subtitle}</p>
          </div>
          <Link
            href="/create"
            className="gc-theme-cta self-start rounded-full px-5 py-2 text-sm font-semibold sm:self-auto"
          >
            创作新游戏
          </Link>
        </div>

        {/* Template filter chips */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              filter === null
                ? "border-[color:color-mix(in_srgb,var(--gc-accent)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_16%,transparent)] text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)]"
                : "border-[color:var(--gc-border)] text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
            }`}
          >
            全部
          </button>
          {ALL_TEMPLATES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(filter === t ? null : t)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                filter === t
                  ? "border-[color:color-mix(in_srgb,var(--gc-accent)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_16%,transparent)] text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)]"
                  : "border-[color:var(--gc-border)] text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
              }`}
            >
              {TEMPLATE_LABELS[t] ?? t}
            </button>
          ))}
        </div>

        {/* Sort tabs */}
        <div className="flex items-center gap-1 border-b border-[color:var(--gc-border)]">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSort(opt.key)}
              className={`-mb-px border-b-2 px-4 py-2 text-xs font-medium transition ${
                sort === opt.key
                  ? "border-[color:var(--gc-accent)] text-[var(--gc-text)]"
                  : "border-transparent text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="aspect-[920/560] animate-pulse rounded-2xl bg-[var(--gc-surface-glass)]" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-[var(--gc-muted)]">暂无游戏{filter ? `（${TEMPLATE_LABELS[filter] ?? filter}类型）` : ""}</p>
            <Link href="/create" className="text-sm text-[color:color-mix(in_srgb,var(--gc-accent)_90%,white)] underline underline-offset-4">
              成为第一个创作者
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {projects.map((p) => (
              <GameCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
