"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ChildrenAgePicker } from "@/components/novel/ChildrenAgePicker";
import { NovelCreativeBriefPanel } from "@/components/novel/NovelCreativeBriefPanel";
import { NovelGenreTagPicker } from "@/components/novel/NovelGenreTagPicker";
import {
  childrenMaxCharsForAge,
  DEFAULT_CHILDREN_TARGET_AGE,
  type ChildrenTargetAge,
} from "@/lib/children-age-length";
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
  NOVEL_TITLE_MAX_LEN,
  normalizeNovelTitle,
  validateNovelTitleInput,
} from "@/lib/novel-display";
import { fetchCreativeBriefPreview } from "@/lib/creative-brief/preview-client";
import { type NovelBriefUserRevision, type NovelCreativeBrief } from "@/lib/literary-brief";
import {
  buildNovelBriefSeed,
  buildNovelStoredPrompt,
  getNovelGenreTag,
  isChildrenGenreTag,
  type NovelGenreTagId,
} from "@/lib/novel-genre-tags";
import { PRODUCT } from "@/lib/product-config";

const STEPS = [
  { n: 1 as const, label: "书名与类型" },
  { n: 2 as const, label: "构思" },
  { n: 3 as const, label: "写作" },
  { n: 4 as const, label: "发布" },
] as const;

type NovelCreateStep = (typeof STEPS)[number]["n"];

