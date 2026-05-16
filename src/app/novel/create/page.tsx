"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import {
  type DraftState,
  loadDraft,
  clearDraft,
  markDraftGenerating,
} from "@/lib/draft-storage";
import { NOVEL_LENGTH_TIERS, type NovelLengthTier } from "@/lib/novel-length";
import { NOVEL_TITLE_MAX_LEN } from "@/lib/novel-display";

const EXAMPLES = [
  "一个平凡少年意外获得穿越时空的能力，在历史与未来之间寻找失落的记忆碎片",
  "末日废土世界里，最后一位花匠守护着地底温室，培育着能净化辐射的神秘植物",
  "赛博朋克都市中，一位退役黑客侦探追查一连串AI仿生人觉醒的离奇案件",
];

export default function NovelCreatePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [lengthTier, setLengthTier] = useState<NovelLengthTier>("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [streamPreview, setStreamPreview] = useState("");
  const [draft, setDraft] = useState<DraftState | null>(null);

  // 恢复草稿
  useEffect(() => {
    const d = loadDraft("novel");
    if (d && d.generating && !d.generatedId) {
      setDraft(d);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError("");
    setProgress("连接生成服务…");
    setStreamPreview("");

    // 保存草稿状态
    markDraftGenerating("novel", prompt.trim(), title.trim() || undefined);

    try {
      const res = await fetch("/api/novel/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          title: title.trim() || undefined,
          lengthTier,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error || `请求失败（${res.status}）`);
        setLoading(false);
        return;
      }

      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/event-stream") || !res.body) {
        setError("服务器未返回流式响应");
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuf = "";
      let totalChars = 0;
      let novelId: string | null = null;
      let streamError = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuf += decoder.decode(value, { stream: true });
        for (;;) {
          const sep = sseBuf.indexOf("\n\n");
          if (sep < 0) break;
          const rawBlock = sseBuf.slice(0, sep).trim();
          sseBuf = sseBuf.slice(sep + 2);
          const lines = rawBlock.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            type Ev = {
              step?: string;
              text?: string;
              message?: string;
              model?: string;
              novel?: { id?: string };
              length?: number;
              minChars?: number;
            };
            let ev: Ev;
            try {
              ev = JSON.parse(payload) as Ev;
            } catch {
              continue;
            }
            if (ev.step === "start") {
              setProgress(ev.message ?? "生成中…");
            }
            if (ev.step === "model_start" && ev.model) {
              setProgress(`正在连接模型 ${ev.model}（首字出现前可能需 30～90 秒）…`);
            }
            if (ev.step === "delta" && typeof ev.text === "string") {
              totalChars += ev.text.length;
              setStreamPreview((p) => p + ev.text);
              setProgress(`生成中… 已约 ${totalChars} 字`);
            }
            if (ev.step === "model_short" && ev.model) {
              setProgress(
                `模型 ${ev.model} 输出偏短（${ev.length ?? 0}/${ev.minChars ?? "?"}），尝试下一备用模型…`,
              );
            }
            if (ev.step === "model_error" && ev.model) {
              setProgress(`模型 ${ev.model} 出错：${ev.message ?? "未知错误"}，尝试备用…`);
            }
            if (ev.step === "done" && ev.novel?.id) {
              novelId = ev.novel.id;
              setProgress("正在跳转…");
            }
            if (ev.step === "error") {
              streamError = ev.message ?? "生成失败";
            }
          }
        }
      }

      if (novelId) {
        clearDraft("novel");
        setDraft(null);
        router.push(`/novel/${novelId}`);
      } else {
        setError(streamError || "生成未完成或未返回作品 ID");
      }
      setLoading(false);
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  function handleRestoreDraft() {
    if (draft) {
      setPrompt(draft.prompt);
      if (draft.title) setTitle(draft.title);
      setDraft(null);
    }
  }

  function handleDismissDraft() {
    clearDraft("novel");
    setDraft(null);
  }

  return (
    <div className="flex min-h-screen">
      <SiteHeader />
      <main className="flex-1 px-6 py-10 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--gc-text)]">创作小说</h1>
            <p className="mt-1 text-sm text-[var(--gc-muted)]">
              选择篇幅后，由 AI 生成带章节标题的多章正文；创作过程<strong>流式输出</strong>，阅读页支持目录跳转与护眼背景。
            </p>
          </div>

          {/* 草稿恢复提示 */}
          {draft && (
            <div className="mb-4 rounded-xl border border-[color:var(--gc-accent)]/30 bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--gc-text)]">
                    检测到未完成的创作草稿
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--gc-muted)]">
                    创意：{draft.prompt.slice(0, 60)}
                    {draft.prompt.length > 60 ? "…" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={handleRestoreDraft}
                    className="rounded-lg bg-[var(--gc-accent)] px-3 py-1.5 text-xs font-medium text-white hover:brightness-110"
                  >
                    恢复草稿
                  </button>
                  <button
                    onClick={handleDismissDraft}
                    className="rounded-lg border border-[color:var(--gc-border)] px-3 py-1.5 text-xs text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
                  >
                    忽略
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                书名（可选，最多 {NOVEL_TITLE_MAX_LEN} 字）
              </label>
              <input
                type="text"
                value={title}
                maxLength={NOVEL_TITLE_MAX_LEN}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="留空由 AI 自动提取短书名"
                className="w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:var(--gc-accent)]"
              />
              <p className="mt-1 text-xs text-[var(--gc-muted)]">
                {title.length}/{NOVEL_TITLE_MAX_LEN} 字
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                篇幅
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                {NOVEL_LENGTH_TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setLengthTier(tier.id)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      lengthTier === tier.id
                        ? "border-[color:var(--gc-accent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)]"
                        : "border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] hover:border-[color:var(--gc-accent)]/30"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-[var(--gc-text)]">{tier.label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--gc-muted)]">{tier.desc}</span>
                  </button>
                ))}
              </div>
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
            {loading && streamPreview && !error && (
              <div className="max-h-56 overflow-y-auto rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-3 text-xs leading-relaxed whitespace-pre-wrap text-[var(--gc-text-soft)]">
                {streamPreview}
              </div>
            )}

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
