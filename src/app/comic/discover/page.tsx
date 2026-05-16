"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

interface Comic {
  id: string;
  title: string;
  imageUrls: string;
  novel: { id: string; title: string };
  createdAt: string;
  likeCount: number;
}

interface ComicPanel {
  caption: string;
  prompt: string;
  imageUrl?: string;
}

function ComicCard({ c }: { c: Comic }) {
  const [liked, setLiked] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return !!localStorage.getItem(`liked:comic:${c.id}`);
  });
  const [likes, setLikes] = useState(c.likeCount);

  function firstImage(): string | null {
    try {
      const panels: ComicPanel[] = JSON.parse(c.imageUrls);
      return panels[0]?.imageUrl || null;
    } catch {
      return null;
    }
  }

  function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (liked) return;
    setLiked(true);
    setLikes((n) => n + 1);
    localStorage.setItem(`liked:comic:${c.id}`, "1");
    void fetch(`/api/comic/${c.id}/like`, { method: "POST" });
  }

  const img = firstImage();

  return (
    <Link
      href={`/comic/${c.id}`}
      className="group flex flex-col rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4 transition hover:border-[color:var(--gc-accent)]/40"
    >
      {img ? (
        <div className="mb-3 aspect-[4/3] overflow-hidden rounded-lg bg-[var(--gc-bg)]">
          <img
            src={img}
            alt={c.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="mb-3 flex aspect-[4/3] items-center justify-center rounded-lg bg-[var(--gc-bg)] text-xs text-[var(--gc-muted)]">
          暂无预览图
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--gc-text)] group-hover:text-[var(--gc-accent)]">
        {c.title}
      </h3>
      <p className="mt-1 text-xs text-[var(--gc-muted)]">基于《{c.novel.title}》</p>
      <div className="mt-auto flex items-center justify-between pt-3 text-[10px] text-[var(--gc-muted)]">
        <span>{new Date(c.createdAt).toLocaleDateString()}</span>
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

export default function ComicDiscoverPage() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 24;
  const [loading, setLoading] = useState(true);

  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => setLoading(true));
    fetch(`/api/comic?page=${page}&limit=${limit}`)
      .then((r) => r.json())
      .then((data) => {
        setComics(data.comics || []);
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
              <h1 className="text-2xl font-bold text-[var(--gc-text)]">动漫广场</h1>
              <p className="mt-1 text-sm text-[var(--gc-muted)]">发现 AI 生成的小说漫画</p>
            </div>
            <Link href="/comic/create" className="gc-theme-cta rounded-xl px-4 py-2 text-sm font-semibold">
              + 创作漫画
            </Link>
          </div>

          {loading ? (
            <p className="text-[var(--gc-muted)]">加载中…</p>
          ) : comics.length === 0 ? (
            <div className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-8 text-center">
              <p className="text-[var(--gc-muted)]">还没有漫画，去创作一篇吧</p>
              <Link href="/comic/create" className="mt-3 inline-block text-sm text-[var(--gc-accent)]">
                开始创作 →
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {comics.map((c) => (
                  <ComicCard key={c.id} c={c} />
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
