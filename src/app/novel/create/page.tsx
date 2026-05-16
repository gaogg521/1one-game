"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";

const EXAMPLES = [
  "一个平凡少年意外获得穿越时空的能力，在历史与未来之间寻找失落的记忆碎片",
  "末日废土世界里，最后一位花匠守护着地底温室，培育着能净化辐射的神秘植物",
  "赛博朋克都市中，一位退役黑客侦探追查一连串AI仿生人觉醒的离奇案件",
];

export default function NovelCreatePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError("");
    setProgress("正在构思大纲…");

    try {
      const res = await fetch("/api/novel/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), title: title.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "生成失败");
        setLoading(false);
        return;
      }
      setProgress("正在写入章节…");
      router.push(`/novel/${data.novel.id}`);
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <SiteHeader />
      <main className="flex-1 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--gc-text)]">创作小说</h1>
            <p className="mt-1 text-sm text-[var(--gc-muted)]">
              一句话创意，AI 为你写出一篇超过 1 万字的长篇小说
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                标题（可选）
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="留空由 AI 自动提取"
                className="w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:var(--gc-accent)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                创意描述
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder="描述你想要的小说世界、角色、冲突或氛围…"
                className="w-full resize-none rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:var(--gc-accent)]"
                required
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {progress && !error && <p className="text-sm text-[var(--gc-accent)]">{progress}</p>}

            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="gc-theme-cta rounded-xl px-6 py-3 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "生成中…" : "开始创作"}
            </button>
          </form>

          <div className="mt-8">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
              灵感示例
            </p>
            <div className="flex flex-col gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setPrompt(ex)}
                  className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2 text-left text-xs text-[var(--gc-text-soft)] transition hover:border-[color:var(--gc-accent)]/40 hover:text-[var(--gc-text)]"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
