"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

interface ComicPanel {
  caption: string;
  prompt: string;
  imageUrl?: string;
}

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
      const res = await fetch(`/api/comic/${comicId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ensureShareCode: true }) });
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

export default function ComicDetailPage() {
  const { id } = useParams();
  const [comic, setComic] = useState<Comic | null>(null);
  const [panels, setPanels] = useState<ComicPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/comic/${encodeURIComponent(id as string)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.comic) {
          setComic(data.comic);
          try {
            setPanels(JSON.parse(data.comic.imageUrls));
          } catch {
            setPanels([]);
          }
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

  return (
    <div className="flex min-h-screen">
      <SiteHeader />
      <main className="flex-1 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--gc-text)]">{comic.title}</h1>
              <p className="mt-1 text-xs text-[var(--gc-muted)]">
                基于《<Link href={`/novel/${comic.novel.id}`} className="underline hover:text-[var(--gc-accent)]">{comic.novel.title}</Link>》· {new Date(comic.createdAt).toLocaleDateString()}
              </p>
            </div>
            <ShareButton comicId={comic.id} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {panels.map((panel, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--gc-accent)] text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-[var(--gc-text)]">{panel.caption}</span>
                </div>
                {panel.imageUrl ? (
                  <div className="mb-3 overflow-hidden rounded-lg">
                    <img
                      src={panel.imageUrl}
                      alt={panel.caption}
                      className="h-auto w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="rounded-lg bg-[var(--gc-bg)] p-4">
                    <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--gc-muted)]">图像提示词</p>
                    <p className="text-xs italic text-[var(--gc-text-soft)]">{panel.prompt}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
