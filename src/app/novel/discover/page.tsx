"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

interface Novel {
  id: string;
  title: string;
  summary: string | null;
  prompt: string;
  createdAt: string;
  playCount: number;
  likeCount: number;
}

function NovelCard({ n }: { n: Novel }) {
  const [liked, setLiked] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return !!localStorage.getItem(`liked:novel:${n.id}`);
  });
  const [likes, setLikes] = useState(n.likeCount);

  function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (liked) return;
    setLiked(true);
    setLikes((c) => c + 1);
    localStorage.setItem(`liked:novel:${n.id}`, "1");
    void fetch(`/api/novel/${n.id}/like`, { method: "POST" });
  }

  return (
    <Link
      href={`/novel/${n.id}`}
      className="group flex flex-col rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4 transition hover:border-[color:var(--gc-accent)]/40"
    >
      <h3 className="text-base font-semibold text-[var(--gc-text)] group-hover:text-[var(--gc-accent)]">
        {n.title}
      </h3>
      {n.summary && (
        <p className="mt-1 line-clamp-2 text-xs text-[var(--gc-text-soft)]">{n.summary}</p>
      )}
      <div className="mt-auto flex items-center justify-between pt-3 text-[10px] text-[var(--gc-muted)]">
        <div className="flex items-center gap-3">
          <span>▶ {n.playCount} 次阅读</span>
          <span>{new Date(n.createdAt).toLocaleDateString()}</span>
        </div>
        <button
          type="button"
          onClick={handleLike}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition ${
            liked ? "text-red-400" : "text-[var(--gc-text-faint)] hover:text-red-400"
          }`}
        >
          {liked ? "♥" : "♡"} {likes > 0 ? likes : ""}
        </button>
      </div>
    </Link>
  );
}

export default function NovelDiscoverPage() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 24;
  const [loading, setLoading] = useState(true);

  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => setLoading(true));
    fetch(`/api/novel?page=${page}&limit=${limit}`)
      .then((r) => r.json())
      .then((data) => {
        setNovels(data.novels || []);
        setTotal(data.total || 0);
      })
      .finally(() => setLoading(false));
  }, [page, limit]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex min-h-screen">
      <SiteHeader />
      <main className="flex-1 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--gc-text)]">小说广场</h1>
              <p className="mt-1 text-sm text-[var(--gc-muted)]">发现 AI 生成的长篇小说</p>
            </div>
            <Link href="/novel/create" className="gc-theme-cta rounded-xl px-4 py-2 text-sm font-semibold">
              + 创作小说
            </Link>
          </div>

          {loading ? (
            <p className="text-[var(--gc-muted)]">加载中…</p>
          ) : novels.length === 0 ? (
            <div className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-8 text-center">
              <p className="text-[var(--gc-muted)]">还没有小说，去创作一篇吧</p>
              <Link href="/novel/create" className="mt-3 inline-block text-sm text-[var(--gc-accent)]">
                开始创作 →
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {novels.map((n) => (
                  <NovelCard key={n.id} n={n} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-[color:var(--gc-border)] px-3 py-1.5 text-sm text-[var(--gc-text)] transition hover:border-[color:var(--gc-accent)]/40 disabled:opacity-40"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-[var(--gc-muted)]">
                    第 {page} 页 / 共 {totalPages} 页
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-[color:var(--gc-border)] px-3 py-1.5 text-sm text-[var(--gc-text)] transition hover:border-[color:var(--gc-accent)]/40 disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
