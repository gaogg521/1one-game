"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

interface Novel {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  prompt: string;
  createdAt: string;
  comics: { id: string; title: string }[];
  shareCode: string | null;
}

function ShareButton({ novelId }: { novelId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      const res = await fetch(`/api/novel/${novelId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ensureShareCode: true }) });
      if (!res.ok) return;
      const data = (await res.json()) as { novel?: { shareCode?: string | null } };
      const code = data.novel?.shareCode;
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

export default function NovelDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatingComic, setGeneratingComic] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/novel/${encodeURIComponent(id as string)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.novel) setNovel(data.novel);
        else setError("小说不存在");
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));

    // Fire-and-forget read counter
    void fetch(`/api/novel/${encodeURIComponent(id as string)}/play`, { method: "POST" });
  }, [id]);

  async function handleGenerateComic() {
    if (!novel || generatingComic) return;
    setGeneratingComic(true);
    try {
      const res = await fetch("/api/comic/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novelId: novel.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "漫画生成失败");
        setGeneratingComic(false);
        return;
      }
      router.push(`/comic/${data.comic.id}`);
    } catch {
      setError("网络错误");
      setGeneratingComic(false);
    }
  }

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

  if (error || !novel) {
    return (
      <div className="flex min-h-screen">
        <SiteHeader />
        <main className="flex-1 px-6 py-10 lg:px-10">
          <p className="text-red-400">{error || "未找到"}</p>
        </main>
      </div>
    );
  }

  // 将章节按分隔符拆分
  const chapters = novel.content.split(/===\s*第(\d+)章\s+(.+?)\s*===/);
  const parsedChapters: { num: string; title: string; body: string }[] = [];
  for (let i = 1; i < chapters.length; i += 3) {
    parsedChapters.push({
      num: chapters[i] || String(Math.floor(i / 3) + 1),
      title: chapters[i + 1] || "",
      body: chapters[i + 2] || "",
    });
  }

  return (
    <div className="flex min-h-screen">
      <SiteHeader />
      <main className="flex-1 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--gc-text)]">{novel.title}</h1>
              <p className="mt-1 text-xs text-[var(--gc-muted)]">
                {new Date(novel.createdAt).toLocaleDateString()} · 共 {parsedChapters.length} 章
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {novel.comics.length > 0 ? (
                <Link
                  href={`/comic/${novel.comics[0].id}`}
                  className="rounded-lg border border-[color:var(--gc-accent)]/40 px-3 py-2 text-xs font-medium text-[var(--gc-accent)] transition hover:bg-[color:var(--gc-accent)]/10"
                >
                  查看漫画版
                </Link>
              ) : (
                <button
                  onClick={handleGenerateComic}
                  disabled={generatingComic}
                  className="rounded-lg border border-[color:var(--gc-accent)]/40 px-3 py-2 text-xs font-medium text-[var(--gc-accent)] transition hover:bg-[color:var(--gc-accent)]/10 disabled:opacity-50"
                >
                  {generatingComic ? "生成漫画中…" : "生成漫画"}
                </button>
              )}
              <ShareButton novelId={novel.id} />
            </div>
          </div>

          {novel.summary && (
            <div className="mb-6 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">摘要</p>
              <p className="mt-1 text-sm text-[var(--gc-text-soft)]">{novel.summary}</p>
            </div>
          )}

          <div className="flex flex-col gap-8">
            {parsedChapters.map((ch) => (
              <section key={ch.num} className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-6">
                <h2 className="mb-4 text-lg font-bold text-[var(--gc-text)]">
                  第{ch.num}章 {ch.title}
                </h2>
                <div className="space-y-4 text-sm leading-relaxed text-[var(--gc-text)] whitespace-pre-wrap">
                  {ch.body.split("\n\n").map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {parsedChapters.length === 0 && (
            <div className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-6">
              <pre className="whitespace-pre-wrap text-sm text-[var(--gc-text)]">{novel.content}</pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
