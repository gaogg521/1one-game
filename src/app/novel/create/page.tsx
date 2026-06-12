"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { ChildrenAgePicker } from "@/components/novel/ChildrenAgePicker";
import { ChildrenCreativeBriefPanel } from "@/components/novel/ChildrenCreativeBriefPanel";
import { NovelCreativeBriefPanel } from "@/components/novel/NovelCreativeBriefPanel";
import { NovelGenreTagPicker } from "@/components/novel/NovelGenreTagPicker";
import { CHILDREN_ADDON_NOTES_PLACEHOLDER } from "@/lib/children-novel-creative";
import {
  getChildrenAgeTier,
  DEFAULT_CHILDREN_TARGET_AGE,
  type ChildrenTargetAge,
} from "@/lib/children-age-length";
import {
  localizedChildrenAgeLabel,
  localizedChildrenCharRangeLabel,
  localizedChildrenFeaturesLabel,
  localizedChildrenStageLabel,
} from "@/lib/i18n/localized-data";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import {
  type DraftState,
  loadDraft,
  clearDraft,
  markDraftGenerating,
} from "@/lib/draft-storage";
import {
  NOVEL_LENGTH_TIERS_FOR_UI,
  novelGenerationEtaHint,
  novelLengthConfig,
  novelMaxChars,
  novelStreamInterruptHint,
  resolveNovelLengthTier,
  type NovelLengthTier,
} from "@/lib/novel-length";
import {
  displayNovelSummary,
  measureNovelTitleUnits,
  NOVEL_TITLE_MAX_LEN,
  normalizeNovelTitle,
  validateNovelTitleInput,
  formatNovelTitleValidationError,
} from "@/lib/novel-display";
import { fetchCreativeBriefPreview } from "@/lib/creative-brief/preview-client";
import {
  detectBriefInputLocale,
  type BriefInputLocale,
} from "@/lib/creative-brief/detect-input-locale";
import type { AppLocale } from "@/i18n/routing";
import {
  type ChildrenBriefUserRevision,
  type ChildrenCreativeBrief,
  type NovelBriefUserRevision,
  type NovelCreativeBrief,
} from "@/lib/literary-brief";
import { buildChildrenBriefSeed } from "@/lib/literary-brief/children-brief-types";
import {
  buildNovelBriefSeed,
  buildNovelStoredPrompt,
  getLocalizedNovelGenreTag,
  getNovelGenreTag,
  inferNovelGenreTagFromText,
  isChildrenGenreTag,
  type NovelGenreTagId,
} from "@/lib/novel-genre-tags";
import { PRODUCT } from "@/lib/product-config";
import { useQuotaExceededModal } from "@/components/commerce/QuotaExceededModal";
import { parseQuotaExceeded } from "@/lib/commerce/quota-error";
import { NovelResumeBanner } from "@/components/novel/NovelResumeBanner";
import { GenerationStage, useNovelGenerationStages } from "@/components/generation/GenerationStage";
import { withLocalePath } from "@/i18n/navigation";
import { publishVisibilityMessage } from "@/lib/work-status";

function resolveBriefInputLocale(uiLocale: AppLocale, userText: string): BriefInputLocale {
  const fromText = detectBriefInputLocale(userText);
  if (fromText === "en" || fromText === "ja" || fromText === "ms" || fromText === "th") return fromText;
  if (uiLocale === "zh-Hant") return "zh-Hant";
  if (uiLocale === "en") return "en";
  if (uiLocale === "ms") return "ms";
  if (uiLocale === "th") return "th";
  return fromText;
}

const STEP_KEYS = [1, 2, 3, 4] as const;

type NovelCreateStep = (typeof STEP_KEYS)[number];

