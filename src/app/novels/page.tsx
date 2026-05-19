"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { displayNovelSummary, normalizeNovelTitle } from "@/lib/novel-display";

interface NovelWork {
  id: string;
  title: string;
  summary: string | null;
  prompt: string;
  coverPath: string | null;
  playCount: number;
  likeCount: number;
  createdAt: string;
}

function NovelCard({ novel }: { novel: NovelWork }) {
  const title = normalizeNovelTitle(novel.title, novel.prompt);
  const blurb = displayNovelSummary(novel.summary, title, novel.prompt, undefined);
  return (
    <Link
      href={`/novel/${novel.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:shadow-md"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--gc-bg-elevated)]">
        {novel.coverPath ? (
          <img
            src={novel.coverPath}
            alt={title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-[var(--gc-muted)] opacity-30">
            📖
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-3 py-2">
        <p className="line-clamp-1 text-sm font-semibold text-[var(--gc-text)]">{title}</p>
        {blurb && <p className="line-clamp-1 text-xs text-[var(--gc-muted)]">{blurb}</p>}
        <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--gc-text-faint)]">
          {novel.playCount > 0 && <span>▶ {novel.playCount} 读</span>}
          {novel.likeCount > 0 && <span>♥ {novel.likeCount}</span>}
        </div>
      </div>
    </Link>
  );
}

export default function NovelsPage() {
  const [novels, setNovels] = useState<NovelWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"playCount" | "likeCount" | "createdAt">("playCount");

  useEffect(() => {
    fetch(`/api/novel?sort=${sort}&limit=48`)
      .then((r) => r.json())
      .then((d) => {
        setNovels(d.novels ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sort]);

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row" data-module="novel">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-6 px-4 py-10 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,#818cf8_18%,transparent)] text-xl">
            📖
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--gc-text)]">小说作品</h1>
            <p className="text-xs text-[var(--gc-muted)]">阅读社区创作的 AI 生成小说</p>
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
            href="/novel/create"
            className="gc-theme-cta ml-auto inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-semibold shadow-lg hover:brightness-110"
          >
            创作小说
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-[var(--gc-surface-glass)]" />
            ))}
          </div>
        ) : novels.length === 0 ? (
          <div className="gc-card flex flex-col items-center justify-center gap-4 px-8 py-20 text-center">
            <p className="text-sm text-[var(--gc-muted)]">还没有小说作品</p>
            <Link href="/novel/create" className="gc-theme-cta rounded-full px-6 py-2 text-sm font-semibold">
              去创作
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {novels.map((n) => (
              <NovelCard key={n.id} novel={n} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