export default function NovelCreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<NovelCreateStep>(1);
  const [title, setTitle] = useState("");
  const [genreId, setGenreId] = useState<NovelGenreTagId | null>(null);
  const [addonNotes, setAddonNotes] = useState("");
  const [lengthTier, setLengthTier] = useState<NovelLengthTier>("medium");
  const [childrenTargetAge, setChildrenTargetAge] = useState<ChildrenTargetAge>(
    DEFAULT_CHILDREN_TARGET_AGE,
  );
  const [longPolish, setLongPolish] = useState<boolean>(PRODUCT.novel.longSegmented.polishAfterSegment);

  const [creativeBrief, setCreativeBrief] = useState<NovelCreativeBrief | null>(null);
  const [creativeBriefSummary, setCreativeBriefSummary] = useState<string | null>(null);
  const [briefRevision, setBriefRevision] = useState<NovelBriefUserRevision | null>(null);
  const [briefConfirmed, setBriefConfirmed] = useState(false);
  const [briefPreviewBusy, setBriefPreviewBusy] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [streamPreview, setStreamPreview] = useState("");
  const [draft, setDraft] = useState<DraftState | null>(null);

  const [publishedNovelId, setPublishedNovelId] = useState<string | null>(null);
  const [publishedNovel, setPublishedNovel] = useState<{
    id: string;
    title: string;
    summary: string | null;
    prompt: string;
    content: string;
    coverPath: string | null;
    shareCode: string | null;
  } | null>(null);
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
  const childrenMaxChars = childrenMaxCharsForAge(childrenTargetAge);

  function handleGenreChange(id: NovelGenreTagId) {
    setGenreId(id);
    if (isChildrenGenreTag(id)) setLengthTier("children");
    else if (lengthTier === "children") setLengthTier("short");
  }

  useEffect(() => {
    const d = loadDraft("novel");
    if (d && d.generating && !d.generatedId) setDraft(d);
  }, []);

  const expandBrief = useCallback(async () => {
    if (!title.trim() || !genre) return;
    setError("");
    setBriefPreviewBusy(true);
    setBriefConfirmed(false);
    try {
      const seed = buildNovelBriefSeed(
        title,
        genre,
        addonNotes,
        isChildrenGenre ? childrenTargetAge : undefined,
      );
      const r = await fetchCreativeBriefPreview(seed, "novel", {
        novelGenreId: genre.id,
        title: title.trim(),
        childrenTargetAge: isChildrenGenre ? childrenTargetAge : undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCreativeBrief(r.brief);
      setCreativeBriefSummary(r.oneLineSummary);
    } finally {
      setBriefPreviewBusy(false);
    }
  }, [title, genre, addonNotes, isChildrenGenre, childrenTargetAge]);

  useEffect(() => {
    if (step === 2 && title.trim() && genre && !creativeBrief && !briefPreviewBusy) {
      void expandBrief();
    }
  }, [step, title, genre, creativeBrief, briefPreviewBusy, expandBrief]);

  function goNext() {
    setError("");
    if (step === 1) {
      const tv = validateNovelTitleInput(title.trim());
      if (!tv.ok) {
        setError(tv.error);
        return;
      }
      if (!genreId) {
        setError("请选择小说类型");
        return;
      }
      setTitle(tv.value);
      setCreativeBrief(null);
      setCreativeBriefSummary(null);
      setBriefConfirmed(false);
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!creativeBrief) {
        setError("请等待 AI 完成构思扩写，或点击重新生成");
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
    const res = await fetch(`/api/novel/${novelId}/cover${force ? "?force=1" : ""}`, { method: "POST" });
    const data = (await res.json()) as { coverPath?: string; error?: string; novel?: { coverPath?: string } };
    if (!res.ok) throw new Error(data.error || "封面生成失败");
    const path = data.coverPath ?? data.novel?.coverPath ?? null;
    if (path) {
      setPublishedNovel((prev) => (prev ? { ...prev, coverPath: path } : prev));
      setCoverImageKey((k) => k + 1);
    }
    return path;
  }, []);

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
            setError(e instanceof Error ? e.message : "封面生成失败");
          }
        } finally {
          if (!cancelled) setCoverBusy(false);
        }
      } catch {
        if (!cancelled) setError("加载作品信息失败");
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
      setError(e instanceof Error ? e.message : "封面生成失败");
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
      const url = `${window.location.origin}/s/${code}`;
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setPublishedNovel((prev) => (prev ? { ...prev, shareCode: code } : prev));
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setError("复制分享链接失败");
    }
  }

  async function handleStartWriting(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !genre || !creativeBrief || loading) return;

    const storedPrompt = buildNovelStoredPrompt(title, genre);
    setLoading(true);
    setError("");
    setProgress("连接生成服务…");
    setStreamPreview("");

    markDraftGenerating("novel", storedPrompt, title.trim());

    try {
      const res = await fetch("/api/novel/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: storedPrompt,
          title: title.trim(),
          lengthTier: effectiveLengthTier,
          novelGenreTag: genreId,
          ...(isChildrenGenre ? { childrenTargetAge } : {}),
          ...(effectiveLengthTier === "long" ? { polish: longPolish } : {}),
          creativeBrief,
          ...(briefRevision ? { briefRevision } : {}),
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
            if (ev.step === "start") setProgress(ev.message ?? "生成中…");
            if (ev.step === "bible_start" || ev.step === "outline_start") {
              setProgress(ev.message ?? "正在生成设定圣经…");
            }
            if (ev.step === "bible_ready" || ev.step === "outline_ready") {
              setProgress(ev.message ?? "设定完成…");
            }
            if (ev.step === "chapter_plan_start") setProgress(ev.message ?? "正在规划章节…");
            if (ev.step === "chapter_plan_ready") setProgress(ev.message ?? "开始分批写作…");
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
              if (ev.message) setProgress(ev.message);
            }
            if (ev.step === "segment_start") {
              setProgress(
                ev.message ??
                  `长篇第 ${ev.index ?? "?"}/${ev.total ?? "?"} 段（${ev.label ?? "续写"}）…`,
              );
            }
            if (ev.step === "segment_done" && typeof ev.length === "number") {
              setProgress(
                `已完成 ${ev.index ?? "?"}/${ev.total ?? "?"} 段 · 全文约 ${ev.length} 字`,
              );
            }
            if (ev.step === "model_start" && ev.model) {
              setProgress(`正在连接模型 ${ev.model}…`);
            }
            if (ev.step === "delta" && typeof ev.text === "string") {
              totalChars += ev.text.length;
              setStreamPreview((p) => p + ev.text);
              setProgress(
                `生成中… 已约 ${totalChars.toLocaleString()} / ${novelMaxChars(effectiveLengthTier, childrenLengthOpts).toLocaleString()} 字`,
              );
            }
            if (ev.step === "length_capped") setProgress(ev.message ?? "已达篇幅上限…");
            if (ev.step === "synopsis_start") setProgress(ev.message ?? "正在撰写简介…");
            if (ev.step === "model_short" && ev.model) {
              setProgress(`模型 ${ev.model} 输出偏短，尝试备用…`);
            }
            if (ev.step === "model_error" && ev.model) {
              setProgress(`模型 ${ev.model} 出错，尝试备用…`);
            }
            if (ev.step === "done" && ev.novel?.id) {
              novelId = ev.novel.id;
              setProgress("正在跳转…");
            }
            if (ev.step === "error") streamError = ev.message ?? "生成失败";
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
        setError(streamError || "生成未完成");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const timedOut = /abort|timeout|timed out|network|failed to fetch|incomplete/i.test(msg);
      setError(timedOut ? novelStreamInterruptHint(effectiveLengthTier) : `连接异常：${msg || "请重试"}`);
    } finally {
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
              定书名与类型 → AI 扩写构思 → 流式写作 → 生成封面并分享发布。
            </p>
          </div>

          <ol className="mb-6 flex flex-wrap gap-2">
            {STEPS.map((s) => {
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

          {draft && step === 1 ? (
            <div className="mb-4 rounded-xl border border-[color:var(--gc-accent)]/30 bg-[color:color-mix(in_srgb,var(--gc-accent)_8%,transparent)] p-4 text-sm">
              <p className="font-medium text-[var(--gc-text)]">检测到未完成的生成草稿</p>
              <button
                type="button"
                onClick={() => {
                  clearDraft("novel");
                  setDraft(null);
                }}
                className="mt-2 text-xs text-[var(--gc-muted)] underline"
              >
                忽略
              </button>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-5 rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]/60 p-5 sm:p-6">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                  小说书名
                </label>
                <input
                  type="text"
                  value={title}
                  maxLength={NOVEL_TITLE_MAX_LEN}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：大明第一锦衣卫"
                  className="w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg)]/80 px-4 py-3 text-base text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:var(--gc-accent)]"
                  autoFocus
                />
                <p className="mt-1 text-xs text-[var(--gc-muted)]">
                  {title.length}/{NOVEL_TITLE_MAX_LEN} 字
                </p>
              </div>

              <div className="border-t border-[color:var(--gc-border)] pt-5">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                  小说类型
                </label>
                <NovelGenreTagPicker value={genreId} onChange={handleGenreChange} />
                {genre ? (
                  <p className="mt-2 text-xs leading-relaxed text-[var(--gc-text-faint)]">
                    {genre.label}：{genre.desc}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-[var(--gc-text-faint)]">
                    选择标签后，AI 将按该类型的网文惯例扩写构思
                  </p>
                )}
              </div>

              {isChildrenGenre ? (
                <div className="border-t border-[color:var(--gc-border)] pt-5">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                    读者年龄（决定正文字数）
                  </label>
                  <p className="mb-2 text-xs text-[var(--gc-text-faint)]">
                    3岁以下约 200 字，4–10 岁每增一岁约多 100 字（上限 900 字）。AI 会从书名与补充想法提取主题、原创角色与情节，禁止模板角色；漫画为 Q
                    版小人书五格。
                  </p>
                  <ChildrenAgePicker
                    value={childrenTargetAge}
                    onChange={setChildrenTargetAge}
                    disabled={loading}
                  />
                  <p className="mt-2 text-[10px] text-[var(--gc-muted)]">
                    预计 {novelGenerationEtaHint("children")} · 本次目标约 {childrenMaxChars} 字
                  </p>
                </div>
              ) : (
                <div className="border-t border-[color:var(--gc-border)] pt-5">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                    篇幅
                  </label>
                  <p className="mb-2 text-xs text-[var(--gc-text-faint)]">
                    短篇 / 中篇 / 长篇。进入「写作」步骤前仍可修改。
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
                        <span className="block text-sm font-semibold">{tier.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-[var(--gc-muted)]">
                          {tier.desc}
                        </span>
                        {lengthTier === tier.id ? (
                          <span className="mt-1 block text-[10px] text-[var(--gc-accent)]">
                            预计 {novelGenerationEtaHint(tier.id)}
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
                下一步：AI 扩写构思
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
                      · 约 {childrenMaxChars} 字
                    </span>
                  ) : (
                    <span className="text-[var(--gc-muted)]">
                      {" "}
                      · {novelLengthConfig(effectiveLengthTier).label}
                    </span>
                  )}
                </span>
                {briefPreviewBusy ? " — 正在根据书名与类型扩写构思…" : ""}
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--gc-muted)]">
                  补充想法（可选）
                </label>
                <textarea
                  value={addonNotes}
                  onChange={(e) => setAddonNotes(e.target.value)}
                  rows={2}
                  placeholder="例如：主角要腹黑、前期慢热、结局 HE…"
                  className="w-full resize-none rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2 text-sm text-[var(--gc-text)]"
                />
              </div>
              {(creativeBrief || creativeBriefSummary) ? (
              <NovelCreativeBriefPanel
                brief={creativeBrief}
                  summary={creativeBriefSummary}
                  onRevisionChange={setBriefRevision}
                  onRegenerateWithRevision={() => void expandBrief()}
                  regenerateDisabled={briefPreviewBusy || loading}
                />
              ) : briefPreviewBusy ? (
                <p className="text-sm text-[var(--gc-accent)]">AI 正在扩写世界观、人物与章节奏…</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={goBack} className="rounded-xl border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-muted)]">
                  上一步
                </button>
                <button
                  type="button"
                  disabled={briefPreviewBusy}
                  onClick={() => void expandBrief()}
                  className="rounded-xl border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-text-soft)] disabled:opacity-50"
                >
                  重新生成构思
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!creativeBrief || briefPreviewBusy}
                  className="gc-theme-cta rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  确认构思，进入写作
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
                    构思已确认，请选择篇幅后开始写作
                  </p>
                ) : null}
              </div>

              {isChildrenGenre ? (
                <div>
                  <p className="mb-2 text-xs text-[var(--gc-muted)]">
                    儿童短篇 · 读者 {childrenTargetAge === 2 ? "3岁以下" : `${childrenTargetAge}岁`}，正文约{" "}
                    {childrenMaxChars} 字（±50），含【故事标题】【正文】【家长共读】三块成稿。
                  </p>
                  <ChildrenAgePicker
                    value={childrenTargetAge}
                    onChange={setChildrenTargetAge}
                    disabled={loading}
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">
                    篇幅（与第 1 步同步，可在此修改）
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
                            预计 {novelGenerationEtaHint(tier.id)}
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
                  每批写完后轻量润色
                </label>
              ) : null}

              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {progress && !error ? <p className="text-sm text-[var(--gc-accent)]">{progress}</p> : null}
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
                  修改构思
                </button>
                <button
                  type="submit"
                  disabled={loading || !creativeBrief}
                  className="gc-theme-cta rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {loading ? "正在写作…" : "开始生成正文"}
                </button>
              </div>
            </form>
          ) : null}

          {step === 4 && publishedNovelId ? (
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]/60 p-5 sm:p-6">
                <p className="text-sm font-medium text-[var(--gc-text)]">
                  正文已生成，作品已出现在「小说发现」广场
                </p>
                <p className="mt-1 text-xs text-[var(--gc-muted)]">
                  下方可预览竖版封面；不满意可点「重做封面」无需进入阅读页。生成完成后可复制分享链接。
                </p>

                <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="mx-auto w-full max-w-[12rem] shrink-0 sm:mx-0 sm:max-w-[14rem]">
                    <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--gc-muted)] sm:text-left">
                      封面预览
                    </p>
                    <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] shadow-lg ring-1 ring-[color:color-mix(in_srgb,var(--gc-accent)_15%,transparent)]">
                      {publishedNovel?.coverPath ? (
                        <img
                          src={`${publishedNovel.coverPath}${publishedNovel.coverPath.includes("?") ? "&" : "?"}v=${coverImageKey}`}
                          alt="小说封面"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-xs text-[var(--gc-muted)]">
                          {coverBusy || coverRegenerating ? (
                            <>
                              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--gc-accent)] border-t-transparent" />
                              AI 正在绘制封面…
                            </>
                          ) : (
                            "封面待生成"
                          )}
                        </div>
                      )}
                    </div>
                    {publishedNovel?.coverPath ? (
                      <p className="mt-2 text-center text-[10px] text-[var(--gc-text-faint)] sm:text-left">
                        对画风不满意可「重做封面」，约需数十秒
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
                          normalizeNovelTitle(publishedNovel.title, publishedNovel.prompt),
                          publishedNovel.prompt,
                          publishedNovel.content,
                        )}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--gc-muted)]">正在加载简介…</p>
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
                    ? "封面绘制中…"
                    : publishedNovel?.coverPath
                      ? "不满意？重做封面"
                      : "生成封面"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleShareCopy()}
                  disabled={coverBusy}
                  className="rounded-xl border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-text-soft)] disabled:opacity-50"
                >
                  {shareCopied ? "链接已复制" : "复制分享链接"}
                </button>
                <Link
                  href="/novel/discover"
                  className="rounded-xl border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-muted)]"
                >
                  去发现广场
                </Link>
                <button
                  type="button"
                  onClick={() => router.push(`/novel/${publishedNovelId}`)}
                  className="gc-theme-cta rounded-xl px-6 py-2.5 text-sm font-semibold"
                >
                  进入阅读
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