export default function NovelCreatePage() {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("novelCreatePage");
  const tn = useTranslations("novelCreate");
  const tc = useTranslations("common");
  const stepLabels = t.raw("steps") as string[];
  const steps = STEP_KEYS.map((n, index) => ({ n, label: stepLabels[index] ?? "" }));
  const novelGenerationStages = useNovelGenerationStages();
  const [step, setStep] = useState<NovelCreateStep>(1);
  const [title, setTitle] = useState("");
  const [genreId, setGenreId] = useState<NovelGenreTagId | null>(null);
  const [addonNotes, setAddonNotes] = useState("");
  const [lengthTier, setLengthTier] = useState<NovelLengthTier>("medium");
  const [childrenTargetAge, setChildrenTargetAge] = useState<ChildrenTargetAge>(
    DEFAULT_CHILDREN_TARGET_AGE,
  );
  const [longPolish, setLongPolish] = useState<boolean>(PRODUCT.novel.longSegmented.polishAfterSegment);

  const [childrenCreativeBrief, setChildrenCreativeBrief] =
    useState<ChildrenCreativeBrief | null>(null);
  const [novelCreativeBrief, setNovelCreativeBrief] = useState<NovelCreativeBrief | null>(null);
  const [creativeBriefSummary, setCreativeBriefSummary] = useState<string | null>(null);
  const [childrenBriefRevision, setChildrenBriefRevision] =
    useState<ChildrenBriefUserRevision | null>(null);
  const [novelBriefRevision, setNovelBriefRevision] = useState<NovelBriefUserRevision | null>(null);
  const [briefConfirmed, setBriefConfirmed] = useState(false);
  const [briefPreviewBusy, setBriefPreviewBusy] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [activeGenerationStage, setActiveGenerationStage] = useState<string | null>(null);
  const [streamPreview, setStreamPreview] = useState("");
  const [draft, setDraft] = useState<DraftState | null>(() => {
    const d = loadDraft("novel");
    return d && d.generating && !d.generatedId ? d : null;
  });
  const [generatingDrafts, setGeneratingDrafts] = useState<
    Array<{
      id: string;
      title: string;
      contentLength: number;
      completedSegments: number;
      totalSegments: number | null;
      updatedAt: string;
    }>
  >([]);

  const [publishedNovelId, setPublishedNovelId] = useState<string | null>(null);
  const [publishedNovel, setPublishedNovel] = useState<{
    id: string;
    title: string;
    summary: string | null;
    prompt: string;
    content: string;
    coverPath: string | null;
    shareCode: string | null;
    visibility?: string | null;
  } | null>(null);
  const { showQuotaExceeded, QuotaModal } = useQuotaExceededModal();
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverRegenerating, setCoverRegenerating] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  /** 防浏览器缓存旧封面图（重做后 URL 不变时仍刷新） */
  const [coverImageKey, setCoverImageKey] = useState(0);
  const coverRequested = useRef(false);

  const genre = genreId ? getNovelGenreTag(genreId) : null;
  const isChildrenGenre = isChildrenGenreTag(genreId);
  const effectiveLengthTier = resolveNovelLengthTier({
    genreTagId: genreId,
    lengthTierPick: lengthTier,
  });
  const childrenLengthOpts = isChildrenGenre ? { childrenTargetAge } : undefined;
  const childrenTier = getChildrenAgeTier(childrenTargetAge);

  function handleGenreChange(id: NovelGenreTagId) {
    setGenreId(id);
    if (isChildrenGenreTag(id)) {
      setLengthTier("children");
      setNovelCreativeBrief(null);
      setNovelBriefRevision(null);
    } else {
      if (lengthTier === "children") setLengthTier("short");
      setChildrenCreativeBrief(null);
      setChildrenBriefRevision(null);
    }
  }

  useEffect(() => {
    void fetch("/api/novel/generating-drafts")
      .then((r) => r.json())
      .then((data: { drafts?: typeof generatingDrafts }) => setGeneratingDrafts(data.drafts ?? []));
  }, []);

  const prefillApplied = useRef(false);
  useEffect(() => {
    if (prefillApplied.current || typeof window === "undefined") return;
    const prefill = new URLSearchParams(window.location.search).get("prefill")?.trim();
    if (!prefill) return;
    prefillApplied.current = true;
    queueMicrotask(() => {
      setAddonNotes(prefill);
      setTitle((t) => (t.trim() ? t : prefill.slice(0, NOVEL_TITLE_MAX_LEN)));
      const inferred = inferNovelGenreTagFromText(prefill);
      if (inferred) setGenreId(inferred.id);
      setStep(inferred ? 2 : 1);
    });
  }, []);

  const expandBrief = useCallback(async () => {
    if (!title.trim() || !genre) return;
    setError("");
    setBriefPreviewBusy(true);
    setBriefConfirmed(false);
    try {
      const briefLocale = resolveBriefInputLocale(locale, `${title} ${addonNotes}`);
      const seed = isChildrenGenre
        ? buildChildrenBriefSeed(title, addonNotes || title, childrenTargetAge)
        : buildNovelBriefSeed(title, genre, addonNotes, undefined, briefLocale);
      const r = await fetchCreativeBriefPreview(seed, "novel", {
        novelGenreId: genre.id,
        title: title.trim(),
        childrenTargetAge: isChildrenGenre ? childrenTargetAge : undefined,
        inputLocale: briefLocale,
        uiLocale: locale,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.kind === "children") {
        setChildrenCreativeBrief(r.brief);
        setNovelCreativeBrief(null);
      } else {
        setNovelCreativeBrief(r.brief);
        setChildrenCreativeBrief(null);
      }
      setCreativeBriefSummary(r.oneLineSummary);
    } finally {
      setBriefPreviewBusy(false);
    }
  }, [title, genre, addonNotes, isChildrenGenre, childrenTargetAge]);

  useEffect(() => {
    const hasBrief = isChildrenGenre ? childrenCreativeBrief : novelCreativeBrief;
    if (step === 2 && title.trim() && genre && !hasBrief && !briefPreviewBusy) {
      queueMicrotask(() => {
        void expandBrief();
      });
    }
  }, [
    step,
    title,
    genre,
    isChildrenGenre,
    childrenCreativeBrief,
    novelCreativeBrief,
    briefPreviewBusy,
    expandBrief,
  ]);

  function goNext() {
    setError("");
    if (step === 1) {
      const tv = validateNovelTitleInput(title.trim());
      if (!tv.ok) {
        setError(formatNovelTitleValidationError(locale, tv.errorKey));
        return;
      }
      if (!genreId) {
        setError(t("chooseGenre"));
        return;
      }
      setTitle(tv.value);
      setChildrenCreativeBrief(null);
      setNovelCreativeBrief(null);
      setChildrenBriefRevision(null);
      setNovelBriefRevision(null);
      setCreativeBriefSummary(null);
      setBriefConfirmed(false);
      setStep(2);
      return;
    }
    if (step === 2) {
      const hasBrief = isChildrenGenre ? childrenCreativeBrief : novelCreativeBrief;
      if (!hasBrief) {
        setError(t("waitForBrief"));
        return;
      }
      setBriefConfirmed(true);
      setStep(3);
    }
  }

  function goBack() {
    setError("");
    if (step === 4) return;
    if (step === 3) {
      setStep(2);
      setBriefConfirmed(false);
      return;
    }
    if (step > 1) setStep((step - 1) as NovelCreateStep);
  }

  const requestCover = useCallback(async (novelId: string, force = false) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 180_000);
    let res: Response;
    try {
      res = await fetch(`/api/novel/${novelId}/cover${force ? "?force=1" : ""}`, {
        method: "POST",
        signal: controller.signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error(t("coverTimeout"));
      }
      throw e;
    } finally {
      window.clearTimeout(timer);
    }
    const data = (await res.json()) as { coverPath?: string; error?: string; novel?: { coverPath?: string } };
    if (!res.ok) throw new Error(data.error || t("coverFailed"));
    const path = data.coverPath ?? data.novel?.coverPath ?? null;
    if (path) {
      setPublishedNovel((prev) => (prev ? { ...prev, coverPath: path } : prev));
      setCoverImageKey((k) => k + 1);
    }
    return path;
  }, [t("coverFailed"), t("coverTimeout")]);

  useEffect(() => {
    if (step !== 4 || !publishedNovelId) return;
    let cancelled = false;

    async function loadPublishedNovel() {
      const id = publishedNovelId;
      if (!id) return;
      try {
        const res = await fetch(`/api/novel/${encodeURIComponent(id)}`);
        const data = (await res.json()) as {
          novel?: {
            id: string;
            title: string;
            summary: string | null;
            prompt: string;
            content: string;
            coverPath: string | null;
            shareCode: string | null;
          };
        };
        if (cancelled || !data.novel) return;
        setPublishedNovel(data.novel);
        if (data.novel.coverPath || coverRequested.current) return;
        coverRequested.current = true;
        setCoverBusy(true);
        setError("");
        try {
          await requestCover(publishedNovelId);
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : t("coverFailed"));
          }
        } finally {
          if (!cancelled) setCoverBusy(false);
        }
      } catch {
        if (!cancelled) setError(t("loadNovelFailed"));
      }
    }

    void loadPublishedNovel();
    return () => {
      cancelled = true;
    };
  }, [step, publishedNovelId, requestCover]);

  async function handleRegenerateCover() {
    if (!publishedNovelId || coverRegenerating) return;
    setCoverRegenerating(true);
    setError("");
    try {
      await requestCover(publishedNovelId, true);
      coverRequested.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t("coverFailed"));
    } finally {
      setCoverRegenerating(false);
    }
  }

  async function handleShareCopy() {
    if (!publishedNovelId) return;
    try {
      const res = await fetch(`/api/novel/${publishedNovelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensureShareCode: true }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { novel?: { shareCode?: string | null } };
      const code = data.novel?.shareCode;
      if (!code) return;
      const url = `${window.location.origin}${withLocalePath(`/s/${code}`, locale)}`;
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setPublishedNovel((prev) => (prev ? { ...prev, shareCode: code } : prev));
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setError(t("copyShareFailed"));
    }
  }

  async function runNovelGenerateStream(body: Record<string, unknown>) {
    setLoading(true);
    setError("");
    setProgress(t("connectService"));
    setStreamPreview("");
    setStep(3);

    try {
      const res = await fetch("/api/novel/generate/stream", {
        method: "POST",
        headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        const quota = parseQuotaExceeded(data, res.status);
        if (quota) {
          showQuotaExceeded(quota);
          setLoading(false);
          return;
        }
        setError(data.error || tc("requestFailed", { status: String(res.status) }));
        setLoading(false);
        return;
      }

      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/event-stream") || !res.body) {
        setError(t("streamRequired"));
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
          for (const line of rawBlock.split("\n")) {
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
              index?: number;
              total?: number;
              label?: string;
              target?: number;
            };
            let ev: Ev;
            try {
              ev = JSON.parse(payload) as Ev;
            } catch {
              continue;
            }
            if (ev.step === "ping") continue;
            if (ev.step === "start") {
              setActiveGenerationStage("brief");
              setProgress(ev.message ?? t("generating"));
            }
            if (ev.step === "bible_start" || ev.step === "outline_start") {
              setActiveGenerationStage("brief");
              setProgress(ev.message ?? t("bibleStart"));
            }
            if (ev.step === "bible_ready" || ev.step === "outline_ready") {
              setActiveGenerationStage("outline");
              setProgress(ev.message ?? t("bibleDone"));
            }
            if (ev.step === "chapter_plan_start") {
              setActiveGenerationStage("outline");
              setProgress(ev.message ?? t("chapterPlanStart"));
            }
            if (ev.step === "chapter_plan_ready") {
              setActiveGenerationStage("writing");
              setProgress(ev.message ?? t("chapterPlanReady"));
            }
            if (
              ev.step === "consistency_start" ||
              ev.step === "consistency_ok" ||
              ev.step === "consistency_warn" ||
              ev.step === "polish_start" ||
              ev.step === "polish_done" ||
              ev.step === "polish_batch_start" ||
              ev.step === "polish_batch_done" ||
              ev.step === "polish_skip"
            ) {
              setActiveGenerationStage("polish");
              if (ev.message) setProgress(ev.message);
            }
            if (ev.step === "segment_start") {
              setActiveGenerationStage("writing");
              setProgress(
                ev.message ??
                  t("longSegment", { index: String(ev.index ?? "?"), total: String(ev.total ?? "?"), label: String(ev.label ?? t("writing")) }),
              );
            }
            if (ev.step === "segment_done" && typeof ev.length === "number") {
              setActiveGenerationStage("writing");
              setProgress(
                t("segmentDone", { index: String(ev.index ?? "?"), total: String(ev.total ?? "?"), length: ev.length.toLocaleString() }),
              );
            }
            if (
              (ev.step === "checkpoint_novel" ||
                ev.step === "checkpoint_saved" ||
                ev.step === "resume_start" ||
                ev.step === "resume_ready") &&
              ev.message
            ) {
              setProgress(ev.message);
            }
            if (ev.step === "model_start" && ev.model) {
              setProgress(t("modelConnect", { model: ev.model }));
            }
            if (ev.step === "delta" && typeof ev.text === "string") {
              setActiveGenerationStage("writing");
              totalChars += ev.text.length;
              setStreamPreview((p) => p + ev.text);
              setProgress(
                t("generatingWords", { current: totalChars.toLocaleString(), target: novelMaxChars(effectiveLengthTier, childrenLengthOpts).toLocaleString() }),
              );
            }
            if (ev.step === "length_capped") setProgress(ev.message ?? t("maxLengthReached"));
            if (ev.step === "synopsis_start") setProgress(ev.message ?? t("synopsisStart"));
            if (ev.step === "model_short" && ev.model) {
              setProgress(t("modelShort", { model: ev.model }));
            }
            if (ev.step === "model_error" && ev.model) {
              setProgress(t("modelError", { model: ev.model }));
            }
            if (ev.step === "done" && ev.novel?.id) {
              novelId = ev.novel.id;
              setProgress(t("redirecting"));
            }
            if (ev.step === "error") streamError = ev.message ?? t("generateFailed");
          }
        }
      }

      if (novelId) {
        clearDraft("novel");
        setDraft(null);
        setPublishedNovelId(novelId);
        coverRequested.current = false;
        setPublishedNovel(null);
        setShareCopied(false);
        setStep(4);
        setProgress("");
      } else {
        setError(streamError || t("generateIncomplete"));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const timedOut = /abort|timeout|timed out|network|failed to fetch|incomplete/i.test(msg);
      setError(
        timedOut
          ? novelStreamInterruptHint(effectiveLengthTier, locale)
          : t("connectionError", { message: msg || "Please retry" }),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleStartWriting(e: React.FormEvent) {
    e.preventDefault();
    const activeBrief = isChildrenGenre ? childrenCreativeBrief : novelCreativeBrief;
    if (!title.trim() || !genre || !activeBrief || loading) return;

    const storedPrompt = buildNovelStoredPrompt(title, genre);
    markDraftGenerating("novel", storedPrompt, title.trim());
    await runNovelGenerateStream({
      prompt: storedPrompt,
      title: title.trim(),
      lengthTier: effectiveLengthTier,
      novelGenreTag: genreId,
      ...(isChildrenGenre ? { childrenTargetAge } : {}),
      ...(effectiveLengthTier === "long" ? { polish: longPolish } : {}),
      creativeBrief: activeBrief,
      ...(isChildrenGenre
        ? childrenBriefRevision
          ? { briefRevision: childrenBriefRevision }
          : {}
        : novelBriefRevision
          ? { briefRevision: novelBriefRevision }
          : {}),
    });
  }

  const handleResumeDraft = useCallback(async (draftId: string) => {
    if (loading) return;
    await runNovelGenerateStream({ resumeNovelId: draftId });
  }, [loading, runNovelGenerateStream]);

  const resumeApplied = useRef(false);
  useEffect(() => {
    if (resumeApplied.current || typeof window === "undefined") return;
    const resumeId = new URLSearchParams(window.location.search).get("resumeNovelId")?.trim();
    if (!resumeId) return;
    resumeApplied.current = true;
    queueMicrotask(() => {
      void handleResumeDraft(resumeId);
    });
  }, [handleResumeDraft]);

  return (
    <AppPageShell className="text-[var(--gc-text)]">
      <SiteHeader />
      <AppMain>
      <main className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--gc-text)]">{t("pageTitle")}</h1>
            <p className="mt-1 text-sm text-[var(--gc-muted)]">
              {t("pageDesc")}
            </p>
          </div>

          <ol className="mb-6 flex flex-wrap gap-2">
            {steps.map((s) => {
              const active = step === s.n;
              const done = step > s.n;
              return (
                <li
                  key={s.n}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    active
                      ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_22%,transparent)] text-[var(--gc-text)]"
                      : done
                        ? "bg-[var(--gc-surface-glass)] text-[var(--gc-muted)]"
                        : "border border-[color:var(--gc-border)] text-[var(--gc-text-faint)]"
                  }`}
                >
                  {s.n}. {s.label}
                </li>
              );
            })}
          </ol>

          {generatingDrafts.length > 0 && !loading ? (
            <div className="mb-4 space-y-2">
              {generatingDrafts.map((d) => (
                <NovelResumeBanner key={d.id} novelId={d.id} title={d.title} />
              ))}
            </div>
          ) : null}

          {draft && step === 1 ? (
            <div className="mb-4 rounded-xl border border-[color:var(--gc-accent)]/30 bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)] p-4 text-sm">
              <p className="font-medium text-[var(--gc-text)]">{t("browserDraft")}</p>
              <button
                type="button"
                onClick={() => {
                  clearDraft("novel");
                  setDraft(null);
                }}
                className="mt-2 text-xs text-[var(--gc-muted)] underline"
              >
                {t("dismiss")}
              </button>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-5 rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]/60 p-5 sm:p-6">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                  {t("titleLabel")}
                </label>
                <input
                  data-testid="novel-title-input"
                  type="text"
                  value={title}
                  maxLength={Math.max(48, NOVEL_TITLE_MAX_LEN * 4)}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("titlePlaceholder")}
                  className="w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg)]/80 px-4 py-3 text-base text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:var(--gc-accent)]"
                  autoFocus
                />
                <p className="mt-1 text-xs text-[var(--gc-muted)]">
                  {measureNovelTitleUnits(title).toFixed(
                    Number.isInteger(measureNovelTitleUnits(title)) ? 0 : 1,
                  )}
                  /{NOVEL_TITLE_MAX_LEN} {tc("charactersUnit")}
                </p>
              </div>

              <div className="border-t border-[color:var(--gc-border)] pt-5">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                  {tn("genreLabel")}
                </label>
                <NovelGenreTagPicker value={genreId} onChange={handleGenreChange} locale={locale} />
                {genre ? (
                  <p className="mt-2 text-xs leading-relaxed text-[var(--gc-text-faint)]">
                    {getLocalizedNovelGenreTag(genre, locale).label}：{getLocalizedNovelGenreTag(genre, locale).desc}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-[var(--gc-text-faint)]">
                    {t("selectedGenreHint")}
                  </p>
                )}
              </div>

              {isChildrenGenre ? (
                <div className="border-t border-[color:var(--gc-border)] pt-5">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                    {t("ageLabel")}
                  </label>
                  <p className="mb-2 text-xs text-[var(--gc-text-faint)]">
                    {t("ageDesc")}
                  </p>
                  <ChildrenAgePicker
                    value={childrenTargetAge}
                    onChange={setChildrenTargetAge}
                    disabled={loading}
                  />
                  <p className="mt-2 text-[10px] text-[var(--gc-muted)]">
                    {t("etaPrefix")} {novelGenerationEtaHint("children", locale)} · {tn("childrenBodyMeta", {
                      range: childrenTier.charRangeLabel,
                      target: childrenTier.targetChars,
                    })}
                  </p>
                </div>
              ) : (
                <div className="border-t border-[color:var(--gc-border)] pt-5">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                    {t("lengthLabel")}
                  </label>
                  <p className="mb-2 text-xs text-[var(--gc-text-faint)]">
                    {t("lengthDesc")}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {NOVEL_LENGTH_TIERS_FOR_UI.map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setLengthTier(tier.id)}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${
                          lengthTier === tier.id
                            ? "border-[color:var(--gc-accent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)]"
                            : "border-[color:var(--gc-border)] bg-[var(--gc-bg)]/50 hover:border-[color:var(--gc-accent)]/30"
                        }`}
                      >
                        <span className="block text-sm font-semibold">
                          {tier.id === "short"
                            ? tn("lengthShort")
                            : tier.id === "medium"
                              ? tn("lengthMedium")
                              : tn("lengthLong")}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-[var(--gc-muted)]">
                          {tier.id === "short"
                            ? tn("lengthShortDesc")
                            : tier.id === "medium"
                              ? tn("lengthMediumDesc")
                              : tn("lengthLongDesc")}
                        </span>
                        {lengthTier === tier.id ? (
                          <span className="mt-1 block text-[10px] text-[var(--gc-accent)]">
                            {t("etaPrefix")} {novelGenerationEtaHint(tier.id, locale)}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <button
                type="button"
                onClick={goNext}
                disabled={!title.trim() || !genreId}
                className="gc-theme-cta w-full rounded-xl px-6 py-3 text-sm font-semibold disabled:opacity-50 sm:w-auto"
              >
                {t("nextToBrief")}
              </button>
            </div>
          ) : null}

          {step === 2 && genre ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-[var(--gc-text-soft)]">
                《{title}》· <span className="text-[var(--gc-accent)]">{genre.label}</span>
                <span className="text-[var(--gc-muted)]">
                  {" "}
                  {isChildrenGenre ? (
                    <span className="text-[var(--gc-muted)]">
                      {" "}
                      · {tn("bodyText")} {localizedChildrenCharRangeLabel(childrenTargetAge, locale)}
                    </span>
                  ) : (
                    <span className="text-[var(--gc-muted)]">
                      {" "}
                      ·{" "}
                      {effectiveLengthTier === "short"
                        ? tn("lengthShort")
                        : effectiveLengthTier === "medium"
                          ? tn("lengthMedium")
                          : tn("lengthLong")}
                    </span>
                  )}
                </span>
                {briefPreviewBusy ? ` — ${t("regenerateBrief")}` : ""}
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--gc-muted)]">
                  {t("addonLabel")}
                </label>
                <textarea
                  value={addonNotes}
                  onChange={(e) => setAddonNotes(e.target.value)}
                  rows={2}
                  placeholder={
                    isChildrenGenre
                      ? CHILDREN_ADDON_NOTES_PLACEHOLDER
                      : t("addonPlaceholder")
                  }
                  className="w-full resize-none rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2 text-sm text-[var(--gc-text)]"
                />
              </div>
              {(childrenCreativeBrief || novelCreativeBrief || creativeBriefSummary) ? (
                isChildrenGenre ? (
                  <ChildrenCreativeBriefPanel
                    brief={childrenCreativeBrief}
                    summary={creativeBriefSummary}
                    onRevisionChange={setChildrenBriefRevision}
                    onRegenerateWithRevision={() => void expandBrief()}
                    regenerateDisabled={briefPreviewBusy || loading}
                  />
                ) : (
                  <NovelCreativeBriefPanel
                    brief={novelCreativeBrief}
                    summary={creativeBriefSummary}
                    onRevisionChange={setNovelBriefRevision}
                    onRegenerateWithRevision={() => void expandBrief()}
                    regenerateDisabled={briefPreviewBusy || loading}
                  />
                )
              ) : briefPreviewBusy ? (
                <p className="text-sm text-[var(--gc-accent)]">
                  {isChildrenGenre
                    ? t("briefBusyChildren")
                    : t("briefBusyNovel")}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={goBack} className="rounded-xl border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-muted)]">
                  {t("prevStep")}
                </button>
                <button
                  type="button"
                  disabled={briefPreviewBusy}
                  onClick={() => void expandBrief()}
                  className="rounded-xl border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-text-soft)] disabled:opacity-50"
                >
                  {t("regenerateBrief")}
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={
                    !(isChildrenGenre ? childrenCreativeBrief : novelCreativeBrief) || briefPreviewBusy
                  }
                  className="gc-theme-cta rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {t("confirmBrief")}
                </button>
              </div>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
            </div>
          ) : null}

          {step === 3 && genre ? (
            <form onSubmit={handleStartWriting} className="flex flex-col gap-4">
              <div className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4 text-sm">
                <p className="font-medium text-[var(--gc-text)]">《{title}》· {genre.label}</p>
                {creativeBriefSummary ? (
                  <p className="mt-2 text-xs leading-relaxed text-[var(--gc-muted)]">{creativeBriefSummary}</p>
                ) : null}
                {briefConfirmed ? (
                  <p className="mt-2 text-[10px] text-[color:color-mix(in_srgb,var(--gc-accent)_80%,white)]">
                    {isChildrenGenre
                      ? t("briefConfirmedChildren")
                      : t("briefConfirmedNovel")}
                  </p>
                ) : null}
              </div>

              {isChildrenGenre ? (
                <div className="rounded-xl border border-[color:var(--gc-accent)]/30 bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)] px-4 py-3 text-xs leading-relaxed text-[var(--gc-text-soft)]">
                  <p>
                    <span className="font-medium text-[var(--gc-accent)]">
                      {localizedChildrenAgeLabel(childrenTargetAge, locale)} ·{" "}
                      {localizedChildrenStageLabel(childrenTargetAge, locale)}
                    </span>
                    <span className="text-[var(--gc-muted)]">
                      {" "}
                      · {tn("bodyText")} {localizedChildrenCharRangeLabel(childrenTargetAge, locale)}
                    </span>
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--gc-text-faint)]">
                    {localizedChildrenFeaturesLabel(childrenTargetAge, locale)}
                  </p>
                  <p className="mt-1 text-[var(--gc-muted)]">
                    {tn("structureMarks", {
                      interpret: childrenTier.interpretMark,
                      body: childrenTier.bodyMark,
                      closing: childrenTier.closingMark,
                    })}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                    {t("lengthSync")}
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {NOVEL_LENGTH_TIERS_FOR_UI.map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setLengthTier(tier.id)}
                        disabled={loading}
                        className={`rounded-xl border px-4 py-3 text-left transition disabled:opacity-50 ${
                          lengthTier === tier.id
                            ? "border-[color:var(--gc-accent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)]"
                            : "border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]"
                        }`}
                      >
                        <span className="block text-sm font-semibold">{tier.label}</span>
                        <span className="mt-0.5 block text-xs text-[var(--gc-muted)]">{tier.desc}</span>
                        {lengthTier === tier.id && !loading ? (
                          <span className="mt-1 block text-[10px] text-[var(--gc-accent)]">
                            {t("etaPrefix")} {novelGenerationEtaHint(tier.id, locale)}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {effectiveLengthTier === "long" ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--gc-text-soft)]">
                  <input
                    type="checkbox"
                    checked={longPolish}
                    onChange={(e) => setLongPolish(e.target.checked)}
                    disabled={loading}
                  />
                  {t("lightPolish")}
                </label>
              ) : null}

              {loading ? (
                <GenerationStage
                  title={t("generatingTitle")}
                  stages={novelGenerationStages.map((s) => {
                    const activeIndex = activeGenerationStage
                      ? novelGenerationStages.findIndex((x) => x.key === activeGenerationStage)
                      : -1;
                    const selfIndex = novelGenerationStages.findIndex((x) => x.key === s.key);
                    return {
                      ...s,
                      active: s.key === activeGenerationStage,
                      done: activeIndex > selfIndex,
                    };
                  })}
                  detail={progress || undefined}
                />
              ) : null}
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {progress && !error && !loading ? (
                <p className="text-sm text-[var(--gc-accent)]">{progress}</p>
              ) : null}
              {loading && streamPreview ? (
                <div className="min-h-72 max-h-[min(65vh,36rem)] overflow-y-auto rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4 text-sm leading-relaxed whitespace-pre-wrap text-[var(--gc-text-soft)]">
                  {streamPreview}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={loading}
                  className="rounded-xl border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-muted)] disabled:opacity-50"
                >
                  {t("editBrief")}
                </button>
                <button
                  type="submit"
                  disabled={
                    loading || !(isChildrenGenre ? childrenCreativeBrief : novelCreativeBrief)
                  }
                  className="gc-theme-cta rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {loading ? t("writing") : t("startWriting")}
                </button>
              </div>
            </form>
          ) : null}

          {step === 4 && publishedNovelId ? (
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]/60 p-5 sm:p-6">
                <p className="text-sm font-medium text-[var(--gc-text)]">
                  {t("contentReady")}
                  {publishVisibilityMessage(publishedNovel?.visibility, locale)}
                </p>
                <p className="mt-1 text-xs text-[var(--gc-muted)]">
                  {t("coverHint")}
                </p>

                <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="mx-auto w-full max-w-[12rem] shrink-0 sm:mx-0 sm:max-w-[14rem]">
                    <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--gc-muted)] sm:text-left">
                      {t("coverPreview")}
                    </p>
                    <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] shadow-lg ring-1 ring-[color:color-mix(in_srgb,var(--gc-accent)_15%,transparent)]">
                      {publishedNovel?.coverPath ? (
                        <img
                          src={`${publishedNovel.coverPath}${publishedNovel.coverPath.includes("?") ? "&" : "?"}v=${coverImageKey}`}
                          alt={t("novelCoverAlt")}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-xs text-[var(--gc-muted)]">
                          {coverBusy || coverRegenerating ? (
                            <>
                              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--gc-accent)] border-t-transparent" />
                              {t("coverDrawing")}
                            </>
                          ) : (
                            t("coverPending")
                          )}
                        </div>
                      )}
                    </div>
                    {publishedNovel?.coverPath ? (
                      <p className="mt-2 text-center text-[10px] text-[var(--gc-text-faint)] sm:text-left">
                        {t("redoCoverHint")}
                      </p>
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-[var(--gc-text)]">
                      《
                      {publishedNovel
                        ? normalizeNovelTitle(publishedNovel.title, publishedNovel.prompt)
                        : title.trim()}
                      》
                    </h2>
                    {genre ? (
                      <p className="mt-1 text-xs text-[var(--gc-accent)]">{genre.label}</p>
                    ) : null}
                    {publishedNovel ? (
                      <p className="mt-3 text-sm leading-relaxed text-[var(--gc-text-soft)]">
                        {displayNovelSummary(
                          publishedNovel.summary,
                          normalizeNovelTitle(publishedNovel.title, publishedNovel.prompt, undefined, locale),
                          publishedNovel.prompt,
                          publishedNovel.content,
                          locale,
                        )}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--gc-muted)]">{t("loadingSummary")}</p>
                    )}
                  </div>
                </div>
              </div>

              {error ? <p className="text-sm text-red-400">{error}</p> : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleRegenerateCover()}
                  disabled={coverBusy || coverRegenerating || !publishedNovelId}
                  className="rounded-xl border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-text-soft)] disabled:opacity-50"
                >
                  {coverRegenerating || coverBusy
                    ? t("generatingCover")
                    : publishedNovel?.coverPath
                      ? t("regenerateCover")
                      : t("generateCover")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleShareCopy()}
                  disabled={coverBusy}
                  className="rounded-xl border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-text-soft)] disabled:opacity-50"
                >
                  {shareCopied ? t("copiedLink") : t("copyShareLink")}
                </button>
                <Link
                  href={withLocalePath("/novel/discover", locale)}
                  className="rounded-xl border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-muted)]"
                >
                  {t("goDiscover")}
                </Link>
                <button
                  type="button"
                  onClick={() => router.push(withLocalePath(`/novel/${publishedNovelId}`, locale))}
                  className="gc-theme-cta rounded-xl px-6 py-2.5 text-sm font-semibold"
                >
                  {t("enterRead")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </main>
      {QuotaModal}
      </AppMain>
    </AppPageShell>
  );
}
