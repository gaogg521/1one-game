"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import {
  buildCoCreationDirections,
  buildCoCreationIntent,
  describeQueuedAssetSummary,
  summarizePromptForStudio,
} from "@/lib/create-studio-narrative";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import type { GameSpec } from "@/lib/game-spec";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";
import type { OrchestrationRunTrace } from "@/lib/orchestration/run-trace";
import { consumeSSE } from "@/lib/read-sse";
import { GamePlayer } from "@/components/GamePlayer";
import { GameRuntimeTabs } from "@/components/GameRuntimeTabs";
import { GameRuntimePreferenceControl } from "@/components/GameRuntimePreferenceControl";
import { readReferenceImagePayloadsFromSession } from "@/lib/assets/reference-image-payloads.client";
import { readReferenceHandlesFromSession } from "@/lib/assets/reference-image-storage.client";
import { prefetchGodotExport } from "@/lib/godot-prefetch.client";
import { isGodotExportSupported } from "@/lib/godot-spec-bridge-codegen";
import { PRODUCT } from "@/lib/product-config";
import { CreativeBriefPanel } from "@/components/CreativeBriefPanel";
import { SpecQuickTunePanel } from "@/components/SpecQuickTunePanel";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import {
  buildPromptWithBriefRevision,
  type BriefUserRevision,
} from "@/lib/creative-brief/format-revision";
import type { CreativeBrief } from "@/lib/creative-brief/types";
import { CREATIVE_BRIEF_SCHEMA } from "@/lib/creative-brief/types";
import { useClipboardImageQueue } from "@/providers/ClipboardImageQueueProvider";
import { loadDraft, markDraftGenerating } from "@/lib/draft-storage";
import { useQuotaExceededModal } from "@/components/commerce/QuotaExceededModal";
import { parseQuotaExceeded } from "@/lib/commerce/quota-error";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

const STEP_PROGRESS: Record<string, number> = {
  received: 0.08,
  ingest: 0.11,
  handshake: 0.14,
  start: 0.16,
  brief: 0.2,
  prep: 0.18,
  running: 0.58,
  recap: 0.9,
  done: 1,
  error: 1,
};

function formatEta(ms: number, minutesLabel: (m: number) => string): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s <= 8) return `${s}s`;
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return minutesLabel(m);
}

type VariantRow = { spec: GameSpec; source: string; label: string };
type CoCreationIntent = ReturnType<typeof buildCoCreationIntent>;
type CoCreationDirection = ReturnType<typeof buildCoCreationDirections>[number];

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

