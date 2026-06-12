"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
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
import { NovelLengthTierPicker } from "@/components/novel/NovelLengthTierPicker";
import type { NovelLengthTier } from "@/lib/novel-length";
import {
  ComicGenerateOptions,
  defaultComicGenerateOptions,
} from "@/components/comic/ComicGenerateOptions";
import { useQuotaExceededModal } from "@/components/commerce/QuotaExceededModal";
import { GenerationStage, useComicGenerationStages } from "@/components/generation/GenerationStage";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export default function ComicCreatePage() {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("comicCreatePage");
  const comicGenerationStages = useComicGenerationStages();
  const [content, setContent] = useState("");
  const [creativePrompt, setCreativePrompt] = useState("");
  const [title, setTitle] = useState("");
  const [creativeBrief, setCreativeBrief] = useState<NovelCreativeBrief | null>(null);
  const [creativeBriefSummary, setCreativeBriefSummary] = useState<string | null>(null);
  const [briefRevision, setBriefRevision] = useState<NovelBriefUserRevision | null>(null);
  const [briefPreviewBusy, setBriefPreviewBusy] = useState(false);
  const [lengthTier, setLengthTier] = useState<NovelLengthTier>("medium");
  const [genOpts, setGenOpts] = useState(defaultComicGenerateOptions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [activeGenerationStage, setActiveGenerationStage] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(() => {
    const d = loadDraft("comic");
    return d && d.generating && !d.generatedId ? d : null;
  });
  const { showQuotaExceeded, QuotaModal } = useQuotaExceededModal();

  const prefillApplied = useRef(false);
  useEffect(() => {
    if (prefillApplied.current || typeof window === "undefined") return;
    const prefill = new URLSearchParams(window.location.search).get("prefill")?.trim();
    if (!prefill) return;
    prefillApplied.current = true;
    queueMicrotask(() => {
      setCreativePrompt(prefill);
      if (prefill.length >= 400) setContent(prefill);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const bodyText = content.trim() || creativePrompt.trim();
    if (!bodyText || loading) return;
    setLoading(true);
    setError("");
    setProgress(t("connectService"));
    setActiveGenerationStage(null);
    setCreativeBrief(null);
    setCreativeBriefSummary(null);
    setBriefRevision(null);

    // 保存草稿状态
    markDraftGenerating("comic", bodyText, title.trim() || undefined);

    try {
      const result = await consumeComicGenerateStream(
        {
          content: bodyText,
          creativePrompt:
            creativePrompt.trim() && creativePrompt.trim() !== bodyText
              ? creativePrompt.trim()
              : undefined,
          title: title.trim() || undefined,
          lengthTier,
          stylePreset: genOpts.stylePreset,
          readMode: genOpts.readMode,
          chapterScope: genOpts.chapterScope,
          ...(genOpts.characterRoster ? { characterRoster: genOpts.characterRoster } : {}),
          ...(creativeBrief ? { creativeBrief } : {}),
          ...(briefRevision ? { briefRevision } : {}),
        },
        (ev) => {
          if (ev.step === "creative_expand" && ev.message) {
            setActiveGenerationStage("cast");
            setProgress(ev.message);
            return;
          }
          if (ev.step === "brief") {
            const data = ev as { summary?: string; brief?: unknown };
            if (typeof data.summary === "string") setCreativeBriefSummary(data.summary);
            const briefOk = NOVEL_CREATIVE_BRIEF_SCHEMA.safeParse(data.brief);
            if (briefOk.success) setCreativeBrief(briefOk.data);
            setActiveGenerationStage("cast");
            setProgress(t("briefReady"));
            return;
          }
          if (
            ev.step === "start" ||
            ev.step === "director_start" ||
            ev.step === "director_ready" ||
            ev.step === "roster_start" ||
            ev.step === "roster_done" ||
            ev.step === "preread_start" ||
            ev.step === "preread_done" ||
            ev.step === "consistency_start" ||
            ev.step === "char_sheets_start" ||
            ev.step === "char_sheets_done"
          ) {
            setActiveGenerationStage("cast");
          } else if (
            ev.step === "storyboard_chunk_start" ||
            ev.step === "storyboard_chunk_done" ||
            ev.step === "resume_storyboard" ||
            ev.step === "light_chunk_start" ||
            ev.step === "light_chunk_done" ||
            ev.step === "shot_plan_start" ||
            ev.step === "shot_plan_done"
          ) {
            setActiveGenerationStage("storyboard");
          } else if (ev.step === "panels_render_start" || ev.step === "panels_render_progress") {
            setActiveGenerationStage("panels");
          } else if (ev.step === "save_start" || ev.step === "cover_start" || ev.step === "done") {
            setActiveGenerationStage("done");
          }
          if (ev.message) setProgress(ev.message);
        },
        locale,
      );
      if (!result.ok) {
        if (result.code === "QUOTA_EXCEEDED") {
          showQuotaExceeded({
            error: result.error,
            code: result.code,
            needed: result.needed,
            available: result.available,
          });
          return;
        }
        setError(result.error);
        return;
      }
      clearDraft("comic");
      setDraft(null);
      router.push(
        result.needsPanelRender
          ? `${withLocalePath(`/comic/${result.comicId}`, locale)}?renderPanels=1`
          : withLocalePath(`/comic/${result.comicId}`, locale),
      );
    } catch {
      setError(t("networkError"));
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
      const r = await fetchCreativeBriefPreview(pitch, "comic", { uiLocale: locale });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.kind === "novel") {
        setCreativeBrief(r.brief);
        setCreativeBriefSummary(r.oneLineSummary);
      }
    } finally {
      setBriefPreviewBusy(false);
    }
  }

  return (
    <AppPageShell className="text-[var(--gc-text)]">
      <SiteHeader />
      <AppMain>
      <main className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--gc-text)]">{t("title")}</h1>
            <p className="mt-1 text-sm text-[var(--gc-muted)]">{t("desc")}</p>
          </div>

          {/* 草稿恢复提示 */}
          {draft && (
            <div className="mb-4 rounded-xl border border-[color:var(--gc-accent)]/30 bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--gc-text)]">
                    {t("draftDetected")}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--gc-muted)]">
                    {t("draftContent")}
                    {draft.prompt.slice(0, 60)}
                    {draft.prompt.length > 60 ? "…" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={handleRestoreDraft}
                    className="rounded-lg bg-[var(--gc-accent)] px-3 py-1.5 text-xs font-medium text-white hover:brightness-110"
                  >
                    {t("restoreDraft")}
                  </button>
                  <button
                    onClick={handleDismissDraft}
                    className="rounded-lg border border-[color:var(--gc-border)] px-3 py-1.5 text-xs text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
                  >
                    {t("dismiss")}
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                {t("lengthLabel")}
              </label>
              <NovelLengthTierPicker value={lengthTier} onChange={setLengthTier} />
            </div>

            <ComicGenerateOptions
              novelContent={content}
              value={genOpts}
              onChange={setGenOpts}
            />

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                {t("titleLabel")}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("titlePlaceholder")}
                className="w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:var(--gc-accent)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                {t("ideaLabel")}
              </label>
              <input
                type="text"
                value={creativePrompt}
                onChange={(e) => setCreativePrompt(e.target.value)}
                placeholder={t("ideaPlaceholder")}
                className="w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:var(--gc-accent)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                {t("contentLabel")}
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder={t("contentPlaceholder")}
                className="w-full resize-none rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:var(--gc-accent)]"
              />
              <p className="mt-1 text-xs text-[var(--gc-muted)]">
                {t("charsEntered", { count: content.length })}
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
                {briefPreviewBusy ? t("previewingBrief") : t("previewBrief")}
              </button>
            </div>

            {loading ? (
              <GenerationStage
                title={t("generatingTitle")}
                stages={comicGenerationStages.map((s) => ({
                  ...s,
                  active: s.key === activeGenerationStage,
                }))}
                detail={progress || t("generatingDetail")}
              />
            ) : null}
            {error && <p className="text-sm text-red-400">{error}</p>}
            {progress && !error && !loading && (
              <p className="text-sm text-[var(--gc-accent)]">{progress}</p>
            )}

            <button
              type="submit"
              disabled={loading || !(content.trim() || creativePrompt.trim())}
              className="gc-theme-cta rounded-xl px-6 py-3 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? t("generatingStoryboard") : t("generateStoryboard")}
            </button>
          </form>
        </div>
      </main>
      {QuotaModal}
      </AppMain>
    </AppPageShell>
  );
}
