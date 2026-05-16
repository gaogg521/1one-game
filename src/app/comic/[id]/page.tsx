"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { parseComicImageUrls, type ComicPage } from "@/lib/comic-format";

interface Comic {
  id: string;
  title: string;
  imageUrls: string;
  novel: { id: string; title: string };
  createdAt: string;
  shareCode: string | null;
}

function ShareButton({ comicId }: { comicId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      const res = await fetch(`/api/comic/${comicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensureShareCode: true }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { comic?: { shareCode?: string | null } };
      const code = data.comic?.shareCode;
      if (!code) return;
      const url = `${window.location.origin}/s/${code}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-xs font-medium text-[var(--gc-muted)] transition hover:border-[color:var(--gc-accent)]/40 hover:text-[var(--gc-text)]"
    >
      {copied ? "已复制" : "分享"}
    </button>
  );
}

function ComicPageGrid({ page }: { page: ComicPage }) {
  const panels = page.panels.slice(0, 4);
  while (panels.length < 4) {
    panels.push({ caption: "", prompt: "" });
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {panels.map((panel, idx) => (
        <div
          key={idx}
          className="relative aspect-square overflow-hidden rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg)]"
        >
          {panel.imageUrl ? (
            <img
              src={panel.imageUrl}
              alt={panel.caption || `第${page.page}页-${idx + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full flex-col justify-end p-2 sm:p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--gc-muted)]">待生成</p>
              <p className="mt-1 line-clamp-4 text-xs text-[var(--gc-text-soft)]">{panel.caption || panel.prompt}</p>
            </div>
          )}
          {panel.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-2">
              <p className="text-xs font-medium text-white">{panel.caption}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ComicDetailPage() {
  const { id } = useParams();
  const [comic, setComic] = useState<Comic | null>(null);
  const [pages, setPages] = useState<ComicPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/comic/${encodeURIComponent(id as string)}`)
      .then(async (r) => {
        const ct = r.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          setError(`加载失败（HTTP ${r.status}）`);
          return;
        }
        const data = (await r.json()) as { comic?: Comic; error?: string };
        if (!r.ok) {
          setError(data.error || `加载失败（HTTP ${r.status}）`);
          return;
        }
        if (data.comic) {
          setComic(data.comic);
          const doc = parseComicImageUrls(data.comic.imageUrls);
          setPages(doc.pages);
        } else {
          setError("漫画不存在");
        }
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <SiteHeader />
        <main className="flex-1 px-6 py-10 lg:px-10">
          <p className="text-[var(--gc-muted)]">加载中…</p>
        </main>
      </div>
    );
  }

  if (error || !comic) {
    return (
      <div className="flex min-h-screen">
        <SiteHeader />
        <main className="flex-1 px-6 py-10 lg:px-10">
          <p className="text-red-400">{error || "未找到"}</p>
        </main>
      </div>
    );
  }

  const page = pages[currentPage];
  const total = pages.length;

  return (
    <div className="flex min-h-screen">
      <SiteHeader />
      <main className="flex-1 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--gc-text)]">{comic.title}</h1>
              <p className="mt-1 text-xs text-[var(--gc-muted)]">
                基于《
                <Link href={`/novel/${comic.novel.id}`} className="underline hover:text-[var(--gc-accent)]">
                  {comic.novel.title}
                </Link>
                》· {total} 页（每页 4 格）· {new Date(comic.createdAt).toLocaleDateString()}
              </p>
            </div>
            <ShareButton comicId={comic.id} />
          </div>

          {total === 0 ? (
            <p className="text-[var(--gc-muted)]">暂无分镜数据</p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 0}
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-sm disabled:opacity-40"
                >
                  上一页
                </button>
                <span className="text-sm text-[var(--gc-muted)]">
                  第 {currentPage + 1} / {total} 页
                </span>
                <button
                  type="button"
                  disabled={currentPage >= total - 1}
                  onClick={() => setCurrentPage((p) => Math.min(total - 1, p + 1))}
                  className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-sm disabled:opacity-40"
                >
                  下一页
                </button>
              </div>

              {page && <ComicPageGrid page={page} />}

              {total > 1 && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {pages.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentPage(i)}
                      className={`h-9 w-9 rounded-lg text-sm font-medium transition ${
                        i === currentPage
                          ? "bg-[var(--gc-accent)] text-white"
                          : "border border-[color:var(--gc-border)] text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