async function checkSpriteFile(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function waitForSprites(projectId: string, timeoutMs = 300_000, intervalMs = 5000): Promise<boolean> {
  const kinds = ["player", "hazard", "gem", "power", "boss"];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const results = await Promise.all(
      kinds.map((k) => checkSpriteFile(`/game-sprites/${projectId}/${k}.png`)),
    );
    if (results.every(Boolean)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

export default function CreateClient(props: { initialPrompt?: string; replayFromProjectId?: string }) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("createFlow");
  const replayId = props.replayFromProjectId?.trim();

  const refStrong = (chunks: ReactNode) => (
    <strong className="text-[var(--gc-text-soft)]">{chunks}</strong>
  );

  const examples = [t("examples.0"), t("examples.1"), t("examples.2")];

  const resolveStepMeta = useCallback(
    (step: string) => {
      const key = step in STEP_PROGRESS ? step : "running";
      return {
        label: t(`steps.${key}.label`),
        progress: STEP_PROGRESS[key] ?? STEP_PROGRESS.running,
        defaultMsg: t(`steps.${key}.defaultMsg`),
      };
    },
    [t],
  );

  const [prompt, setPrompt] = useState(() =>
    replayId
      ? ""
      : (() => {
          const initial = (props.initialPrompt ?? "").slice(0, 4000);
          if (initial.trim()) return initial;
          const draft = loadDraft("game");
          return draft?.prompt && !draft.generatedId ? draft.prompt : initial;
        })(),
  );
  const [busy, setBusy] = useState<"idle" | "gen" | "gen_variants" | "save" | "sprites">("idle");
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
  const [projectId, setProjectId] = useState<string | null>(replayId ?? null);
  const [creationMode, setCreationMode] = useState<"flow" | "generated">("flow");
  const [coCreationIntent, setCoCreationIntent] = useState<CoCreationIntent | null>(null);
  const [coDirections, setCoDirections] = useState<CoCreationDirection[]>([]);
  const [selectedDirectionId, setSelectedDirectionId] = useState<string | null>(null);
  const [coCreationStep, setCoCreationStep] = useState<1 | 2 | 3 | 4>(1);
  /** 与本轮流式生成绑定，卡片区展示一行「正在按此理解」摘要，避免仅显示远端阶段名而造成误解 */
  const [streamIntentBrief, setStreamIntentBrief] = useState<string | null>(null);
  const [creativeBrief, setCreativeBrief] = useState<CreativeBrief | null>(null);
  const [creativeBriefSummary, setCreativeBriefSummary] = useState<string | null>(null);
  const [briefRevision, setBriefRevision] = useState<BriefUserRevision | null>(null);
  const studioLogSeq = useRef(0);
  const studioLogEndRef = useRef<HTMLDivElement | null>(null);
  const [replayStatus, setReplayStatus] = useState<null | "loading" | "ok" | "error">(replayId ? "loading" : null);
  const [replayTitle, setReplayTitle] = useState<string | null>(null);
  const [replayRefinements, setReplayRefinements] = useState<Array<{ at: string; mode: string; instruction: string }>>(
    [],
  );
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
  const { showQuotaExceeded, QuotaModal } = useQuotaExceededModal();
  const [showStudioDetails, setShowStudioDetails] = useState(false);

  /** 生成完成后后台预导出 Godot，切换引擎时尽量命中缓存 */
  useEffect(() => {
    if (!spec || !PRODUCT.godot.enabled || !isGodotExportSupported(spec)) return;
    const refs = readReferenceImagePayloadsFromSession();
    const handles = readReferenceHandlesFromSession();
    prefetchGodotExport(spec, { referencePayloads: refs, referenceHandles: handles });
  }, [spec, refPixelEpoch]);

  const appendStudioLog = useCallback((entry: Omit<StudioLogEntry, "id" | "t"> & { id?: string }) => {
    const id = entry.id ?? `sl_${Date.now()}_${studioLogSeq.current++}`;
    setStudioLog((prev) => [...prev, { ...entry, id, t: Date.now() }]);
  }, []);

  const currentDirection =
    selectedDirectionId && coDirections.length ? coDirections.find((x) => x.id === selectedDirectionId) ?? null : null;

  const effectivePromptForGeneration = currentDirection
    ? `${prompt.trim()}\n\n${currentDirection.promptAddon}`.trim().slice(0, 4000)
    : prompt.trim();

  const buildCoCreationPlan = useCallback(() => {
    const intent = buildCoCreationIntent(prompt, templateHint, locale);
    const directions = buildCoCreationDirections(intent, locale);
    setCoCreationIntent(intent);
    setCoDirections(directions);
    setSelectedDirectionId(directions[0]?.id ?? null);
    setCoCreationStep(2);
    setCreationMode("flow");
    appendStudioLog({
      kind: "intent",
      title: t("log.intentExtracted"),
      bullets: [
        intent.premise,
        t("intent.targetTemplate", { templateId: intent.templateId }),
        t("intent.gameplayCore", { core: intent.gameplayCore }),
        ...intent.strengths,
      ],
    });
    if (intent.risks.length) {
      appendStudioLog({ kind: "sse", title: t("log.risksRemain"), bullets: intent.risks });
    }
  }, [appendStudioLog, locale, prompt, t, templateHint]);

  const chooseCoCreationDirection = useCallback(
    (directionId: string) => {
      const row = coDirections.find((item) => item.id === directionId);
      if (!row) return;
      setSelectedDirectionId(directionId);
      setCoCreationStep(3);
      appendStudioLog({
        kind: "sse",
        title: t("log.directionChosen", { title: row.title }),
        bullets: [row.summary, ...row.bullets],
      });
    },
    [appendStudioLog, coDirections, t],
  );

  /** 试玩页 / 工作室带入 ?from=<projectId>：加载已保存的完整描述（含此前合并进的参考摘录），省去重复上传解析 */
  useEffect(() => {
    if (!replayId) return;
    let cancelled = false;

    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setReplayStatus("loading");
      setReplayTitle(null);
      setReplayRefinements([]);
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(replayId)}`);
        const data = (await res.json()) as {
          error?: string;
          project?: { id?: string; title?: string; prompt?: string };
          spec?: GameSpec;
          creativeBrief?: CreativeBrief;
          refinementHistory?: Array<{ at: string; mode: string; instruction: string }>;
        };
        if (cancelled) return;
        if (!res.ok || typeof data.project?.prompt !== "string" || !data.project.prompt.trim()) {
          setReplayStatus("error");
          return;
        }
        setPrompt(data.project.prompt.trim().slice(0, 4000));
        setProjectId(data.project.id ?? replayId);
        if (data.spec) {
          setSpec(data.spec);
          setCreationMode("generated");
          setCoCreationStep(4);
        }
        if (data.creativeBrief) {
          setCreativeBrief(data.creativeBrief);
        }
        if (Array.isArray(data.refinementHistory)) {
          setReplayRefinements(data.refinementHistory);
        } else {
          setReplayRefinements([]);
        }
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
        return { ok: false, error: t("errors.noAssets") };
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
          return { ok: false, error: data.error ?? t("errors.ingestFailed") };
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
          if (fit.qualityReduced) parts.push(t("ingest.qualityReduced"));
          if (fit.removedCount > 0) parts.push(t("ingest.removedImages", { count: fit.removedCount }));
          if (parts.length) notes.push(parts.join("；") + t("ingest.storageSuffix"));
          if (fit.saved.length === 0) {
            notes.push(t("ingest.storageFailed"));
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
          return { ok: false, error: t("errors.noMergeText") };
        }
        const mergedPrompt = mergeReferenceBlockIntoPrompt(baselinePrompt, block);
        setPrompt(mergedPrompt);
        return { ok: true, mergedPrompt };
      } catch {
        return { ok: false, error: t("errors.ingestRequestFailed") };
      }
    },
    [clearClipboardImageQueue, ingestUrl, pastedImages, t, visionOn],
  );

  /** 默认：SSE 流式进度 + 单次生成 */
  const generateStream = useCallback(async () => {
    setError(null);
    let effectivePrompt = effectivePromptForGeneration;
    const hasQueuedAssetFiles = (fileRef.current?.files?.length ?? 0) > 0 || pastedImages.length > 0;
    const hasIngestUrl = ingestUrl.trim().length > 0;
    setBusy("gen");
    const intentBrief = summarizePromptForStudio(prompt, locale);
    setStreamIntentBrief(intentBrief);
    setCreativeBrief(null);
    setCreativeBriefSummary(null);
    setBriefRevision(null);
    if (hasQueuedAssetFiles || hasIngestUrl) {
      setStreamStep("ingest");
      setStreamMsg(
        hasQueuedAssetFiles
          ? t("stream.ingestQueue")
          : t("stream.ingestUrl"),
      );
    } else {
      setStreamStep("received");
      setStreamMsg(t("stream.briefWritten"));
    }
    setStreamStartedAt(Date.now());
    setEtaText(null);
    setElapsedSec(0);
    setVariants(null);
    setWebMeta(null);
    setGenDebug(null);
    setStudioLog([]);
    setCreationMode("generated");
    setCoCreationStep(4);
    markDraftGenerating("game", prompt);
    appendStudioLog({
      kind: "user",
      title: t("log.promptExcerpt"),
      bullets: [summarizePromptForStudio(prompt, locale)],
    });
    if (currentDirection) {
      appendStudioLog({
        kind: "intent",
        title: t("log.directionForGeneration"),
        bullets: [currentDirection.title, currentDirection.summary, ...currentDirection.bullets],
      });
    }
    appendStudioLog({
      kind: "asset",
      title: t("log.queuedAssets"),
      bullets: describeQueuedAssetSummary(
        {
          fileImageCount: countImageFilesInList(fileRef.current?.files ?? null),
          pasted: pastedImages,
        },
        locale,
      ),
    });
    try {
      if (hasQueuedAssetFiles || hasIngestUrl) {
        setIngestBusy(true);
        try {
          const ing = await performReferenceIngest(prompt, { includeUrlField: true });
          if (!ing.ok) {
            appendStudioLog({ kind: "error", title: t("log.ingestFailed"), bullets: [ing.error] });
            setError(ing.error);
            return;
          }
          effectivePrompt = ing.mergedPrompt;
          appendStudioLog({
            kind: "user",
            title: t("log.effectivePrompt"),
            bullets: [summarizePromptForStudio(effectivePrompt)],
          });
          const refSec = extractReferenceMaterialSection(effectivePrompt);
          const captions = splitReferenceImageCaptions(refSec);
          if (captions.length > 0) {
            appendStudioLog({
              kind: "intent",
              title: t("log.imageCaptions"),
              bullets: captions.map((c) => summarizePromptForStudio(c, locale, 960)),
            });
          }
        } finally {
          setIngestBusy(false);
        }
      }

      setStreamStep("handshake");
      setStreamMsg(
        hasQueuedAssetFiles || hasIngestUrl
          ? t("stream.mergedConnecting")
          : t("stream.connecting"),
      );

      const assetManifestPayload = summarizeAssetManifestForGenerateApi();
      let sendPrompt = effectivePrompt;
      if (creativeBrief && briefRevision) {
        sendPrompt = buildPromptWithBriefRevision(prompt.trim(), creativeBrief, briefRevision);
        const refMarker = effectivePrompt.indexOf("【参考素材】");
        if (refMarker >= 0) {
          sendPrompt = `${sendPrompt.slice(0, 3600)}\n\n${effectivePrompt.slice(refMarker)}`.slice(0, 4000);
        }
      }
      const res = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: sendPrompt,
          searchEnhance,
          templateHint,
          enhancePass,
          ...(assetManifestPayload ? { assetManifest: assetManifestPayload } : {}),
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        const quota = parseQuotaExceeded(err, res.status);
        if (quota) {
          showQuotaExceeded(quota);
          setStreamMsg(null);
          return;
        }
        appendStudioLog({
          kind: "error",
          title: t("log.requestFailed"),
          bullets: [err.error ?? `HTTP ${res.status}`],
        });
        setError(err.error ?? t("errors.generateFailed"));
        setStreamMsg(null);
        return;
      }

      await consumeSSE(res, (ev) => {
        const step = ev.step as string | undefined;
        const msg = ev.message as string | undefined;
        if (typeof step === "string" && step) {
          if (step === "brief") {
            const summary = typeof ev.summary === "string" ? ev.summary : null;
            const lines = Array.isArray(ev.lines)
              ? (ev.lines as unknown[]).filter((x): x is string => typeof x === "string")
              : [];
            if (summary) {
              setStreamIntentBrief(summary);
              setCreativeBriefSummary(summary);
            }
            const briefRaw = ev.brief;
            const briefOk = CREATIVE_BRIEF_SCHEMA.safeParse(briefRaw);
            if (briefOk.success) setCreativeBrief(briefOk.data);
            appendStudioLog({
              kind: "intent",
              title: t("log.briefExpanded"),
              bullets: lines.length ? lines : summary ? [summary] : [t("log.noBriefLines")],
            });
            setStreamStep("brief");
            setStreamMsg(t("stream.briefReady"));
          } else if (step === "prep") {
            const lines = Array.isArray(ev.lines)
              ? (ev.lines as unknown[]).filter((x): x is string => typeof x === "string")
              : [];
            appendStudioLog({
              kind: "intent",
              title: t("log.systemPlan"),
              bullets: lines.length ? lines : [t("log.noPlanLines")],
            });
            setStreamStep("running");
            setStreamMsg(t("stream.pipelineRunning"));
          } else if (step === "recap") {
            const lines = Array.isArray(ev.lines)
              ? (ev.lines as unknown[]).filter((x): x is string => typeof x === "string")
              : [];
            appendStudioLog({
              kind: "sse",
              title: t("log.recapTitle"),
              bullets: lines.length ? lines : [],
            });
            setStreamStep("recap");
            setStreamMsg(t("stream.assemblingSpec"));
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
            title: t("log.generationDone"),
            bullets: [
              t("done.template", { templateId: doneSpec.templateId }),
              t("done.title", { title: doneSpec.title }),
            ],
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
              creativeBrief?: unknown;
              briefSummary?: unknown;
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
            const briefParsed = CREATIVE_BRIEF_SCHEMA.safeParse(d.creativeBrief);
            if (briefParsed.success) setCreativeBrief(briefParsed.data);
            if (typeof d.briefSummary === "string") {
              setCreativeBriefSummary(d.briefSummary);
              setStreamIntentBrief(d.briefSummary);
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
            title: t("log.generationError"),
            bullets: [typeof msg === "string" ? msg : t("log.unknownError")],
          });
          setError(typeof msg === "string" ? msg : t("errors.generateFailed"));
        }
      }, { locale });
    } catch {
      appendStudioLog({ kind: "error", title: t("log.networkError"), bullets: [t("log.networkErrorHint")] });
      setError(t("errors.network"));
    } finally {
      setBusy("idle");
      setStreamMsg(null);
      setEtaText(null);
      setElapsedSec(0);
      setStreamIntentBrief(null);
    }
  }, [
    appendStudioLog,
    currentDirection,
    effectivePromptForGeneration,
    enhancePass,
    ingestUrl,
    pastedImages,
    performReferenceIngest,
    prompt,
    searchEnhance,
    t,
    templateHint,
  ]);

  /** 并行三套备选（风味后缀不同） */
  const generateVariants = useCallback(async () => {
    setError(null);
    let effectivePrompt = effectivePromptForGeneration;
    const hasQueuedAssetFiles = (fileRef.current?.files?.length ?? 0) > 0 || pastedImages.length > 0;
    const hasIngestUrl = ingestUrl.trim().length > 0;
    setStreamMsg(null);
    setBusy("gen_variants");
    setWebMeta(null);
    setGenDebug(null);
    setStudioLog([]);
    setCreationMode("generated");
    setCoCreationStep(4);
    appendStudioLog({
      kind: "sse",
      title: t("log.variantsParallel"),
      bullets: [t("log.variantsParallelHint"), summarizePromptForStudio(prompt, locale)],
    });
    try {
      if (hasQueuedAssetFiles || hasIngestUrl) {
        setIngestBusy(true);
        try {
          const ing = await performReferenceIngest(prompt, { includeUrlField: true });
          if (!ing.ok) {
            appendStudioLog({ kind: "error", title: t("log.ingestFailed"), bullets: [ing.error] });
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
        const quota = parseQuotaExceeded(data, res.status);
        if (quota) {
          showQuotaExceeded(quota);
          return;
        }
        appendStudioLog({
          kind: "error",
          title: t("log.variantsRejected"),
          bullets: [data.error ?? `HTTP ${res.status}`],
        });
        setError(data.error ?? t("errors.variantsFailed"));
        return;
      }
      const rows = data.variants ?? [];
      if (rows.length === 0) {
        appendStudioLog({
          kind: "error",
          title: t("log.variantsEmpty"),
          bullets: [t("log.variantsEmptyHint")],
        });
        setError(t("errors.noVariants"));
        return;
      }
      appendStudioLog({
        kind: "done",
        title: t("log.variantsReady"),
        bullets: rows.map((v) =>
          t("variants.readyLine", { label: v.label, templateId: v.spec.templateId, title: v.spec.title }),
        ),
      });
      setVariants(rows);
      applyVariant(rows, 0);
    } catch {
      appendStudioLog({ kind: "error", title: t("log.variantsFailed"), bullets: [t("log.variantsFailedHint")] });
      setError(t("errors.network"));
    } finally {
      setBusy("idle");
    }
  }, [
    appendStudioLog,
    applyVariant,
    effectivePromptForGeneration,
    enhancePass,
    pastedImages,
    performReferenceIngest,
    prompt,
    searchEnhance,
    t,
    templateHint,
  ]);

  useEffect(() => {
    if (busy !== "gen") return;
    if (!streamStartedAt) return;
    const timer = window.setInterval(() => {
      const step = streamStep ?? "running";
      const meta = resolveStepMeta(step);
      const now = Date.now();
      const elapsed = now - streamStartedAt;
      setElapsedSec(Math.max(0, Math.round(elapsed / 1000)));
      const pct = Math.max(0.05, Math.min(0.98, meta.progress));
      const estTotal = Math.min(9 * 60_000, Math.max(10_000, Math.round(elapsed / pct)));
      const remain = Math.max(0, estTotal - elapsed);
      setEtaText(formatEta(remain, (m) => t("etaMinutes", { m })));
    }, 300);
    return () => window.clearInterval(timer);
  }, [busy, resolveStepMeta, streamStartedAt, streamStep, t]);

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
      let specToSave: GameSpec;
      try {
        specToSave = prepareGameSpecForPersist(spec, prompt);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("errors.invalidSpec"));
        return;
      }
      const isUpdate = Boolean(projectId);
      const res = await fetch(isUpdate ? `/api/projects/${projectId}` : "/api/projects", {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          spec: specToSave,
          ...(creativeBrief ? { creativeBrief } : {}),
        }),
      });
      const data = (await res.json()) as { project?: { id: string }; error?: string };
      if (!res.ok) {
        setError(data.error ?? t("errors.saveFailed"));
        return;
      }
      if (!isUpdate && !data.project?.id) {
        setError(t("errors.noProjectId"));
        return;
      }
      const nextProjectId = data.project?.id ?? projectId;
      if (!nextProjectId) {
        setError(t("errors.noProjectId"));
        return;
      }
      setProjectId(nextProjectId);
      // 后台异步触发精灵/背景生成
      void fetch(`/api/projects/${encodeURIComponent(nextProjectId)}/background`, { method: "POST", keepalive: true });

      // 等待精灵生成完成再跳转（确保用户第一次看到游戏就有贴图）
      setBusy("sprites");
      const ready = await waitForSprites(nextProjectId);
      if (ready) {
        router.push(withLocalePath(`/play/${nextProjectId}`, locale));
      } else {
        setError(t("errors.spriteTimeout"));
        setBusy("idle");
      }
    } catch {
      setError(t("errors.network"));
      setBusy("idle");
    }
  }, [creativeBrief, locale, projectId, prompt, router, spec, t]);

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
    busy === "gen"
      ? t("busyGenerating")
      : busy === "gen_variants"
        ? t("busyVariants")
        : busy === "save"
          ? t("busySaving")
          : busy === "sprites"
            ? t("busySprites")
            : null;

  const stepMeta =
    streamStep != null
      ? resolveStepMeta(streamStep)
      : busy === "gen"
        ? resolveStepMeta("running")
        : null;
  const stepProgress = stepMeta?.progress ?? 0;
  const stepText = stepMeta?.label ?? "";
  const stepMsg = streamMsg || stepMeta?.defaultMsg || "";

  const studioProcessPanel =
    busy === "gen" || studioLog.length > 0 ? (
      <div className="space-y-2">
        {busy === "gen" && stepMeta ? (
          <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[color:color-mix(in_srgb,var(--gc-accent)_55%,transparent)] border-t-[color:var(--gc-accent)]"
                  aria-hidden
                />
                <p className="text-xs font-semibold text-[var(--gc-text-soft)]">
                  {t("stageLabel", { step: stepText })}
                </p>
              </div>
              <p className="text-[11px] tabular-nums text-[var(--gc-text-faint)]">
                {t("eta", { value: etaText ?? "…" })}
              </p>
            </div>
            {streamIntentBrief ? (
              <p className="mt-1 text-[11px] leading-snug text-[var(--gc-text-faint)]">
                {t("currentIntent")}
                <span className="text-[var(--gc-muted)]">{streamIntentBrief}</span>
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
              <span className="tabular-nums">
                {t("roughProgress", { value: String(Math.floor(stepProgress * 100)) })}
              </span>
              <span className="tabular-nums">{t("elapsed", { value: String(elapsedSec) })}</span>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--gc-accent)_25%,var(--gc-border))] bg-[var(--gc-bg-elevated)]/85 px-3 py-2">
          <button
            type="button"
            onClick={() => setShowStudioDetails((v) => !v)}
            className="flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--gc-muted)]"
          >
            {t("processTitle")}
            <span>{showStudioDetails ? t("collapse") : t("expand")}</span>
          </button>
          {showStudioDetails ? (
          <>
          <div className="mt-2 max-h-72 min-h-[4.5rem] space-y-2 overflow-y-auto pr-1 text-[11px] leading-relaxed [scrollbar-width:thin]">
            {studioLog.length === 0 ? (
              <p className="text-[var(--gc-text-faint)]">{t("processEmpty")}</p>
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
            {t("processNote")}
          </p>
          </>
          ) : null}
        </div>
      </div>
    ) : null;

  return (
    <AppPageShell className="text-[var(--gc-text)]">
      <SiteHeader />
      <AppMain>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:py-10 lg:gap-14 lg:px-8 xl:pr-12">
        <header className="max-w-2xl space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--gc-text)]">{t("title")}</h1>
          <p className="text-sm leading-relaxed text-[var(--gc-muted)]">
            {t("desc")}
          </p>
          <p className="text-xs text-[var(--gc-text-faint)]">{t("shortcut")}</p>
          <GameRuntimePreferenceControl className="mt-2" />
        </header>

        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-5 rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]/80 px-1 py-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-[var(--gc-text-soft)]" htmlFor="prompt">
                  {t("promptLabel")}
                </label>
                <span
                  className={`text-xs tabular-nums ${len > 3800 ? "text-amber-400" : "text-[var(--gc-text-faint)]"}`}
                >
                  {len} / 4000
                </span>
              </div>
              {replayStatus === "loading" ? (
                <p className="text-xs text-[var(--gc-muted)]">{t("replayLoading")}</p>
              ) : null}
              {replayStatus === "error" ? (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  {t("replayError")}
                </p>
              ) : null}
              {replayStatus === "ok" ? (
                <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs leading-relaxed text-emerald-100/95">
                  {t("replayLoaded", { title: replayTitle ? `《${replayTitle}》` : "saved work" })}
                </p>
              ) : null}
              {replayStatus === "ok" && replayRefinements.length > 0 ? (
                <div className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2 text-[11px] text-[var(--gc-muted)]">
                  <p className="mb-1 font-medium text-[var(--gc-text-soft)]">{t("replayHistory")}</p>
                  <ul className="max-h-24 space-y-0.5 overflow-y-auto">
                    {replayRefinements.map((r, i) => (
                      <li key={`${r.at}-${i}`} className="truncate">
                        <span className="text-[var(--gc-text-faint)]">{r.mode}</span> · {r.instruction}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <textarea
                id="prompt"
                rows={8}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("promptPlaceholder")}
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
                  {t("ref.title")}
                </p>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--gc-muted)]">
                  <input
                    type="checkbox"
                    checked={visionOn}
                    onChange={(e) => setVisionOn(e.target.checked)}
                    className="rounded border-[color:var(--gc-border)] bg-[var(--gc-input-bg)]"
                  />
                  {t("ref.visionLabel")}
                </label>
              </div>

              {/* 一行摘要 + 悬停展开详情 */}
              <div className="mt-2 flex items-start gap-1.5">
                <p className="text-[11px] leading-snug text-[var(--gc-muted)]">
                  {t("ref.summary")}
                </p>
                <span className="group/tip1 relative shrink-0">
                  <span className="cursor-help select-none rounded-full border border-[color:var(--gc-border)] px-1.5 py-0.5 text-[10px] text-[var(--gc-text-faint)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] hover:text-[var(--gc-text-soft)]">?</span>
                  <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-50 w-72 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] p-3 text-[10px] leading-relaxed text-[var(--gc-muted)] opacity-0 shadow-2xl transition-opacity duration-150 group-hover/tip1:opacity-100">
                    {t.rich("ref.summaryTooltip", {
                      transparent: refStrong,
                      purpose: refStrong,
                      sticker: refStrong,
                      spriteGrid: refStrong,
                      noMatting: refStrong,
                    })}
                  </span>
                </span>
              </div>

              {/* 素材用途速查：告知用户每类图上传后的效果 */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {([
                  { emoji: "🗺️", label: t("ref.guideBackgroundLabel"), desc: t("ref.guideBackgroundDesc") },
                  { emoji: "👾", label: t("ref.guideEnemyLabel"), desc: t("ref.guideEnemyDesc") },
                  { emoji: "🏰", label: t("ref.guideGoalLabel"), desc: t("ref.guideGoalDesc") },
                  { emoji: "🗼", label: t("ref.guideTowerLabel"), desc: t("ref.guideTowerDesc") },
                ] as const).map((guide) => (
                  <span
                    key={guide.label}
                    title={guide.desc}
                    className="flex cursor-default items-center gap-1 rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-2 py-0.5 text-[10px] text-[var(--gc-text-faint)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,transparent)] hover:text-[var(--gc-text-soft)]"
                  >
                    <span>{guide.emoji}</span>
                    <span>{guide.label}</span>
                  </span>
                ))}
                <span className="flex items-center text-[10px] text-[var(--gc-text-faint)] italic ml-0.5">
                  {t("ref.noUploadHint")}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-[var(--gc-muted)]">
                    <span className="text-[11px] text-[var(--gc-text-faint)]">{t("ref.templateLabel")}</span>
                    <select
                      value={templateHint}
                      onChange={(e) => setTemplateHint(e.target.value as "auto" | GameSpec["templateId"])}
                      className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-2 py-1 text-xs text-[var(--gc-text-soft)] outline-none"
                    >
                      <option value="auto">{t("ref.templates.auto")}</option>
                      <option value="platformer">{t("ref.templates.platformer")}</option>
                      <option value="towerDefense">{t("ref.templates.towerDefense")}</option>
                      <option value="shooter">{t("ref.templates.shooter")}</option>
                      <option value="collector">{t("ref.templates.collector")}</option>
                      <option value="survivor">{t("ref.templates.survivor")}</option>
                      <option value="avoider">{t("ref.templates.avoider")}</option>
                    </select>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--gc-muted)]">
                    <input
                      type="checkbox"
                      checked={enhancePass}
                      onChange={(e) => setEnhancePass(e.target.checked)}
                      className="rounded border-[color:var(--gc-border)] bg-[var(--gc-input-bg)]"
                    />
                    {t("ref.enhancePass")}
                  </label>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--gc-muted)]">
                  <input
                    type="checkbox"
                    checked={searchEnhance}
                    onChange={(e) => setSearchEnhance(e.target.checked)}
                    className="rounded border-[color:var(--gc-border)] bg-[var(--gc-input-bg)]"
                  />
                  {t("ref.searchEnhance")}
                </label>
                <span className="text-[11px] text-[var(--gc-text-faint)]">
                  {t("ref.searchEnhanceHint")}
                </span>
              </div>
              {webMeta?.warning ? (
                <p className="mt-2 text-xs text-amber-200/90">{t("ref.webWarningPrefix")}{webMeta.warning}</p>
              ) : null}
              {webMeta?.sources?.length ? (
                <details className="mt-2 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium text-[var(--gc-text-soft)]">
                    {t("ref.webSources", { count: webMeta.sources.length })}
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
                {t("ref.generateHint")}
                <span className="group/tip2 relative ml-1.5 inline-block align-middle">
                  <span className="cursor-help select-none rounded-full border border-[color:var(--gc-border)] px-1.5 py-0.5 text-[10px] text-[var(--gc-text-faint)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] hover:text-[var(--gc-text-soft)]">?</span>
                  <span className="pointer-events-none absolute bottom-[calc(100%+6px)] right-0 z-50 w-80 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] p-3 text-[10px] leading-relaxed text-[var(--gc-muted)] opacity-0 shadow-2xl transition-opacity duration-150 group-hover/tip2:opacity-100">
                    {t("ref.generateTooltipA")}
                    <br />
                    <br />
                    {t.rich("ref.generateTooltipB", {
                      paste: refStrong,
                      compress: refStrong,
                      bg: refStrong,
                      enemy: refStrong,
                    })}
                  </span>
                </span>
              </p>
              {pastedImages.length > 0 ? (
                <div className="mt-3 space-y-2 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[color:color-mix(in_srgb,var(--gc-accent)_80%,white)]">
                    <span>{t("ref.clipboardPending", { count: pastedImages.length })}</span>
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
                      {t("ref.clear")}
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
                            {t("ref.imageLabel", { index: pickerImageCount + idx + 1 })}
                          </span>
                          <PasteThumb file={row.file} />
                          <span className="truncate text-[11px] text-[var(--gc-text-faint)]" title={row.file.name}>
                            {row.file.name || "image"}
                          </span>
                        </div>
                        <label className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[10px] uppercase tracking-wide text-[var(--gc-text-faint)]">{t("ref.purposeLabel")}</span>
                          <input
                            type="text"
                            value={row.purpose}
                            onChange={(e) => setRowPurpose(row.id, e.target.value)}
                            placeholder={t("ref.purposePlaceholder")}
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
                  placeholder={t("ref.urlPlaceholder")}
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
                  {t("ref.chooseFiles")}
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void ingestReference()}
                  disabled={ingestBusy}
                  className="gc-theme-cta rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  {ingestBusy ? t("ref.parsing") : t("ref.parseAndAppend")}
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

          </div>

          <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                {([
                  [1, t("stepInput")],
                  [2, t("stepIntent")],
                  [3, t("stepDirection")],
                  [4, t("stepPlay")],
                ] as const).map(([step, label]) => {
                  const active = coCreationStep === step;
                  const done = coCreationStep > step;
                  return (
                    <div
                      key={step}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${
                        active
                          ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)]"
                          : done
                            ? "bg-emerald-500/12 text-emerald-200"
                            : "border border-[color:var(--gc-border)] text-[var(--gc-muted)]"
                      }`}
                    >
                      <span className="font-semibold">{step}</span>
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[var(--gc-muted)]">
                {t("currentModeLabel")}
                {creationMode === "generated" ? t("modeGenerated") : t("modeFlow")}
                {projectId ? ` ${t("modeBound")}` : ` ${t("modeNew")}`}
              </p>
              {coDirections.length ? (
                <div className="mt-3 grid gap-2">
                  {coDirections.map((row) => {
                    const active = row.id === selectedDirectionId;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => chooseCoCreationDirection(row.id)}
                        className={`rounded-xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_10%,transparent)]"
                            : "border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)]/45 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,transparent)]"
                        }`}
                      >
                        <p className="text-sm font-semibold text-[var(--gc-text-soft)]">{row.title}</p>
                        <p className="mt-1 text-xs text-[var(--gc-muted)]">{row.summary}</p>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] text-[var(--gc-text-faint)]">
                          {row.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {coCreationIntent ? (
                <div className="mt-3 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)]/60 px-3 py-3 text-xs text-[var(--gc-muted)]">
                  <p className="font-semibold text-[var(--gc-text-soft)]">{t("coCreation.currentUnderstanding")}</p>
                  <p className="mt-1">{coCreationIntent.premise}</p>
                  <p className="mt-2">{t("coCreation.templateTendency")}<strong className="text-[var(--gc-text-soft)]">{coCreationIntent.templateId}</strong></p>
                  <p className="mt-1">{t("coCreation.gameplayAxis")}{coCreationIntent.gameplayCore}</p>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--gc-muted)]">{t("tryExamples")}</p>
              <div className="flex flex-wrap gap-2">
                {examples.map((ex) => (
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
                onClick={() => {
                  if (!coCreationIntent) {
                    buildCoCreationPlan();
                    return;
                  }
                  if (!currentDirection) {
                    setError(t("chooseDirectionFirst"));
                    return;
                  }
                  void generateStream();
                }}
                disabled={busy !== "idle" || prompt.trim().length < 2}
                className="gc-theme-cta rounded-full px-6 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "gen" ? t("streaming") : !coCreationIntent ? t("planIntent") : t("generatePlayable")}
              </button>
              <button
                type="button"
                onClick={() => void generateVariants()}
                disabled={busy !== "idle" || prompt.trim().length < 2}
                className="rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)] px-6 py-2.5 text-sm font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)] transition hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "gen_variants" ? t("variantsGenerating") : t("variantsOnce")}
              </button>
              <button
                type="button"
                onClick={() => void saveAndPlay()}
                disabled={busy !== "idle" || !spec}
                className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-6 py-2.5 text-sm font-medium text-[var(--gc-text)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:bg-[var(--gc-surface-glass-strong)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "save" ? t("busySaving") : projectId ? t("updatingAndPlay") : t("saveAndPlay")}
              </button>
            </div>

            {busyLabel ? (
              <p className="text-xs font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_90%,white)]">{busyLabel}</p>
            ) : null}

            {busy === "sprites" && (
              <div className="flex items-center gap-2 rounded-xl border border-[color:color-mix(in_srgb,var(--gc-accent)_30%,var(--gc-border))] bg-[color:color-mix(in_srgb,var(--gc-accent)_10%,var(--gc-surface-glass))] px-4 py-3">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[color:color-mix(in_srgb,var(--gc-accent)_60%,transparent)] border-t-transparent" />
                <span className="text-sm text-[var(--gc-text)]">
                  {t("spriteWait")}
                </span>
              </div>
            )}


            {busy !== "gen" && ingestBusy ? (
              <p className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-2 text-xs text-[var(--gc-muted)]">
                {t("ingestBusy")}
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

          <section
            className="flex flex-col gap-4 border-t border-[color:var(--gc-border)] pt-8"
            aria-label={t("previewAria")}
          >
            <p className="text-xs text-[var(--gc-muted)]">
              {t("previewHint")}
            </p>
            {spec ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[color:var(--gc-border)] pb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--gc-text)]">{spec.title}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--gc-muted)]">
                        {spec.templateId} · {t("realtimePreview")}
                      </p>
                      <GameRuntimePreferenceControl />
                    </div>
                    {genSource ? (
                      <p className="mt-2 max-w-md text-xs leading-relaxed text-[color:color-mix(in_srgb,var(--gc-accent)_85%,white)]">
                        {genSource && t.has(`sourceHints.${genSource}`)
                          ? t(`sourceHints.${genSource}`)
                          : genSource}
                      </p>
                    ) : null}
                    {genDebug ? (
                      <div className="mt-2 max-w-md rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2 text-[11px] text-[var(--gc-muted)]">
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <span className="font-medium text-[var(--gc-text-soft)]">{t("generationEvidence")}</span>
                          <span>{t("genEvidence.draftModel")}{genDebug.draftModel ?? (genDebug.model ?? (genDebug.fallback ? t("genEvidence.fallbackLocal") : t("genEvidence.unknown")))}</span>
                          <span>{t("genEvidence.enhanceModel")}{genDebug.enhanceModel ?? (genDebug.enhanced ? (genDebug.model ?? t("genEvidence.unknown")) : t("genEvidence.notRun"))}</span>
                          <span>{t("genEvidence.fallback")}{genDebug.fallback ? t("genEvidence.yes") : t("genEvidence.no")}</span>
                          <span>{t("genEvidence.search")}{genDebug.searchEnhance ? t("genEvidence.on") : t("genEvidence.off")}</span>
                          <span>{t("genEvidence.enhance")}{genDebug.enhanced ? t("genEvidence.on") : t("genEvidence.off")}</span>
                          {genDebug.templateHint ? <span>{t("genEvidence.templateHint")}{genDebug.templateHint}</span> : null}
                        </div>
                        {genDebug.fallbackReason ? (
                          <p className="mt-2 text-[11px] text-amber-200/90">{t("genEvidence.fallbackReason")}{genDebug.fallbackReason}</p>
                        ) : null}
                        {genDebug.provider || genDebug.llmMode ? (
                          <p className="mt-2 text-[11px] text-[var(--gc-text-faint)]">
                            LLM：{genDebug.provider ?? "?"} · {genDebug.llmMode ?? "?"}
                          </p>
                        ) : null}
                        {genDebug.llmError ? (
                          <p className="mt-2 whitespace-pre-wrap break-words text-[11px] text-amber-200/90">
                            {t("gatewayError", { error: genDebug.llmError })}
                          </p>
                        ) : null}
                        {genDebug.enhanceWarning ? (
                          <p className="mt-2 text-[11px] text-amber-200/90">{t("enhanceWarningPrefix")}{genDebug.enhanceWarning}</p>
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
                              {t("sessionRefItems", { count: cnt })}
                              {revNum !== null ? ` · revision ${revNum}` : ""}
                            </p>
                          );
                        })()}
                        {genDebug.orchestrationTrace ? (
                          <details className="mt-2 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)]/30 px-2 py-1.5">
                            <summary className="cursor-pointer text-[10px] font-medium text-[var(--gc-text-soft)]">
                              {t("orchestrationTrace", {
                                steps: genDebug.orchestrationTrace.steps.length,
                                seconds: (genDebug.orchestrationTrace.totalMs / 1000).toFixed(2),
                              })}
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
                    {t("rerunStream")}
                  </button>
                </div>

                {variants && variants.length > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    <span className="w-full text-[11px] uppercase tracking-wider text-[var(--gc-muted)]">{t("options")}</span>
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

                <CreativeBriefPanel
                  brief={creativeBrief}
                  summary={creativeBriefSummary}
                  onRevisionChange={setBriefRevision}
                  onRegenerateWithRevision={() => void generateStream()}
                  regenerateDisabled={busy !== "idle" || prompt.trim().length < 2}
                />

                <GameRuntimeTabs
                  spec={spec}
                  refEpoch={refPixelEpoch}
                  phaser={
                    <GamePlayer
                      key={`${variants ? `v-${variantIndex}` : "one-shot"}-px-${refPixelEpoch}`}
                      spec={spec}
                    />
                  }
                />
                <SpecQuickTunePanel spec={spec} onChange={(next) => setSpec(next)} />
              </>
            ) : (
              <div className="gc-card flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <div className="h-12 w-12 rounded-2xl border border-dashed border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]" />
                <p className="max-w-xs text-sm text-[var(--gc-muted)]">
                  {t("previewEmpty")}
                </p>
              </div>
            )}
            {studioProcessPanel}
          </section>
        </div>
      </main>
      {QuotaModal}
      </AppMain>
    </AppPageShell>
  );
}

