"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReferenceImageHandle } from "@/lib/assets/reference-storage";
import { saveReferenceHandlesToSession } from "@/lib/assets/reference-storage";
import {
  autoFitAndWriteReferencePayloadsToSession,
  buildIngestFileOrder,
  buildRuntimePayloadsFromIngestOrder,
  clearReferenceImagePayloadsSession,
  writeReferencePayloadsToSessionStrict,
} from "@/lib/assets/reference-image-payloads.client";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import type { GameSpec } from "@/lib/game-spec";
import { consumeSSE } from "@/lib/read-sse";
import { GamePlayer } from "@/components/GamePlayer";

const SiteHeader = dynamic(() => import("@/components/SiteHeader").then((m) => m.SiteHeader), {
  ssr: false,
  loading: () => (
    <div className="hidden h-screen w-[260px] shrink-0 border-r border-[color:var(--gc-border)] bg-[var(--gc-sidebar-bg)] lg:block" />
  ),
});

const EXAMPLES = [
  "赛博朋克夜市里操控无人机送货，躲开广告牌碎片",
  "海底小鱼收集珍珠，避开章鱼墨汁",
  "霓虹废墟横版闯关：多层平台跳跃收集能量核，躲避尖刺陷阱",
];

const SOURCE_HINT: Record<string, string> = {
  llm: "大模型直接生成",
  llm_overlay: "大模型 + 本地字段融合纠错",
  llm_repair: "大模型二次修复后生成",
  mock: "已回退本地规则推断（请看下方“生成证据”里的回退原因）",
};

type VariantRow = { spec: GameSpec; source: string; label: string };

type PastedImageRow = { id: string; file: File; purpose: string };

function countImageFilesInList(fl: FileList | null | undefined): number {
  if (!fl?.length) return 0;
  let c = 0;
  for (let i = 0; i < fl.length; i += 1) {
    if (fl[i]?.type.startsWith("image/")) c += 1;
  }
  return c;
}

function PasteThumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    const t = window.setTimeout(() => {
      setUrl(u);
    }, 0);
    return () => {
      window.clearTimeout(t);
      URL.revokeObjectURL(u);
      setUrl(null);
    };
  }, [file]);
  if (!url) {
    return <div className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-[var(--gc-input-bg)]" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
    <img
      src={url}
      alt=""
      className="h-14 w-14 shrink-0 rounded-lg border border-[color:var(--gc-border)] object-cover"
    />
  );
}

const STEP_META: Record<string, { label: string; progress: number; defaultMsg: string }> = {
  start: { label: "初始化", progress: 0.08, defaultMsg: "已接收创意，准备生成…" },
  search: { label: "联网检索", progress: 0.22, defaultMsg: "正在检索同类玩法、风格与机制…" },
  model: { label: "生成规格", progress: 0.56, defaultMsg: "正在调用模型并结构化输出…" },
  enhance: { label: "二次强化", progress: 0.72, defaultMsg: "正在二次强化为更成品的规格…" },
  finalize: { label: "规格收敛", progress: 0.84, defaultMsg: "正在校验、纠错与填充蓝图…" },
  done: { label: "完成", progress: 1, defaultMsg: "完成" },
  error: { label: "失败", progress: 1, defaultMsg: "生成失败" },
};

function formatEta(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s <= 8) return `${s}s`;
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return `${m}分钟`;
}

