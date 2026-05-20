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
import { NovelCreativeBriefPanel } from "@/components/novel/NovelCreativeBriefPanel";
import { fetchCreativeBriefPreview } from "@/lib/creative-brief/preview-client";
import { extractComicCreativePitch } from "@/lib/creative-brief/resolve-media-brief";
import { consumeComicGenerateStream } from "@/lib/comic-generate-stream.client";
import {
  NOVEL_CREATIVE_BRIEF_SCHEMA,
  type NovelBriefUserRevision,
  type NovelCreativeBrief,
} from "@/lib/literary-brief";
import { NOVEL_LENGTH_TIERS, type NovelLengthTier } from "@/lib/novel-length";

export default function ComicCreatePage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [creativePrompt, setCreativePrompt] = useState("");
  const [title, setTitle] = useState("");
  const [creativeBrief, setCreativeBrief] = useState<NovelCreativeBrief | null>(null);
  const [creativeBriefSummary, setCreativeBriefSummary] = useState<string | null>(null);
  const [briefRevision, setBriefRevision] = useState<NovelBriefUserRevision | null>(null);
  const [briefPreviewBusy, setBriefPreviewBusy] = useState(false);
  const [lengthTier, setLengthTier] = useState<NovelLengthTier>("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [draft, setDraft] = useState<DraftState | null>(null);

  // 恢复草稿
  useEffect(() => {
    const d = loadDraft("comic");
    if (d && d.generating && !d.generatedId) {
      setDraft(d);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || loading) return;
    setLoading(true);
    setError("");
    setProgress("连接漫画生成服务…");
    setCreativeBrief(null);
    setCreativeBriefSummary(null);
    setBriefRevision(null);

    // 保存草稿状态
    markDraftGenerating("comic", content.trim(), title.trim() || undefined);

    try {
      const result = await consumeComicGenerateStream(
        {
          content: content.trim(),
          creativePrompt: creativePrompt.trim() || undefined,
          title: title.trim() || undefined,
          lengthTier,
          ...(creativeBrief ? { creativeBrief } : {}),
          ...(briefRevision ? { briefRevision } : {}),
        },
        (ev) => {
          if (ev.step === "brief") {
            const data = ev as { summary?: string; brief?: unknown };
            if (typeof data.summary === "string") setCreativeBriefSummary(data.summary);
            const briefOk = NOVEL_CREATIVE_BRIEF_SCHEMA.safeParse(data.brief);
            if (briefOk.success) setCreativeBrief(briefOk.data);
            setProgress("AI 已扩写漫画改编理解，开始分镜…");
            return;
          }
          if (ev.message) setProgress(ev.message);
        },
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      clearDraft("comic");
      setDraft(null);
      router.push(
        result.needsPanelRender
          ? `/comic/${result.comicId}?renderPanels=1`
          : `/comic/${result.comicId}`,
      );
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  function handleRestoreDraft() {
    if (draft) {
      setContent(draft.prompt);
      if (draft.title) setTitle(draft.title);
      setDraft(null);
    }
  }

  function handleDismissDraft() {
    clearDraft("comic");
    setDraft(null);
  }

  function comicPitch(): string {
    return extractComicCreativePitch(content, creativePrompt);
  }

  async function handlePreviewBrief() {
    const pitch = comicPitch();
    if (pitch.length < 2 || briefPreviewBusy) return;
    setError("");
    setBriefPreviewBusy(true);
    try {
      const r = await fetchCreativeBriefPreview(pitch, "comic");
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCreativeBrief(r.brief);
      setCreativeBriefSummary(r.oneLineSummary);
    } finally {
      setBriefPreviewBusy(false);
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
              可粘贴全文，或只写一句话创意；系统会先 <strong>AI 深度扩写</strong> 改编 Brief，再导演包 → 分镜 → 配图（每页 4 格）
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
                    内容：{draft.prompt.slice(0, 60)}
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
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                篇幅（决定漫画页数）
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
                一句话创意（可选；粘贴长文时可单独写改编方向）
              </label>
              <input
                type="text"
                value={creativePrompt}
                onChange={(e) => setCreativePrompt(e.target.value)}
                placeholder="例：赛博朋克都市里退役黑客追查 AI 觉醒案…"
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

            {(creativeBrief || creativeBriefSummary) ? (
              <NovelCreativeBriefPanel
                brief={creativeBrief}
                summary={creativeBriefSummary}
                onRevisionChange={setBriefRevision}
                onRegenerateWithRevision={() => void handlePreviewBrief()}
                regenerateDisabled={loading || briefPreviewBusy}
              />
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading || briefPreviewBusy || comicPitch().length < 2}
                onClick={() => void handlePreviewBrief()}
                className="rounded-xl border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-text-soft)] hover:border-[color:var(--gc-accent)]/40 disabled:opacity-50"
              >
                {briefPreviewBusy ? "扩写预览中…" : "预览改编 Brief"}
              </button>
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
