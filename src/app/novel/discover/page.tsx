"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { displayNovelSummary, normalizeNovelTitle } from "@/lib/novel-display";

interface Novel {
  id: string;
  title: string;
  summary: string | null;
  prompt: string;
  coverPath: string | null;
  createdAt: string;
  playCount: number;
  likeCount: number;
  isOwner?: boolean;
}

function NovelCard({ n, onDeleted }: { n: Novel; onDeleted?: (id: string) => void }) {
  const title = normalizeNovelTitle(n.title, n.prompt);
  const blurb = displayNovelSummary(n.summary, title, n.prompt);
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

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const title = normalizeNovelTitle(n.title, n.prompt);
    if (!confirm(`确定删除《${title}》？关联漫画也会一并删除，且无法恢复。`)) return;
    const res = await fetch(`/api/novel/${n.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      alert(data.error ?? "删除失败，请确认使用创作时的浏览器登录态");
      return;
    }
    onDeleted?.(n.id);
  }

  return (
    <Link
      href={`/novel/${n.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] transition hover:border-[color:var(--gc-accent)]/40"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--gc-bg-elevated)]">
        {n.isOwner ? (
          <button
            type="button"
            title="删除"
            onClick={(e) => void handleDelete(e)}
            className="absolute right-2 top-2 z-10 rounded-lg bg-black/55 px-2 py-1 text-[10px] font-medium text-red-200 opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-red-950/80"
          >
            删除
          </button>
        ) : null}
        {n.coverPath ? (
          <img
            src={n.coverPath}
            alt={title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--gc-muted)] opacity-60">
            <span className="text-2xl">📖</span>
            <span className="text-[10px]">封面生成中…</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-[var(--gc-text)] group-hover:text-[var(--gc-accent)]">
          {title}
        </h3>
        {blurb && <p className="line-clamp-2 text-xs text-[var(--gc-text-soft)]">{blurb}</p>}
        <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--gc-muted)]">
          <div className="flex items-center gap-3">
            <span>▶ {n.playCount}</span>
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
  const coverRequested = useRef(new Set<string>());

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

  /** 广场列表：无封面时后台补生成（每本仅请求一次），完成后局部刷新卡片 */
  useEffect(() => {
    const missing = novels.filter((n) => !n.coverPath && !coverRequested.current.has(n.id));
    if (missing.length === 0) return;

    let cancelled = false;
    const run = async () => {
      const queue = missing.slice(0, 12);
      const concurrency = 2;
      let idx = 0;
      const worker = async () => {
        while (idx < queue.length && !cancelled) {
          const n = queue[idx++];
          try {
            const res = await fetch(`/api/novel/${n.id}/cover`, { method: "POST" });
            const data = (await res.json()) as { coverPath?: string };
            if (data.coverPath && !cancelled) {
              coverRequested.current.add(n.id);
              setNovels((prev) => prev.map((x) => (x.id === n.id ? { ...x, coverPath: data.coverPath! } : x)));
            }
          } catch {
            /* 单本失败不影响其它；未标记 requested，刷新后可重试 */
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [novels]);

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
                  <NovelCard
                    key={n.id}
                    n={n}
                    onDeleted={(id) => {
                      setNovels((prev) => prev.filter((x) => x.id !== id));
                      setTotal((t) => Math.max(0, t - 1));
                    }}
                  />
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