export default function CreateClient(props: { initialPrompt?: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(() => (props.initialPrompt ?? "").slice(0, 4000));
  const [busy, setBusy] = useState<"idle" | "gen" | "gen_variants" | "save">("idle");
  const [error, setError] = useState<string | null>(null);
  const [spec, setSpec] = useState<GameSpec | null>(null);
  const [genSource, setGenSource] = useState<string | null>(null);
  const [genDebug, setGenDebug] = useState<{
    model?: string;
    draftModel?: string;
    enhanceModel?: string;
    provider?: string;
    llmMode?: string;
    llmError?: string;
    fallback?: boolean;
    enhanced?: boolean;
    searchEnhance?: boolean;
    templateHint?: string;
    enhanceWarning?: string;
    fallbackReason?: string;
  } | null>(null);
  const [streamMsg, setStreamMsg] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantRow[] | null>(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const [ingestUrl, setIngestUrl] = useState("");
  const [visionOn, setVisionOn] = useState(true);
  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingestNotes, setIngestNotes] = useState<string[] | null>(null);
  const [searchEnhance, setSearchEnhance] = useState(false);
  const [templateHint, setTemplateHint] = useState<"auto" | GameSpec["templateId"]>("auto");
  const [enhancePass, setEnhancePass] = useState(true);
  const [webMeta, setWebMeta] = useState<{ warning?: string; sources?: Array<{ title: string; url: string }> } | null>(
    null,
  );
  const [streamStep, setStreamStep] = useState<string | null>(null);
  const [streamStartedAt, setStreamStartedAt] = useState<number | null>(null);
  const [etaText, setEtaText] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [pastedImages, setPastedImages] = useState<PastedImageRow[]>([]);
  /** 与「选择文件」里当前 image/* 张数同步，避免在 render 中读 ref */
  const [pickerImageCount, setPickerImageCount] = useState(0);
  /** 参考图写入 session 后递增，强制试玩区重挂 Phaser 以加载新贴图 */
  const [refPixelEpoch, setRefPixelEpoch] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const applyVariant = useCallback((rows: VariantRow[], index: number) => {
    const row = rows[index];
    if (!row) return;
    setVariantIndex(index);
    setSpec(row.spec);
    setGenSource(row.source);
    setGenDebug(null);
  }, []);

  /** 默认：SSE 流式进度 + 单次生成 */
  const generateStream = useCallback(async () => {
    setError(null);
    setBusy("gen");
    setStreamStep("start");
    setStreamStartedAt(Date.now());
    setEtaText(null);
    setElapsedSec(0);
    setStreamMsg("连接中…");
    setVariants(null);
    setWebMeta(null);
    setGenDebug(null);
    try {
      const res = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, searchEnhance, templateHint, enhancePass }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? "生成失败");
        setStreamMsg(null);
        return;
      }

      await consumeSSE(res, (ev) => {
        const step = ev.step as string | undefined;
        const msg = ev.message as string | undefined;
        if (typeof step === "string" && step) setStreamStep(step);
        if (typeof msg === "string") setStreamMsg(msg);

        if (step === "done" && ev.spec) {
          setSpec(ev.spec as GameSpec);
          setGenSource(typeof ev.source === "string" ? ev.source : null);
          if (ev.debug && typeof ev.debug === "object") {
            const d = ev.debug as {
              model?: unknown;
              draftModel?: unknown;
              enhanceModel?: unknown;
              fallback?: unknown;
              fallbackReason?: unknown;
              provider?: unknown;
              llmMode?: unknown;
              llmError?: unknown;
              enhancedRequested?: unknown;
              enhancedApplied?: unknown;
              searchEnhance?: unknown;
              templateHint?: unknown;
              enhanceWarning?: unknown;
            };
            setGenDebug({
              model: typeof d.model === "string" ? d.model : undefined,
              draftModel: typeof d.draftModel === "string" ? d.draftModel : undefined,
              enhanceModel: typeof d.enhanceModel === "string" ? d.enhanceModel : undefined,
              fallback: typeof d.fallback === "boolean" ? d.fallback : undefined,
              fallbackReason: typeof d.fallbackReason === "string" ? d.fallbackReason : undefined,
              provider: typeof d.provider === "string" ? d.provider : undefined,
              llmMode: typeof d.llmMode === "string" ? d.llmMode : undefined,
              llmError: typeof d.llmError === "string" ? d.llmError : undefined,
              enhanced:
                typeof d.enhancedApplied === "boolean"
                  ? d.enhancedApplied
                  : typeof d.enhancedRequested === "boolean"
                    ? d.enhancedRequested
                    : undefined,
              searchEnhance: typeof d.searchEnhance === "boolean" ? d.searchEnhance : undefined,
              templateHint: typeof d.templateHint === "string" ? d.templateHint : undefined,
              enhanceWarning: typeof d.enhanceWarning === "string" ? d.enhanceWarning : undefined,
            });
          }
          if (ev.web && typeof ev.web === "object") {
            const w = ev.web as { warning?: string; sources?: Array<{ title?: string; url?: string }> };
            const sources =
              Array.isArray(w.sources) && w.sources.length
                ? w.sources
                    .filter((s) => s && typeof s.url === "string")
                    .map((s) => ({ title: String(s.title ?? ""), url: String(s.url ?? "") }))
                    .slice(0, 6)
                : undefined;
            setWebMeta({ warning: typeof w.warning === "string" ? w.warning : undefined, sources });
          }
          setVariants(null);
        }
        if (step === "error") {
          setError(typeof msg === "string" ? msg : "生成失败");
        }
      });
    } catch {
      setError("网络异常");
    } finally {
      setBusy("idle");
      setStreamMsg(null);
      setEtaText(null);
      setElapsedSec(0);
    }
  }, [enhancePass, prompt, searchEnhance, templateHint]);

  /** 并行三套备选（风味后缀不同） */
  const generateVariants = useCallback(async () => {
    setError(null);
    setStreamMsg(null);
    setBusy("gen_variants");
    setWebMeta(null);
    setGenDebug(null);
    try {
      const res = await fetch("/api/generate/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, count: 3, searchEnhance, templateHint, enhancePass }),
      });
      const data = (await res.json()) as {
        variants?: VariantRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "多套生成失败");
        return;
      }
      const rows = data.variants ?? [];
      if (rows.length === 0) {
        setError("未返回备选方案");
        return;
      }
      setVariants(rows);
      applyVariant(rows, 0);
    } catch {
      setError("网络异常");
    } finally {
      setBusy("idle");
    }
  }, [applyVariant, enhancePass, prompt, searchEnhance, templateHint]);

  useEffect(() => {
    if (busy !== "gen") return;
    if (!streamStartedAt) return;
    const timer = window.setInterval(() => {
      const step = streamStep ?? "start";
      const meta = STEP_META[step] ?? STEP_META.start;
      const now = Date.now();
      const elapsed = now - streamStartedAt;
      setElapsedSec(Math.max(0, Math.round(elapsed / 1000)));
      const pct = Math.max(0.05, Math.min(0.98, meta.progress));
      const estTotal = Math.min(9 * 60_000, Math.max(10_000, Math.round(elapsed / pct)));
      const remain = Math.max(0, estTotal - elapsed);
      setEtaText(formatEta(remain));
    }, 300);
    return () => window.clearInterval(timer);
  }, [busy, streamStartedAt, streamStep]);

  const ingestReference = useCallback(async () => {
    setError(null);
    setIngestNotes(null);
    setIngestBusy(true);
    try {
      const fd = new FormData();
      const roles: string[] = [];
      const files = fileRef.current?.files;
      if (files?.length) {
        for (let i = 0; i < files.length; i += 1) {
          fd.append("files", files[i]);
          roles.push("");
        }
      }
      for (const row of pastedImages) {
        fd.append("files", row.file);
        roles.push(row.purpose);
      }
      fd.set("imageRoles", JSON.stringify(roles));
      if (ingestUrl.trim()) fd.set("url", ingestUrl.trim());
      fd.set("vision", visionOn ? "1" : "0");

      const res = await fetch("/api/ingest", { method: "POST", body: fd });
      const data = (await res.json()) as {
        text?: string;
        warnings?: string[];
        error?: string;
        referenceAssets?: ReferenceImageHandle[];
        referenceAssetStorageMode?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "素材解析失败");
        return;
      }
      const ordered = buildIngestFileOrder(fileRef.current?.files ?? null, pastedImages);
      let payloads: RuntimeReferencePayload[] = [];
      try {
        payloads = await buildRuntimePayloadsFromIngestOrder(ordered);
      } catch {
        /* 读图失败：不覆盖已有 session 像素缓存 */
      }
      const notes: string[] = [...(data.warnings ?? [])];
      if (payloads.length > 0) {
        const fit = await autoFitAndWriteReferencePayloadsToSession(payloads);
        const parts: string[] = [];
        if (fit.qualityReduced) parts.push("已自动进一步降低 JPEG 画质");
        if (fit.removedCount > 0) parts.push(`已自动去掉末尾 ${fit.removedCount} 张贴图`);
        if (parts.length) notes.push(parts.join("；") + "，以适配浏览器会话存储。");
        if (fit.saved.length === 0) {
          notes.push("参考图经自动处理后仍无法写入会话存储，塔防试玩将不加载本次参考贴图。");
        }
        setRefPixelEpoch((n) => n + 1);
        if (fileRef.current) fileRef.current.value = "";
        setPickerImageCount(0);
        setPastedImages([]);
      } else {
        void writeReferencePayloadsToSessionStrict([]);
        if (fileRef.current) fileRef.current.value = "";
        setPickerImageCount(0);
        setPastedImages([]);
        setRefPixelEpoch((n) => n + 1);
      }
      if (notes.length) setIngestNotes(notes);
      else setIngestNotes(null);
      const block = (data.text ?? "").trim();
      if (Array.isArray(data.referenceAssets) && data.referenceAssets.length > 0) {
        saveReferenceHandlesToSession(data.referenceAssets);
      }
      if (!block) {
        setError("未得到可合并的正文，请检查文件或链接");
        return;
      }
      setPrompt((prev) => {
        const head = prev.trim();
        const piece = head ? `\n\n---\n【参考素材】\n${block}` : `【参考素材】\n${block}`;
        return `${head}${piece}`.slice(0, 4000);
      });
    } catch {
      setError("素材解析请求失败");
    } finally {
      setIngestBusy(false);
    }
  }, [ingestUrl, pastedImages, visionOn]);

  const saveAndPlay = useCallback(async () => {
    if (!spec) return;
    setError(null);
    setBusy("save");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, spec }),
      });
      const data = (await res.json()) as { project?: { id: string }; error?: string };
      if (!res.ok) {
        setError(data.error ?? "保存失败");
        return;
      }
      if (!data.project?.id) {
        setError("未返回作品 id");
        return;
      }
      router.push(`/play/${data.project.id}`);
    } catch {
      setError("网络异常");
    } finally {
      setBusy("idle");
    }
  }, [prompt, router, spec]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "Enter") return;
      e.preventDefault();
      if (busy !== "idle" || prompt.trim().length < 2) return;
      void generateStream();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, generateStream, prompt]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const dt = e.clipboardData;
      if (!dt) return;
      const picked: File[] = [];
      if (dt.files?.length) {
        for (let i = 0; i < dt.files.length; i += 1) {
          const f = dt.files.item(i);
          if (f?.type.startsWith("image/")) picked.push(f);
        }
      }
      const list = dt.items;
      if (picked.length === 0 && list?.length) {
        for (let i = 0; i < list.length; i += 1) {
          const it = list[i];
          if (it.kind !== "file") continue;
          const f = it.getAsFile();
          if (f?.type.startsWith("image/")) picked.push(f);
        }
      }
      if (picked.length === 0) return;
      e.preventDefault();
      setPastedImages((prev) => [
        ...prev,
        ...picked.map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          file,
          purpose: "",
        })),
      ]);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const len = prompt.length;
  const busyLabel =
    busy === "gen" ? "生成中…" : busy === "gen_variants" ? "并行生成多套方案…" : busy === "save" ? "保存中…" : null;

  const stepMeta = STEP_META[streamStep ?? ""] ?? (busy === "gen" ? STEP_META.start : null);
  const stepProgress = stepMeta?.progress ?? 0;
  const stepText = stepMeta?.label ?? "";
  const stepMsg = streamMsg || stepMeta?.defaultMsg || "";

  return (
    <div className="flex min-h-full flex-1 flex-col text-[var(--gc-text)] lg:flex-row">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-10 px-4 py-10 lg:gap-14 lg:px-8 xl:pr-12">
        <header className="max-w-2xl space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--gc-text)]">创作台</h1>
          <p className="text-sm leading-relaxed text-[var(--gc-muted)]">
            描述一句话即可：左侧生成规格并即时试玩。支持<strong className="text-[var(--gc-text-soft)]">流式进度</strong>
            与<strong className="text-[var(--gc-text-soft)]">三套并行备选</strong>（需配置 OpenAI 密钥时差异更明显）。
          </p>
          <p className="text-xs text-[var(--gc-text-faint)]">快捷键：Ctrl / ⌘ + Enter → 流式生成一套方案</p>
        </header>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-[var(--gc-text-soft)]" htmlFor="prompt">
                  创意描述
                </label>
                <span
                  className={`text-xs tabular-nums ${len > 3800 ? "text-amber-400" : "text-[var(--gc-text-faint)]"}`}
                >
                  {len} / 4000
                </span>
              </div>
              <textarea
                id="prompt"
                rows={8}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="场景 + 目标 + 障碍或收集物 + 可选画风关键词…"
                className="min-h-[180px] w-full resize-y rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-4 py-3 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--gc-accent)_22%,transparent)]"
              />
            </div>

            <div
              className="rounded-2xl border px-4 py-4"
              style={{
                borderColor: "color-mix(in srgb, var(--gc-cta-c) 25%, transparent)",
                background: `linear-gradient(to bottom right, color-mix(in srgb, var(--gc-cta-c) 12%, transparent), color-mix(in srgb, var(--gc-cta-b) 10%, transparent))`,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[color:color-mix(in_srgb,var(--gc-cta-c)_90%,white)]">
                  参考素材
                </p>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--gc-muted)]">
                  <input
                    type="checkbox"
                    checked={visionOn}
                    onChange={(e) => setVisionOn(e.target.checked)}
                    className="rounded border-[color:var(--gc-border)] bg-[var(--gc-input-bg)]"
                  />
                  解读参考图（需 API Key）
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-[var(--gc-muted)]">
                    <span className="text-[11px] text-[var(--gc-text-faint)]">玩法模板</span>
                    <select
                      value={templateHint}
                      onChange={(e) => setTemplateHint(e.target.value as "auto" | GameSpec["templateId"])}
                      className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1 text-xs text-[var(--gc-text-soft)] outline-none"
                    >
                      <option value="auto">自动推荐</option>
                      <option value="platformer">横版闯关</option>
                      <option value="towerDefense">塔防</option>
                      <option value="collector">收集</option>
                      <option value="survivor">生存</option>
                      <option value="avoider">躲避</option>
                    </select>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--gc-muted)]">
                    <input
                      type="checkbox"
                      checked={enhancePass}
                      onChange={(e) => setEnhancePass(e.target.checked)}
                      className="rounded border-[color:var(--gc-border)] bg-[var(--gc-input-bg)]"
                    />
                    二次强化（更成品/更复杂）
                  </label>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--gc-muted)]">
                  <input
                    type="checkbox"
                    checked={searchEnhance}
                    onChange={(e) => setSearchEnhance(e.target.checked)}
                    className="rounded border-[color:var(--gc-border)] bg-[var(--gc-input-bg)]"
                  />
                  联网检索增强（Tavily）
                </label>
                <span className="text-[11px] text-[var(--gc-text-faint)]">
                  默认关闭，开启后会自动检索同类玩法并注入描述
                </span>
              </div>
              {webMeta?.warning ? (
                <p className="mt-2 text-xs text-amber-200/90">联网检索提示：{webMeta.warning}</p>
              ) : null}
              {webMeta?.sources?.length ? (
                <details className="mt-2 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium text-[var(--gc-text-soft)]">
                    本次检索来源（{webMeta.sources.length}）
                  </summary>
                  <ul className="mt-2 list-inside list-disc text-xs text-[var(--gc-muted)]">
                    {webMeta.sources.map((s) => (
                      <li key={s.url} className="break-all">
                        {s.title ? `${s.title} ` : ""}
                        <a
                          className="underline underline-offset-2 hover:text-[var(--gc-text)]"
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {s.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <p className="mt-2 text-xs leading-relaxed text-[var(--gc-muted)]">
                上传 PDF / DOCX / TXT / MD / 图片，<strong className="text-[var(--gc-text-soft)]">在本页任意处 Ctrl+V / ⌘V 粘贴截图</strong>
                ，或粘贴公开网页链接；解析结果会追加到上方描述，驱动关卡与美术倾向。含图片时：写入会话前会<strong className="text-[var(--gc-text-soft)]">默认把位图缩到长边≤1920 并 JPEG 压缩</strong>；若仍超过浏览器会话存储上限，会<strong className="text-[var(--gc-text-soft)]">自动多轮降低 JPEG 画质，仍写不下则从末尾逐张删图并重试</strong>，无需手动选择。塔防试玩会按「用途」关键词把<strong className="text-[var(--gc-text-soft)]">背景地图类</strong>作全屏底图、<strong className="text-[var(--gc-text-soft)]">怪物类</strong>作敌军贴图（需先点「解析并追加」再生成）。粘贴多张图时可在下方为每张填写
                <strong className="text-[var(--gc-text-soft)]">用途</strong>
                （如「背景地图」「怪物造型」「主角」），与描述里的「图1」「图2」顺序一致；开启「解读参考图」后模型会按用途看图写要点。
              </p>
              {pastedImages.length > 0 ? (
                <div className="mt-3 space-y-2 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[color:color-mix(in_srgb,var(--gc-accent)_80%,white)]">
                    <span>剪贴板待解析：{pastedImages.length} 张（用途会一并提交）</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPastedImages([]);
                        clearReferenceImagePayloadsSession();
                        setRefPixelEpoch((n) => n + 1);
                      }}
                      className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-2 py-0.5 text-[11px] font-medium text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
                    >
                      清空
                    </button>
                  </div>
                  <ol className="list-none space-y-2.5 p-0">
                    {pastedImages.map((row, idx) => (
                      <li
                        key={row.id}
                        className="flex flex-col gap-2 rounded-lg border border-[color:color-mix(in_srgb,var(--gc-border)_70%,transparent)] bg-[var(--gc-input-bg)]/40 p-2 sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-11 shrink-0 text-center text-[11px] font-semibold tabular-nums text-[var(--gc-text-soft)]">
                            图{pickerImageCount + idx + 1}
                          </span>
                          <PasteThumb file={row.file} />
                          <span className="truncate text-[11px] text-[var(--gc-text-faint)]" title={row.file.name}>
                            {row.file.name || "image"}
                          </span>
                        </div>
                        <label className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[10px] uppercase tracking-wide text-[var(--gc-text-faint)]">用途（可选）</span>
                          <input
                            type="text"
                            value={row.purpose}
                            onChange={(e) =>
                              setPastedImages((prev) =>
                                prev.map((p) => (p.id === row.id ? { ...p, purpose: e.target.value } : p)),
                              )
                            }
                            placeholder="如：背景地图 / 怪物 / 主角 / 塔造型…"
                            className="w-full rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1.5 text-xs text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)]"
                          />
                        </label>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="url"
                  value={ingestUrl}
                  onChange={(e) => setIngestUrl(e.target.value)}
                  placeholder="https:// 在线文档或文章链接"
                  className="min-w-0 flex-1 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-3 py-2 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)]"
                />
                <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-2 text-xs font-medium text-[var(--gc-text-soft)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] hover:bg-[var(--gc-surface-glass-strong)]">
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.docx,.txt,.md,.zip,image/*"
                    onChange={() => {
                      const fl = fileRef.current?.files;
                      setPickerImageCount(countImageFilesInList(fl ?? null));
                    }}
                  />
                  选择文件
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void ingestReference()}
                  disabled={ingestBusy}
                  className="gc-theme-cta rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  {ingestBusy ? "解析中…" : "解析并追加到描述"}
                </button>
              </div>
              {ingestNotes?.length ? (
                <ul className="mt-3 list-inside list-disc text-xs text-amber-200/90">
                  {ingestNotes.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">试一试</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className="gc-chip max-w-full truncate text-left"
                    title={ex}
                    onClick={() => setPrompt(ex)}
                  >
                    {ex.slice(0, 22)}
                    {ex.length > 22 ? "…" : ""}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void generateStream()}
                disabled={busy !== "idle" || prompt.trim().length < 2}
                className="gc-theme-cta rounded-full px-6 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "gen" ? "流式生成中…" : "生成可玩版本（SSE）"}
              </button>
              <button
                type="button"
                onClick={() => void generateVariants()}
                disabled={busy !== "idle" || prompt.trim().length < 2}
                className="rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)] px-6 py-2.5 text-sm font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)] transition hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "gen_variants" ? "三套生成中…" : "一次生成 3 套备选"}
              </button>
              <button
                type="button"
                onClick={() => void saveAndPlay()}
                disabled={busy !== "idle" || !spec}
                className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-6 py-2.5 text-sm font-medium text-[var(--gc-text)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:bg-[var(--gc-surface-glass-strong)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "save" ? "保存中…" : "保存并分享"}
              </button>
            </div>

            {busyLabel ? (
              <p className="text-xs font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_90%,white)]">{busyLabel}</p>
            ) : null}
            {busy === "gen" && stepMeta ? (
              <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[color:color-mix(in_srgb,var(--gc-accent)_55%,transparent)] border-t-[color:var(--gc-accent)]"
                      aria-hidden
                    />
                    <p className="text-xs font-semibold text-[var(--gc-text-soft)]">正在{stepText}…</p>
                  </div>
                  <p className="text-[11px] tabular-nums text-[var(--gc-text-faint)]">ETA {etaText ?? "…"}</p>
                </div>
                <p className="mt-2 text-xs text-[var(--gc-muted)]">{stepMsg}</p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--gc-border)_55%,transparent)]">
                  <div
                    className="relative h-full rounded-full bg-gradient-to-r from-[var(--gc-accent)] via-[color:color-mix(in_srgb,var(--gc-cta-b)_75%,white)] to-[var(--gc-cta-c)] transition-[width] duration-300"
                    style={{ width: `${Math.max(4, Math.floor(stepProgress * 100))}%` }}
                  >
                    <div className="absolute inset-0 animate-pulse bg-white/10" />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--gc-text-faint)]">
                  <span className="tabular-nums">进度 {Math.floor(stepProgress * 100)}%</span>
                  <span className="tabular-nums">已用时 {elapsedSec}s</span>
                </div>
              </div>
            ) : streamMsg ? (
              <p className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-2 text-xs text-[var(--gc-muted)]">
                {streamMsg}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 lg:sticky lg:top-24">
            {spec ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[color:var(--gc-border)] pb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--gc-text)]">{spec.title}</h2>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--gc-muted)]">
                      {spec.templateId} · 实时预览
                    </p>
                    {genSource ? (
                      <p className="mt-2 max-w-md text-xs leading-relaxed text-[color:color-mix(in_srgb,var(--gc-accent)_85%,white)]">
                        {SOURCE_HINT[genSource] ?? genSource}
                      </p>
                    ) : null}
                    {genDebug ? (
                      <div className="mt-2 max-w-md rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2 text-[11px] text-[var(--gc-muted)]">
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <span className="font-medium text-[var(--gc-text-soft)]">生成证据</span>
                          <span>初稿模型：{genDebug.draftModel ?? (genDebug.model ?? (genDebug.fallback ? "（已回退本地）" : "（未知）"))}</span>
                          <span>强化模型：{genDebug.enhanceModel ?? (genDebug.enhanced ? (genDebug.model ?? "（未知）") : "（未执行）")}</span>
                          <span>回退：{genDebug.fallback ? "是" : "否"}</span>
                          <span>检索：{genDebug.searchEnhance ? "开" : "关"}</span>
                          <span>强化：{genDebug.enhanced ? "开" : "关"}</span>
                          {genDebug.templateHint ? <span>模板提示：{genDebug.templateHint}</span> : null}
                        </div>
                        {genDebug.fallbackReason ? (
                          <p className="mt-2 text-[11px] text-amber-200/90">回退原因：{genDebug.fallbackReason}</p>
                        ) : null}
                        {genDebug.provider || genDebug.llmMode ? (
                          <p className="mt-2 text-[11px] text-[var(--gc-text-faint)]">
                            LLM：{genDebug.provider ?? "?"} · {genDebug.llmMode ?? "?"}
                          </p>
                        ) : null}
                        {genDebug.llmError ? (
                          <p className="mt-2 whitespace-pre-wrap break-words text-[11px] text-amber-200/90">
                            网关报错：{genDebug.llmError}
                          </p>
                        ) : null}
                        {genDebug.enhanceWarning ? (
                          <p className="mt-2 text-[11px] text-amber-200/90">强化提示：{genDebug.enhanceWarning}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void generateStream()}
                    disabled={busy !== "idle" || prompt.trim().length < 2}
                    className="text-xs font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_90%,white)] underline-offset-4 hover:underline disabled:opacity-40"
                  >
                    重新流式生成
                  </button>
                </div>

                {variants && variants.length > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    <span className="w-full text-[11px] uppercase tracking-wider text-[var(--gc-muted)]">备选方案</span>
                    {variants.map((v, i) => (
                      <button
                        key={v.label}
                        type="button"
                        onClick={() => applyVariant(variants, i)}
                        className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                          i === variantIndex
                            ? "gc-theme-cta"
                            : "border border-[color:var(--gc-border)] text-[var(--gc-muted)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:text-[var(--gc-text)]"
                        }`}
                      >
                        {v.label} · {v.spec.templateId}
                      </button>
                    ))}
                  </div>
                ) : null}

                <GamePlayer key={`${variants ? `v-${variantIndex}` : "one-shot"}-px-${refPixelEpoch}`} spec={spec} />
              </>
            ) : (
              <div className="gc-card flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <div className="h-12 w-12 rounded-2xl border border-dashed border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]" />
                <p className="max-w-xs text-sm text-[var(--gc-muted)]">
                  点击「生成可玩版本」或「三套备选」，Phaser 预览将出现在此处。
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

