"use client";

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
import {
  clearAssetManifestSession,
  summarizeAssetManifestForGenerateApi,
  writeAssetManifestToSession,
} from "@/lib/assets/asset-manifest-session.client";
import { buildAssetManifestFromReferencePayloads } from "@/lib/orchestration/asset-manifest";
import { describeQueuedAssetSummary, summarizePromptForStudio } from "@/lib/create-studio-narrative";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import type { GameSpec } from "@/lib/game-spec";
import type { OrchestrationRunTrace } from "@/lib/orchestration/run-trace";
import { consumeSSE } from "@/lib/read-sse";
import { GamePlayer } from "@/components/GamePlayer";
import { SpecQuickTunePanel } from "@/components/SpecQuickTunePanel";
import { SiteHeader } from "@/components/SiteHeader";
import { useClipboardImageQueue } from "@/providers/ClipboardImageQueueProvider";

const EXAMPLES = [
  "田园小径旁建猫舍塔楼，拦住偷萝卜的捣蛋鼠军团",
  "海底小鱼收集珍珠，避开章鱼墨汁",
  "水彩风丘陵塔防：木箭塔守萝卜田，小怪沿蜿蜒土路进攻",
];

const SOURCE_HINT: Record<string, string> = {
  llm: "大模型直接生成",
  llm_overlay: "大模型 + 本地字段融合纠错",
  llm_repair: "大模型二次修复后生成",
  mock: "已回退本地规则推断（请看下方“生成证据”里的回退原因）",
};

type VariantRow = { spec: GameSpec; source: string; label: string };

type StudioLogKind = "user" | "asset" | "intent" | "sse" | "done" | "error";
type StudioLogEntry = { id: string; t: number; kind: StudioLogKind; title: string; bullets?: string[] };

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
  /** 本地：已记入日志，尚未发起 /api/generate/stream */
  received: { label: "创意已就位", progress: 0.08, defaultMsg: "提示词摘要已在下方日志中就绪，下一步连接云端流水线…" },
  /** 本地：解析上传/剪贴板的参考素材，期间尚未进入远端队列 */
  ingest: { label: "解析参考素材", progress: 0.11, defaultMsg: "把参考图/文件写入会话并合并描述，随后再连接生成服务…" },
  /** 本地：fetch 建立中或服务端先发 start 帧之前的握手窗口 */
  handshake: { label: "连接云端", progress: 0.14, defaultMsg: "正在建立会话并把你的创意送达生成服务…" },
  /** 服务端 SSE：首帧，与后端「已接收创意」一致 */
  start: { label: "云端接单", progress: 0.16, defaultMsg: "生成服务已收到任务，稍后进入管线…" },
  prep: { label: "解读创意", progress: 0.18, defaultMsg: "把你的提示与选项整理成可执行计划…" },
  running: { label: "深度生成", progress: 0.58, defaultMsg: "大模型起草 + 本地纠错 + 规格校验（可能需几十秒～数分钟）…" },
  recap: { label: "成品摘要", progress: 0.9, defaultMsg: "提炼模板、标题与关键数值…" },
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

