"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";

export default function ComicCreatePage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || loading) return;
    setLoading(true);
    setError("");
    setProgress("正在解析文本并提取漫画场景…");

    try {
      const res = await fetch("/api/comic/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), title: title.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "生成失败");
        setLoading(false);
        return;
      }
      setProgress("正在渲染分镜…");
      router.push(`/comic/${data.comic.id}`);
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
            <h1 className="text-2xl font-bold text-[var(--gc-text)]">创作漫画</h1>
            <p className="mt-1 text-sm text-[var(--gc-muted)]">
              粘贴你的小说或故事文本，AI 自动解析并生成 4 格漫画
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
                placeholder="留空从正文第一行自动提取"
                className="w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:var(--gc-accent)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                小说 / 故事文本
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder="在这里粘贴你的小说、故事或任何叙事文本…\n支持长文本，AI 会自动解析情节、角色和关键场景。"
                className="w-full resize-none rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:var(--gc-accent)]"
                required
              />
              <p className="mt-1 text-xs text-[var(--gc-muted)]">
                已输入 {content.length} 字符
              </p>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {progress && !error && <p className="text-sm text-[var(--gc-accent)]">{progress}</p>}

            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="gc-theme-cta rounded-xl px-6 py-3 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "AI 解析生成中…" : "生成漫画"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