/** 简略 **加粗** 渲染（提要行用 Markdown 风格便于扫读） */
function EmText({ s }: { s: string }) {
  if (!s.includes("**")) return <>{s}</>;
  const segs = s.split("**");
  return (
    <>
      {segs.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-[color:color-mix(in_srgb,var(--gc-text-soft)_92%,white)]">
            {p}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** 合并 ingest 正文到创意描述末尾（单次解析一块） */
function mergeReferenceBlockIntoPrompt(head: string, block: string): string {
  const t = head.trim();
  const piece = t ? `\n\n---\n【参考素材】\n${block}` : `【参考素材】\n${block}`;
  return `${t}${piece}`.slice(0, 4000);
}

/** 从合并后的描述中取「参考素材」正文，用于拆分参考图caption */
function extractReferenceMaterialSection(merged: string): string {
  const needle = "【参考素材】";
  const i = merged.indexOf(needle);
  if (i < 0) return "";
  return merged.slice(i + needle.length).trim();
}

/** 服务端 ingest 对每个「参考图」一段描述；拆分后单列便于用户核对模型如何读图 */
function splitReferenceImageCaptions(section: string): string[] {
  if (!section.trim()) return [];
  return section
    .split(/(?=【参考图 图\d+)/g)
    .map((s) => s.trim())
    .filter((s) => s.startsWith("【参考图"));
}

export default function CreateClient(props: { initialPrompt?: string; replayFromProjectId?: string }) {
  const router = useRouter();
  const replayId = props.replayFromProjectId?.trim();

  const [prompt, setPrompt] = useState(() =>
    replayId ? "" : (props.initialPrompt ?? "").slice(0, 4000),
  );
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
    orchestrationTrace?: OrchestrationRunTrace;
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
  const [studioLog, setStudioLog] = useState<StudioLogEntry[]>([]);
  /** 与本轮流式生成绑定，卡片区展示一行「正在按此理解」摘要，避免仅显示远端阶段名而造成误解 */
  const [streamIntentBrief, setStreamIntentBrief] = useState<string | null>(null);
  const studioLogSeq = useRef(0);
  const studioLogEndRef = useRef<HTMLDivElement | null>(null);
  const [replayStatus, setReplayStatus] = useState<null | "loading" | "ok" | "error">(replayId ? "loading" : null);
  const [replayTitle, setReplayTitle] = useState<string | null>(null);
  /** 剪贴板图片队列由全站 ClipboardImageQueueProvider（AppCapabilitiesRoot）挂载 */
  const {
    rows: pastedImages,
    clearQueue: clearClipboardImageQueue,
    setRowPurpose,
  } = useClipboardImageQueue();
  /** 与「选择文件」里当前 image/* 张数同步，避免在 render 中读 ref */
  const [pickerImageCount, setPickerImageCount] = useState(0);
  /** 参考图写入 session 后递增，强制试玩区重挂 Phaser 以加载新贴图 */
  const [refPixelEpoch, setRefPixelEpoch] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const appendStudioLog = useCallback((entry: Omit<StudioLogEntry, "id" | "t"> & { id?: string }) => {
    const id = entry.id ?? `sl_${Date.now()}_${studioLogSeq.current++}`;
    setStudioLog((prev) => [...prev, { ...entry, id, t: Date.now() }]);
  }, []);

  /** 试玩页 / 工作室带入 ?from=<projectId>：加载已保存的完整描述（含此前合并进的参考摘录），省去重复上传解析 */
  useEffect(() => {
    if (!replayId) return;
    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setReplayStatus("loading");
      setReplayTitle(null);
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(replayId)}`);
        const data = (await res.json()) as {
          error?: string;
          project?: { title?: string; prompt?: string };
        };
        if (cancelled) return;
        if (!res.ok || typeof data.project?.prompt !== "string" || !data.project.prompt.trim()) {
          setReplayStatus("error");
          return;
        }
        setPrompt(data.project.prompt.trim().slice(0, 4000));
        const t = data.project.title?.trim();
        setReplayTitle(t && t.length ? t : null);
        setReplayStatus("ok");
      } catch {
        if (!cancelled) setReplayStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [replayId]);

  useEffect(() => {
    studioLogEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [studioLog]);

  const applyVariant = useCallback((rows: VariantRow[], index: number) => {
    const row = rows[index];
    if (!row) return;
    setVariantIndex(index);
    setSpec(row.spec);
    setGenSource(row.source);
    setGenDebug(null);
  }, []);

  /** 提交 /api/ingest 并写入会话贴图（「选择文件」在前、剪贴板队列在后）；供手动解析与生成前自动解析复用 */
  const performReferenceIngest = useCallback(
    async (
      baselinePrompt: string,
      opts: { includeUrlField: boolean },
    ): Promise<{ ok: true; mergedPrompt: string } | { ok: false; error: string }> => {
      const fd = new FormData();
      const roles: string[] = [];
      const files = fileRef.current?.files;
      let hasInputs = false;
      if (files?.length) {
        hasInputs = true;
        for (let i = 0; i < files.length; i += 1) {
          fd.append("files", files[i]);
          roles.push("");
        }
      }
      for (const row of pastedImages) {
        hasInputs = true;
        fd.append("files", row.file);
        roles.push(row.purpose);
      }
      if (opts.includeUrlField && ingestUrl.trim()) {
        hasInputs = true;
        fd.set("url", ingestUrl.trim());
      }
      if (!hasInputs) {
        return { ok: false, error: "请先选择至少一个素材文件，或在链接框填入 URL" };
      }
      fd.set("imageRoles", JSON.stringify(roles));
      fd.set("vision", visionOn ? "1" : "0");

      try {
        const res = await fetch("/api/ingest", { method: "POST", body: fd });
        const data = (await res.json()) as {
          text?: string;
          warnings?: string[];
          error?: string;
          referenceAssets?: ReferenceImageHandle[];
          referenceAssetStorageMode?: string;
        };
        if (!res.ok) {
          return { ok: false, error: data.error ?? "素材解析失败" };
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
          writeAssetManifestToSession(
            buildAssetManifestFromReferencePayloads(
              fit.saved.map((p) => ({ ordinal: p.ordinal, purpose: p.purpose })),
              { hint: "ingest_session_pixels" },
            ),
          );
          setRefPixelEpoch((n) => n + 1);
          if (fileRef.current) fileRef.current.value = "";
          setPickerImageCount(0);
          clearClipboardImageQueue();
        } else {
          void writeReferencePayloadsToSessionStrict([]);
          writeAssetManifestToSession(buildAssetManifestFromReferencePayloads([]));
          if (fileRef.current) fileRef.current.value = "";
          setPickerImageCount(0);
          clearClipboardImageQueue();
          setRefPixelEpoch((n) => n + 1);
        }
        if (notes.length) setIngestNotes(notes);
        else setIngestNotes(null);
        const block = (data.text ?? "").trim();
        if (Array.isArray(data.referenceAssets) && data.referenceAssets.length > 0) {
          saveReferenceHandlesToSession(data.referenceAssets);
        }
        if (!block) {
          return { ok: false, error: "未得到可合并的正文，请检查文件或链接" };
        }
        const mergedPrompt = mergeReferenceBlockIntoPrompt(baselinePrompt, block);
        setPrompt(mergedPrompt);
        return { ok: true, mergedPrompt };
      } catch {
        return { ok: false, error: "素材解析请求失败" };
      }
    },
    [clearClipboardImageQueue, ingestUrl, pastedImages, visionOn],
  );

  /** 默认：SSE 流式进度 + 单次生成 */
  const generateStream = useCallback(async () => {
    setError(null);
    let effectivePrompt = prompt;
    const hasQueuedAssetFiles = (fileRef.current?.files?.length ?? 0) > 0 || pastedImages.length > 0;
    setBusy("gen");
    const intentBrief = summarizePromptForStudio(prompt);
    setStreamIntentBrief(intentBrief);
    if (hasQueuedAssetFiles) {
      setStreamStep("ingest");
      setStreamMsg("正在解析队列中的参考素材（上传优先于剪贴板）；创意原文节选已写入下方日志…");
    } else {
      setStreamStep("received");
      setStreamMsg("创意概要已写入下方制作过程，下一步将连接云端并完成解析。");
    }
    setStreamStartedAt(Date.now());
    setEtaText(null);
    setElapsedSec(0);
    setVariants(null);
    setWebMeta(null);
    setGenDebug(null);
    setStudioLog([]);
    appendStudioLog({
      kind: "user",
      title: "你的创意原文（节选）",
      bullets: [summarizePromptForStudio(prompt)],
    });
    appendStudioLog({
      kind: "asset",
      title: "本次排队的参考素材",
      bullets: describeQueuedAssetSummary({
        fileImageCount: countImageFilesInList(fileRef.current?.files ?? null),
        pasted: pastedImages,
      }),
    });
    try {
      if (hasQueuedAssetFiles) {
        setIngestBusy(true);
        try {
          const ing = await performReferenceIngest(prompt, { includeUrlField: false });
          if (!ing.ok) {
            appendStudioLog({ kind: "error", title: "参考素材解析失败", bullets: [ing.error] });
            setError(ing.error);
            return;
          }
          effectivePrompt = ing.mergedPrompt;
          appendStudioLog({
            kind: "user",
            title: "送入模型的有效描述（素材合并后的节选）",
            bullets: [summarizePromptForStudio(effectivePrompt)],
          });
          const refSec = extractReferenceMaterialSection(effectivePrompt);
          const captions = splitReferenceImageCaptions(refSec);
          if (captions.length > 0) {
            appendStudioLog({
              kind: "intent",
              title: "参考图解读（按每张图拆分，来自多模态请求；≠ 模型的完整推理过程）",
              bullets: captions.map((c) => summarizePromptForStudio(c, 960)),
            });
          }
        } finally {
          setIngestBusy(false);
        }
      }

      setStreamStep("handshake");
      setStreamMsg(
        hasQueuedAssetFiles ? "参考素材已合并至描述；正在连接生成服务并把任务送进队列…" : "正在连接生成服务并把任务送进队列…",
      );

      const assetManifestPayload = summarizeAssetManifestForGenerateApi();
      const res = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: effectivePrompt,
          searchEnhance,
          templateHint,
          enhancePass,
          ...(assetManifestPayload ? { assetManifest: assetManifestPayload } : {}),
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        appendStudioLog({
          kind: "error",
          title: "请求未能开始生成",
          bullets: [err.error ?? `HTTP ${res.status}`],
        });
        setError(err.error ?? "生成失败");
        setStreamMsg(null);
        return;
      }

      await consumeSSE(res, (ev) => {
        const step = ev.step as string | undefined;
        const msg = ev.message as string | undefined;
        if (typeof step === "string" && step) {
          if (step === "prep") {
            const lines = Array.isArray(ev.lines)
              ? (ev.lines as unknown[]).filter((x): x is string => typeof x === "string")
              : [];
            appendStudioLog({
              kind: "intent",
              title: "系统计划（概要，非隐藏思维链）",
              bullets: lines.length ? lines : ["（无详细说明行）"],
            });
            setStreamStep("running");
            setStreamMsg("模型与本地管线运行中…");
          } else if (step === "recap") {
            const lines = Array.isArray(ev.lines)
              ? (ev.lines as unknown[]).filter((x): x is string => typeof x === "string")
              : [];
            appendStudioLog({
              kind: "sse",
              title: "本轮成品提要",
              bullets: lines.length ? lines : [],
            });
            setStreamStep("recap");
            setStreamMsg("拼装试玩所需的 GameSpec …");
          } else {
            setStreamStep(step);
            if (typeof msg === "string") setStreamMsg(msg);
          }
        } else if (typeof msg === "string") {
          setStreamMsg(msg);
        }

        if (step === "done" && ev.spec) {
          const doneSpec = ev.spec as GameSpec;
          appendStudioLog({
            kind: "done",
            title: "生成完成，已可试玩",
            bullets: [`模板：**${doneSpec.templateId}**`, `标题：**${doneSpec.title}**`],
          });
          setSpec(doneSpec);
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
              orchestrationTrace?: unknown;
            };
            const otRaw = d.orchestrationTrace;
            let orchestrationTrace: OrchestrationRunTrace | undefined;
            if (
              otRaw &&
              typeof otRaw === "object" &&
              otRaw !== null &&
              (otRaw as { schemaVersion?: unknown }).schemaVersion === 1 &&
              typeof (otRaw as { runId?: unknown }).runId === "string" &&
              Array.isArray((otRaw as { steps?: unknown }).steps)
            ) {
              orchestrationTrace = otRaw as OrchestrationRunTrace;
            }
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
              orchestrationTrace,
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
          appendStudioLog({
            kind: "error",
            title: "生成过程异常",
            bullets: [typeof msg === "string" ? msg : "未知错误"],
          });
          setError(typeof msg === "string" ? msg : "生成失败");
        }
      });
    } catch {
      appendStudioLog({ kind: "error", title: "网络异常", bullets: ["请检查本地网络或稍后重试。"] });
      setError("网络异常");
    } finally {
      setBusy("idle");
      setStreamMsg(null);
      setEtaText(null);
      setElapsedSec(0);
      setStreamIntentBrief(null);
    }
  }, [appendStudioLog, enhancePass, pastedImages, performReferenceIngest, prompt, searchEnhance, templateHint]);

  /** 并行三套备选（风味后缀不同） */
  const generateVariants = useCallback(async () => {
    setError(null);
    let effectivePrompt = prompt;
    const hasQueuedAssetFiles = (fileRef.current?.files?.length ?? 0) > 0 || pastedImages.length > 0;
    setStreamMsg(null);
    setBusy("gen_variants");
    setWebMeta(null);
    setGenDebug(null);
    setStudioLog([]);
    appendStudioLog({
      kind: "sse",
      title: "多套并行模式",
      bullets: [
        "同时请求 3 份带不同风味后缀的 GameSpec；完成后用右侧「备选方案」切换预览。",
        summarizePromptForStudio(prompt),
      ],
    });
    try {
      if (hasQueuedAssetFiles) {
        setIngestBusy(true);
        try {
          const ing = await performReferenceIngest(prompt, { includeUrlField: false });
          if (!ing.ok) {
            appendStudioLog({ kind: "error", title: "参考素材解析失败", bullets: [ing.error] });
            setError(ing.error);
            return;
          }
          effectivePrompt = ing.mergedPrompt;
        } finally {
          setIngestBusy(false);
        }
      }

      const assetManifestPayload = summarizeAssetManifestForGenerateApi();
      const res = await fetch("/api/generate/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: effectivePrompt,
          count: 3,
          searchEnhance,
          templateHint,
          enhancePass,
          ...(assetManifestPayload ? { assetManifest: assetManifestPayload } : {}),
        }),
      });
      const data = (await res.json()) as {
        variants?: VariantRow[];
        error?: string;
      };
      if (!res.ok) {
        appendStudioLog({
          kind: "error",
          title: "多套生成被拒绝",
          bullets: [data.error ?? `HTTP ${res.status}`],
        });
        setError(data.error ?? "多套生成失败");
        return;
      }
      const rows = data.variants ?? [];
      if (rows.length === 0) {
        appendStudioLog({
          kind: "error",
          title: "未返回备选方案",
          bullets: ["服务端返回空数组，请稍后重试。"],
        });
        setError("未返回备选方案");
        return;
      }
      appendStudioLog({
        kind: "done",
        title: "多套方案就绪",
        bullets: rows.map((v) => `${v.label} · ${v.spec.templateId} · 《${v.spec.title}》`),
      });
      setVariants(rows);
      applyVariant(rows, 0);
    } catch {
      appendStudioLog({ kind: "error", title: "多套生成异常", bullets: ["网络或服务端异常"] });
      setError("网络异常");
    } finally {
      setBusy("idle");
    }
  }, [appendStudioLog, applyVariant, enhancePass, pastedImages, performReferenceIngest, prompt, searchEnhance, templateHint]);

  useEffect(() => {
    if (busy !== "gen") return;
    if (!streamStartedAt) return;
    const timer = window.setInterval(() => {
      const step = streamStep ?? "running";
      const meta = STEP_META[step] ?? STEP_META.running;
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
      const r = await performReferenceIngest(prompt, { includeUrlField: true });
      if (!r.ok) setError(r.error);
    } finally {
      setIngestBusy(false);
    }
  }, [performReferenceIngest, prompt]);

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

  const len = prompt.length;
  const busyLabel =
    busy === "gen" ? "生成中…" : busy === "gen_variants" ? "并行生成多套方案…" : busy === "save" ? "保存中…" : null;

  const stepMeta = STEP_META[streamStep ?? ""] ?? (busy === "gen" ? STEP_META.running : null);
  const stepProgress = stepMeta?.progress ?? 0;
  const stepText = stepMeta?.label ?? "";
  const stepMsg = streamMsg || stepMeta?.defaultMsg || "";

  return (
    <div className="flex min-h-full flex-1 flex-col text-[var(--gc-text)] lg:flex-row">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-10 px-4 py-10 lg:gap-14 lg:px-8 xl:pr-12">
        <header className="max-w-2xl space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--gc-text)]">创作台</h1>
          <p className="text-sm leading-relaxed text-[var(--gc-muted)]">
            描述一句话，AI 生成规格并即时试玩。支持<strong className="text-[var(--gc-text-soft)]">流式进度</strong>与<strong className="text-[var(--gc-text-soft)]">三套并行备选</strong>。
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
              {replayStatus === "loading" ? (
                <p className="text-xs text-[var(--gc-muted)]">正在从作品库载入上一次保存的完整描述…</p>
              ) : null}
              {replayStatus === "error" ? (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  无法根据链接载入作品描述（可能已删除或非本环境作品）。请到<strong className="text-amber-100">工作室</strong>
                  里对该作品使用「再生成」，或从历史试玩页入口打开。
                </p>
              ) : null}
              {replayStatus === "ok" ? (
                <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs leading-relaxed text-emerald-100/95">
                  已从<strong className="text-emerald-50">{replayTitle ? `《${replayTitle}》` : "已保存作品"}</strong>
                  载入描述（包含此前合并进来的参考图文摘录）。可直接点<strong>「生成可玩版本」</strong>
                  ，一般无需再选文件。<span className="text-emerald-200/85">
                    若要在试玩里恢复参考图的像素贴片，需在本地浏览器会话重新上传素材（服务端目前只存文本与规格）。
                  </span>
                </p>
              ) : null}
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
                <p className="mt-2 text-sm font-medium text-[color:color-mix(in_srgb,var(--gc-cta-c)_90%,white)]">
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

              {/* 一行摘要 + 悬停展开详情 */}
              <div className="mt-2 flex items-start gap-1.5">
                <p className="text-[11px] leading-snug text-[var(--gc-muted)]">
                  PNG/WebP/GIF 保留透明通道；贴片类自动收入精灵格；需填用途
                </p>
                <span className="group/tip1 relative shrink-0">
                  <span className="cursor-help select-none rounded-full border border-[color:var(--gc-border)] px-1.5 py-0.5 text-[10px] text-[var(--gc-text-faint)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] hover:text-[var(--gc-text-soft)]">?</span>
                  <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-50 w-72 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] p-3 text-[10px] leading-relaxed text-[var(--gc-muted)] opacity-0 shadow-2xl transition-opacity duration-150 group-hover/tip1:opacity-100">
                    PNG/WebP/GIF 写入会话时<strong className="text-[var(--gc-text-soft)]">保留透明通道</strong>（不再误铺白底）。剪贴板队列里请为每张图填<strong className="text-[var(--gc-text-soft)]">用途</strong>：标成怪/敌/主角/塔等<strong className="text-[var(--gc-text-soft)]">贴片类</strong>时，会自动<strong className="text-[var(--gc-text-soft)]">居中收入方形精灵格</strong>便于塔防行军；大地图背景不要标成怪/塔以免被裁格。<strong className="text-[var(--gc-text-soft)]">服务端不做 AI 抠图</strong>，复杂实拍请自行出透明底。勾选「解读参考图」后模型会按图补充「落地建议」。
                  </span>
                </span>
              </div>

              {/* 素材用途速查：告知用户每类图上传后的效果 */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {([
                  { emoji: "🗺️", label: "背景地图", desc: "全屏底图，用途填「背景」" },
                  { emoji: "👾", label: "敌人贴图", desc: "塔防行军怪，用途填「怪/敌」" },
                  { emoji: "🏰", label: "守护目标", desc: "路径终点保护物，用途填「主角/萝卜」" },
                  { emoji: "🗼", label: "防御塔皮肤", desc: "塔的外观，用途填「塔」" },
                ] as const).map((t) => (
                  <span
                    key={t.label}
                    title={t.desc}
                    className="flex cursor-default items-center gap-1 rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-2 py-0.5 text-[10px] text-[var(--gc-text-faint)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,transparent)] hover:text-[var(--gc-text-soft)]"
                  >
                    <span>{t.emoji}</span>
                    <span>{t.label}</span>
                  </span>
                ))}
                <span className="flex items-center text-[10px] text-[var(--gc-text-faint)] italic ml-0.5">
                  不上传也可直接生成，平台会自动绘制角色
                </span>
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
                      <option value="shooter">射击</option>
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
              <p className="mt-2 text-xs font-medium text-[var(--gc-text-soft)]">
                点击「生成」时队列里的素材会自动解析合并；链接框需单独点「解析并追加」
                <span className="group/tip2 relative ml-1.5 inline-block align-middle">
                  <span className="cursor-help select-none rounded-full border border-[color:var(--gc-border)] px-1.5 py-0.5 text-[10px] text-[var(--gc-text-faint)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] hover:text-[var(--gc-text-soft)]">?</span>
                  <span className="pointer-events-none absolute bottom-[calc(100%+6px)] right-0 z-50 w-80 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] p-3 text-[10px] leading-relaxed text-[var(--gc-muted)] opacity-0 shadow-2xl transition-opacity duration-150 group-hover/tip2:opacity-100">
                    点击「生成」时，若队列里仍有「选择文件」或剪贴板粘贴的素材，会先自动走一遍解析并追加到描述（本地上传排在剪贴板图片之前）；上方的链接框不会自动带入，需单独点「解析并追加」。<br /><br />
                    支持上传 PDF / DOCX / TXT / MD / 图片，或<strong className="text-[var(--gc-text-soft)]">Ctrl+V / ⌘V 粘贴截图</strong>，或粘贴公开网页链接。写入会话前会<strong className="text-[var(--gc-text-soft)]">自动缩图压缩</strong>；超出存储上限则自动降质或从末尾删图，无需手动处理。塔防试玩会按用途把<strong className="text-[var(--gc-text-soft)]">背景地图类</strong>作底图、<strong className="text-[var(--gc-text-soft)]">怪物类</strong>作敌军贴图。
                  </span>
                </span>
              </p>
              {pastedImages.length > 0 ? (
                <div className="mt-3 space-y-2 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[color:color-mix(in_srgb,var(--gc-accent)_80%,white)]">
                    <span>剪贴板待解析：{pastedImages.length} 张（用途会一并提交）</span>
                    <button
                      type="button"
                      onClick={() => {
                        clearClipboardImageQueue();
                        clearReferenceImagePayloadsSession();
                        clearAssetManifestSession();
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
                            onChange={(e) => setRowPurpose(row.id, e.target.value)}
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

            {(busy === "gen" || studioLog.length > 0) && (
              <div className="space-y-2">
                {busy === "gen" && stepMeta ? (
                  <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[color:color-mix(in_srgb,var(--gc-accent)_55%,transparent)] border-t-[color:var(--gc-accent)]"
                          aria-hidden
                        />
                        <p className="text-xs font-semibold text-[var(--gc-text-soft)]">阶段：{stepText}</p>
                      </div>
                      <p className="text-[11px] tabular-nums text-[var(--gc-text-faint)]">ETA {etaText ?? "…"}</p>
                    </div>
                    {streamIntentBrief ? (
                      <p className="mt-1 text-[11px] leading-snug text-[var(--gc-text-faint)]">
                        当前按此理解你的创意：<span className="text-[var(--gc-muted)]">{streamIntentBrief}</span>
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs leading-relaxed text-[var(--gc-muted)]">{stepMsg}</p>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--gc-border)_55%,transparent)]">
                      <div
                        className="relative h-full rounded-full bg-gradient-to-r from-[var(--gc-accent)] via-[color:color-mix(in_srgb,var(--gc-cta-b)_75%,white)] to-[var(--gc-cta-c)] transition-[width] duration-300"
                        style={{ width: `${Math.max(4, Math.floor(stepProgress * 100))}%` }}
                      >
                        <div className="absolute inset-0 animate-pulse bg-white/10" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--gc-text-faint)]">
                      <span className="tabular-nums">粗略进度 {Math.floor(stepProgress * 100)}%</span>
                      <span className="tabular-nums">已用时 {elapsedSec}s</span>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--gc-accent)_25%,var(--gc-border))] bg-[var(--gc-bg-elevated)]/85 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--gc-muted)]">制作过程 · 滚动可见</p>
                  <div className="mt-2 max-h-72 min-h-[4.5rem] space-y-2 overflow-y-auto pr-1 text-[11px] leading-relaxed [scrollbar-width:thin]">
                    {studioLog.length === 0 ? (
                      <p className="text-[var(--gc-text-faint)]">开始流式生成后，这里会持续追加提示词摘要、素材与系统提要。</p>
                    ) : (
                      studioLog.map((entry) => (
                        <div
                          key={entry.id}
                          className={`rounded-lg border px-2.5 py-2 ${
                            entry.kind === "error"
                              ? "border-red-500/30 bg-red-500/10"
                              : entry.kind === "done"
                                ? "border-emerald-500/25 bg-emerald-500/10"
                                : "border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]"
                          }`}
                        >
                          <p className="text-[10px] tabular-nums text-[var(--gc-text-faint)]">
                            {new Date(entry.t).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </p>
                          <p className="mt-1 font-semibold text-[var(--gc-text-soft)]">{entry.title}</p>
                          {entry.bullets?.length ? (
                            <ul className="mt-1.5 list-inside list-disc space-y-1 text-[var(--gc-muted)]">
                              {entry.bullets.map((b, idx) => (
                                <li key={idx}>
                                  <EmText s={b} />
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))
                    )}
                    <div ref={studioLogEndRef} />
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--gc-text-faint)]">
                    说明：计划摘要为规则与安全文案，不包含模型隐性推理全文；后端耗时段会停留在「深度生成」。
                  </p>
                </div>
              </div>
            )}

            {busy !== "gen" && ingestBusy ? (
              <p className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-2 text-xs text-[var(--gc-muted)]">
                素材解析进行中…（上传优先于剪贴板）
              </p>
            ) : null}

            {!studioLog.length && streamMsg ? (
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
                        {(() => {
                          const ot = genDebug.orchestrationTrace;
                          const step = ot?.steps.find((s) => s.name === "client_asset_manifest");
                          const det = step?.detail;
                          const cnt = typeof det?.itemCount === "number" ? det.itemCount : null;
                          const revNum = typeof det?.revision === "number" ? det.revision : null;
                          if (cnt === null) return null;
                          return (
                            <p className="mt-2 text-[11px] text-[var(--gc-muted)]">
                              会话参考图条目（编排记录）：{cnt}
                              {revNum !== null ? ` · revision ${revNum}` : ""}
                            </p>
                          );
                        })()}
                        {genDebug.orchestrationTrace ? (
                          <details className="mt-2 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)]/30 px-2 py-1.5">
                            <summary className="cursor-pointer text-[10px] font-medium text-[var(--gc-text-soft)]">
                              编排追踪（Phase 0）· {genDebug.orchestrationTrace.steps.length} 步 ·{" "}
                              {(genDebug.orchestrationTrace.totalMs / 1000).toFixed(2)}s
                            </summary>
                            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[9px] leading-snug text-[var(--gc-text-faint)]">
                              {JSON.stringify(genDebug.orchestrationTrace, null, 2)}
                            </pre>
                          </details>
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
                <SpecQuickTunePanel spec={spec} onChange={(next) => setSpec(next)} />
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

