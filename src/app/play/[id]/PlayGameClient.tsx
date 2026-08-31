"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GameSpec } from "@/lib/game-spec";
import { GamePlayer } from "@/components/GamePlayer";
import { GameRuntimeTabs } from "@/components/GameRuntimeTabs";
import { SampleParityTrustBadge } from "@/components/SampleParityTrustBadge";
import { resolveSampleParityUserInfo } from "@/lib/sample-parity-user";
import { buildCreatePrefillPath } from "@/lib/sample-create-prefill";
import { readReferenceImagePayloadsFromSession } from "@/lib/assets/reference-image-payloads.client";
import { prefetchGodotExport } from "@/lib/godot-prefetch.client";
import { isGodotExportSupported } from "@/lib/godot-spec-bridge-codegen";
import { PRODUCT } from "@/lib/product-config";
import { GameRuntimePreferenceControl } from "@/components/GameRuntimePreferenceControl";
import { SpecQuickTunePanel } from "@/components/SpecQuickTunePanel";
import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { ResultMomentBanner } from "@/components/ResultMomentBanner";
import { WorkShareBar } from "@/components/share/WorkShareBar";
import { WorkCommentSection } from "@/components/work/WorkCommentSection";
import { WorkEngagementStats } from "@/components/work/WorkEngagementStats";
import { PublishWorkButton } from "@/components/work/PublishWorkButton";
import { CreatorVersionStatus } from "@/components/work/CreatorVersionStatus";
import { WorkUidCopy } from "@/components/work/WorkUidCopy";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { getSuperAdminKey } from "@/lib/super-admin-client";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";
import { isSampleGalleryProject } from "@/lib/sample-gallery";
import type { GameEditSchema } from "@/lib/game-edit-schema";

type CoreArtifact = { kind: string; content: unknown };
type CoreRevision = { id: string; sequence: number; cause: string; status?: string; summary: string | null; finalizedAt: string | null; artifacts: CoreArtifact[] };
type CoreSnapshot = {
  revision: CoreRevision | null;
  project?: {
    evaluation?: { verdict: string; score: number; evidence: unknown; createdAt: string } | null;
    publications?: Array<{ action: string; visibility: string; decision: string; createdAt: string }>;
    acceptedRevisionId?: string | null;
    acceptedRevision?: { id: string; sequence: number; status: string; summary: string | null; finalizedAt: string | null } | null;
  };
};
type PlaytestAdvice = { kind: "collect_samples" | "first_action" | "first_minute" | "early_failure" | "retry_friction" | "healthy"; priority: "info" | "warning" | "good" };
type AssetJob = { id: string; status: "queued" | "running" | "retrying"; attempts: number; maxAttempts: number; progress: { percent?: number; stage?: string } | null };

function graphItemCount(revision: CoreRevision | null | undefined, kind: string, key: "scenes" | "nodes"): number | null {
  const content = revision?.artifacts.find((artifact) => artifact.kind === kind)?.content;
  if (!content || typeof content !== "object") return null;
  const value = (content as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.length : null;
}

export function PlayGameClient({ id }: { id: string }) {
  const t = useTranslations("playGame");
  const tBanner = useTranslations("resultBanner");
  const tParity = useTranslations("sampleParity");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [spec, setSpec] = useState<GameSpec | null>(null);
  const [meta, setMeta] = useState<{
    title: string;
    prompt: string;
    isOwner: boolean;
    isSampleGallery: boolean;
    shareCode: string | null;
    likeCount: number;
    playCount: number;
    visibility: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shortCopied, setShortCopied] = useState(false);
  const [remixBusy, setRemixBusy] = useState(false);
  const [mintBusy, setMintBusy] = useState(false);
  const [patchPrompt, setPatchPrompt] = useState("");
  const [refineMode, setRefineMode] = useState<"patch" | "regenerate">("patch");
  const [refinementHistory, setRefinementHistory] = useState<Array<{ at: string; mode: string; instruction: string }>>(
    [],
  );
  const [patchBusy, setPatchBusy] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [core, setCore] = useState<CoreSnapshot | null>(null);
  const [playtestAdvice, setPlaytestAdvice] = useState<PlaytestAdvice[]>([]);
  const [assetJob, setAssetJob] = useState<AssetJob | null>(null);
  const [assetJobBusy, setAssetJobBusy] = useState(false);
  const [playRevisionId, setPlayRevisionId] = useState<string | null>(null);
  const [editorSchema, setEditorSchema] = useState<GameEditSchema | null>(null);

  const apiHeaders = (init?: HeadersInit) => {
    const headers = mergeLocaleHeaders(locale, init);
    const key = getSuperAdminKey();
    if (key) headers["X-Super-Admin-Key"] = key;
    return headers;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${id}`, { headers: apiHeaders() });
        const data = (await res.json()) as {
          spec?: GameSpec;
          project?: {
            title: string;
            prompt: string;
            isOwner: boolean;
            isSampleGallery?: boolean;
            shareCode: string | null;
            likeCount?: number;
            playCount?: number;
            visibility?: string;
          };
          refinementHistory?: Array<{ at: string; mode: string; instruction: string }>;
          core?: CoreSnapshot;
          assetJob?: AssetJob;
          playtestAdvice?: PlaytestAdvice[];
          playRevisionId?: string;
          editorSchema?: GameEditSchema;
          error?: string;
          errorKey?: string;
          errorParams?: Record<string, string | number>;
        };
        if (!res.ok) {
          if (!cancelled) setError(resolveClientApiError(locale, data, "loadFailed"));
          return;
        }
        if (!data.spec || !data.project) {
          if (!cancelled) setError(t("incompleteData"));
          return;
        }
        if (!cancelled) {
          setSpec(data.spec);
          if (PRODUCT.godot.enabled && isGodotExportSupported(data.spec)) {
            prefetchGodotExport(data.spec, { projectId: id });
          }
          setMeta({
            title: data.project.title,
            prompt: data.project.prompt,
            isOwner: data.project.isOwner,
            isSampleGallery: Boolean(data.project.isSampleGallery),
            shareCode: data.project.shareCode ?? null,
            likeCount: data.project.likeCount ?? 0,
            playCount: data.project.playCount ?? 0,
            visibility: data.project.visibility ?? "pending_review",
          });
          setLikeCount(data.project.likeCount ?? 0);
          setPlayCount(data.project.playCount ?? 0);
          void fetch(`/api/projects/${id}/play`, {
            method: "POST",
            headers: apiHeaders(),
          }).then(() => setPlayCount((c) => c + 1));
          if (typeof localStorage !== "undefined") {
            setLiked(!!localStorage.getItem(`liked:${id}`));
          }
          if (Array.isArray(data.refinementHistory)) {
            setRefinementHistory(data.refinementHistory);
          } else {
            setRefinementHistory([]);
          }
          setCore(data.core ?? null);
          setAssetJob(data.assetJob ?? null);
          setPlaytestAdvice(Array.isArray(data.playtestAdvice) ? data.playtestAdvice : []);
          setPlayRevisionId(data.playRevisionId ?? null);
          setEditorSchema(data.editorSchema ?? null);
        }
      } catch {
        if (!cancelled) setError(t("networkError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, locale, t]);

  useEffect(() => {
    if (!assetJob?.id) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch(`/api/jobs/${assetJob.id}`, { headers: apiHeaders() });
        const data = (await res.json()) as { status?: string; attempts?: number; maxAttempts?: number; progress?: AssetJob["progress"] };
        if (cancelled) return;
        if (data.status === "queued" || data.status === "running" || data.status === "retrying") {
          setAssetJob({ id: assetJob.id, status: data.status, attempts: data.attempts ?? assetJob.attempts, maxAttempts: data.maxAttempts ?? assetJob.maxAttempts, progress: data.progress ?? null });
        } else {
          setAssetJob(null);
        }
      } catch { /* retain last visible task state until next poll */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [assetJob?.id, assetJob?.attempts, assetJob?.maxAttempts, locale]);

  async function queueAssetRecovery() {
    if (!meta?.isOwner || assetJobBusy || assetJob) return;
    setAssetJobBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}/background`, {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ durable: true }),
      });
      const data = (await res.json()) as { job?: { id?: string; status?: AssetJob["status"] }; error?: string; errorKey?: string; errorParams?: Record<string, string | number> };
      if (!res.ok || !data.job?.id || !data.job.status) {
        setPatchError(resolveClientApiError(locale, data, "assetJobFailed"));
        return;
      }
      setAssetJob({ id: data.job.id, status: data.job.status, attempts: 0, maxAttempts: 3, progress: { percent: 0, stage: "queued" } });
    } catch {
      setPatchError(t("assetJobNetworkError"));
    } finally {
      setAssetJobBusy(false);
    }
  }

  async function copyLink() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function copyShortUrl() {
    if (!meta?.shareCode) return;
    const url = `${window.location.origin}/s/${meta.shareCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setShortCopied(true);
      setTimeout(() => setShortCopied(false), 2000);
    } catch {
      setShortCopied(false);
    }
  }

  async function mintShareCode() {
    setMintBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ ensureShareCode: true }),
      });
      const data = (await res.json()) as {
        project?: { shareCode?: string | null };
        error?: string;
        errorKey?: string;
        errorParams?: Record<string, string | number>;
      };
      if (!res.ok) {
        alert(resolveClientApiError(locale, data, "generateFailed"));
        return;
      }
      const code = data.project?.shareCode;
      if (code) {
        setMeta((m) => (m ? { ...m, shareCode: code } : m));
      }
    } finally {
      setMintBusy(false);
    }
  }

  function handleLike() {
    if (liked) return;
    setLiked(true);
    setLikeCount((n) => n + 1);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(`liked:${id}`, "1");
    }
    void fetch(`/api/projects/${id}/like`, { method: "POST", headers: apiHeaders() });
  }

  async function remix() {
    setRemixBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}/duplicate`, {
        method: "POST",
        headers: apiHeaders(),
      });
      const data = (await res.json()) as {
        project?: { id: string };
        error?: string;
        errorKey?: string;
        errorParams?: Record<string, string | number>;
      };
      if (!res.ok) {
        alert(resolveClientApiError(locale, data, "copyFailed"));
        return;
      }
      if (data.project?.id) {
        router.push(withLocalePath(`/play/${data.project.id}`, locale));
      }
    } finally {
      setRemixBusy(false);
    }
  }

  async function applyPatch(e: React.FormEvent) {
    e.preventDefault();
    if (!spec || !patchPrompt.trim() || patchBusy) return;
    setPatchBusy(true);
    setPatchError(null);
    try {
      if (meta?.isOwner) {
        const res = await fetch(`/api/projects/${id}/refine`, {
          method: "POST",
          headers: apiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ instruction: patchPrompt.trim(), mode: refineMode }),
        });
        const data = (await res.json()) as {
          spec?: GameSpec;
          prompt?: string;
          refinementHistory?: Array<{ at: string; mode: string; instruction: string }>;
          error?: string;
          errorKey?: string;
          errorParams?: Record<string, string | number>;
        };
        if (!res.ok || !data.spec) {
          setPatchError(resolveClientApiError(locale, data, "refineFailed"));
          return;
        }
        setSpec(data.spec);
        if (typeof data.prompt === "string" && data.prompt.trim()) {
          setMeta((m) => (m ? { ...m, prompt: data.prompt! } : m));
        }
        if (Array.isArray(data.refinementHistory)) {
          setRefinementHistory(data.refinementHistory);
        }
        setPatchPrompt("");
        return;
      }

      const res = await fetch("/api/generate/patch", {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ prompt: patchPrompt.trim(), currentSpec: spec, currentPrompt: meta?.prompt ?? "" }),
      });
      const data = (await res.json()) as {
        spec?: GameSpec;
        prompt?: string;
        error?: string;
        errorKey?: string;
        errorParams?: Record<string, string | number>;
      };
      if (!res.ok || !data.spec) {
        setPatchError(resolveClientApiError(locale, data, "patchFailed"));
        return;
      }
      setSpec(data.spec);
      if (typeof data.prompt === "string" && data.prompt.trim()) {
        setMeta((m) => (m ? { ...m, prompt: data.prompt! } : m));
      }
      setPatchPrompt("");
    } catch {
      setPatchError(t("patchNetworkError"));
    } finally {
      setPatchBusy(false);
    }
  }

  async function saveProjectSpec() {
    if (!spec || !meta || !meta.isOwner || saveBusy) return;
    setSaveBusy(true);
    setSaveMsg(null);
    setPatchError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ prompt: meta.prompt, spec }),
      });
      const data = (await res.json()) as {
        error?: string;
        errorKey?: string;
        errorParams?: Record<string, string | number>;
        project?: { title?: string; prompt?: string };
        core?: { creativeRevisionId?: string };
      };
      if (!res.ok) {
        setPatchError(resolveClientApiError(locale, data, "saveFailed"));
        return;
      }
      setMeta((m) =>
        m
          ? {
              ...m,
              title: typeof data.project?.title === "string" ? data.project.title : m.title,
              prompt: typeof data.project?.prompt === "string" ? data.project.prompt : m.prompt,
            }
          : m,
      );
      if (data.core?.creativeRevisionId) {
        setCore((current) => current?.revision
          ? { revision: { ...current.revision, id: data.core!.creativeRevisionId!, sequence: current.revision.sequence + 1, cause: "refine", finalizedAt: new Date().toISOString() } }
          : current);
      }
      setSaveMsg(t("savedToVersion"));
      window.setTimeout(() => setSaveMsg(null), 2200);
    } catch {
      setPatchError(t("saveNetworkError"));
    } finally {
      setSaveBusy(false);
    }
  }

  const shortUrl =
    meta?.shareCode && typeof window !== "undefined"
      ? `${window.location.origin}/s/${meta.shareCode}`
      : meta?.shareCode
        ? `/s/${meta.shareCode}`
        : null;

  const parityInfo =
    spec && meta ? resolveSampleParityUserInfo(spec, meta.prompt) : null;

  const resultTitle =
    parityInfo?.promptAligned
      ? tBanner("parityTitle", { sample: parityInfo.sampleTitle, title: meta?.title ?? "" })
      : meta?.title ?? "";
  const resultSubtitle =
    parityInfo?.promptAligned
      ? tParity("bodySamePrompt", {
          sample: parityInfo.sampleTitle,
          scene: parityInfo.sceneName,
        })
      : meta?.prompt;

  const sampleGallery = Boolean(meta?.isSampleGallery) || isSampleGalleryProject(id);

  return (
    <AppPageShell className="text-[var(--gc-text)]">
      {!sampleGallery ? (
        <div className="hidden sm:block">
          <SiteHeader />
        </div>
      ) : null}
      <AppMain>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-0 py-2 sm:gap-8 sm:px-4 sm:py-10 lg:px-8 xl:pr-12">
        {error ? (
          <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
        ) : !spec || !meta ? (
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--gc-surface-glass-strong)]" />
            <div className="h-64 animate-pulse rounded-2xl bg-[var(--gc-surface-glass)]" />
          </div>
        ) : (
          <>
            {meta.isSampleGallery ? (
              <>
                <div className="flex items-center gap-2 px-3 sm:flex-wrap sm:justify-between sm:gap-3 sm:px-0">
                  <Link
                    href={withLocalePath("/samples", locale)}
                    className="shrink-0 text-sm font-medium text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
                  >
                    ← {t("backToSamples")}
                  </Link>
                  <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold tracking-tight text-[var(--gc-text)] sm:text-xl">
                    {meta.title}
                  </h1>
                  <details className="relative sm:hidden">
                    <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] text-lg font-medium text-[var(--gc-text)] marker:content-none [&::-webkit-details-marker]:hidden">
                      <span className="sr-only">{t("cloneToMine")}</span>
                      ⋯
                    </summary>
                    <div className="absolute right-0 z-20 mt-2 flex w-56 flex-col gap-2 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] p-2 shadow-xl">
                      <button
                        type="button"
                        disabled={remixBusy}
                        onClick={() => void remix()}
                        className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-2 text-xs font-medium text-[var(--gc-text)] disabled:opacity-50"
                      >
                        {remixBusy ? t("remixing") : t("cloneToMine")}
                      </button>
                      <Link
                        href={buildCreatePrefillPath(meta.prompt, locale)}
                        className="rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)] px-3 py-2 text-center text-xs font-semibold text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)]"
                      >
                        {t("createWithSamplePrompt")}
                      </Link>
                    </div>
                  </details>
                  <div className="hidden flex-wrap justify-end gap-2 sm:flex">
                    <button
                      type="button"
                      disabled={remixBusy}
                      onClick={() => void remix()}
                      className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-3 py-1.5 text-xs font-medium text-[var(--gc-text)] disabled:opacity-50"
                    >
                      {remixBusy ? t("remixing") : t("cloneToMine")}
                    </button>
                    <Link
                      href={buildCreatePrefillPath(meta.prompt, locale)}
                      className="rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)] px-3 py-1.5 text-xs font-semibold text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)]"
                    >
                      {t("createWithSamplePrompt")}
                    </Link>
                  </div>
                </div>
                <GamePlayer spec={spec} immersive projectId={id} creativeRevisionId={playRevisionId ?? undefined} promptHint={meta.prompt} />
              </>
            ) : (
              <>
            <div className="flex flex-col">
            <div className="order-2 px-3 sm:order-1 sm:px-0">
            {parityInfo ? (
              <SampleParityTrustBadge info={parityInfo} />
            ) : null}
            {meta.isOwner && core?.revision?.status && core.revision.status !== "ready" ? (
              <div className={`mb-3 rounded-xl border px-4 py-3 text-sm ${core.revision.status === "failed" ? "border-rose-400/40 bg-rose-950/30 text-rose-100" : "border-amber-400/40 bg-amber-950/30 text-amber-100"}`} role="status" data-testid="game-production-status">
                <p className="font-semibold">{core.revision.status === "failed" ? "生产候选未通过，当前画面不是可交付成品" : "多 Agent 生产与自动审查仍在进行"}</p>
                <p className="mt-1 text-xs opacity-80">{core.revision.summary ?? `revision status: ${core.revision.status}`}</p>
              </div>
            ) : null}
            <ResultMomentBanner
              mode="game"
              title={resultTitle}
              subtitle={resultSubtitle}
              eyebrow={meta.isOwner && core?.revision?.status && core.revision.status !== "ready"
                ? core.revision.status === "failed"
                  ? "游戏生产未通过 · 禁止发布"
                  : "多 Agent 生产中 · 当前仅为草稿预览"
                : undefined}
              actions={
                <>
                  <WorkEngagementStats kind="game" playCount={playCount} likeCount={likeCount} hideLikes size="md" />
                  <GameRuntimePreferenceControl />
                  {meta.isOwner && core?.revision?.status === "ready" ? (
                    <PublishWorkButton
                      type="game"
                      id={id}
                      visibility={meta.visibility}
                      onVisibilityChange={(visibility) => setMeta((current) => current ? { ...current, visibility } : current)}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={handleLike}
                    className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
                      liked
                        ? "border-red-400/40 bg-red-400/10 text-red-400"
                        : "border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] text-[var(--gc-text)] hover:border-red-400/40 hover:text-red-400"
                    }`}
                  >
                    {liked ? "♥" : "♡"}{" "}
                    {likeCount > 0
                      ? likeCount
                      : meta.isSampleGallery
                        ? liked
                          ? t("favorited")
                          : t("favorite")
                        : t("like")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-2 text-sm font-medium text-[var(--gc-text)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))]"
                  >
                    {copied ? t("copiedFullLink") : t("copyLink")}
                  </button>
                  {meta.shareCode ? (
                    <button
                      type="button"
                      onClick={() => void copyShortUrl()}
                      className="rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_10%,transparent)] px-4 py-2 text-sm font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)]"
                    >
                      {shortCopied ? t("copiedShortLink") : t("shortLink")}
                    </button>
                  ) : meta.isOwner ? (
                    <button
                      type="button"
                      disabled={mintBusy}
                      onClick={() => void mintShareCode()}
                      className="rounded-full border border-dashed border-[color:var(--gc-border)] px-4 py-2 text-sm text-[var(--gc-text-soft)] disabled:opacity-50"
                    >
                      {mintBusy ? t("mintingShort") : t("generateShortLink")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={remixBusy}
                    onClick={() => void remix()}
                    className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-2 text-sm font-medium text-[var(--gc-text)] disabled:opacity-50"
                  >
                    {remixBusy
                      ? t("remixing")
                      : meta.isSampleGallery
                        ? t("cloneToMine")
                        : "Remix"}
                  </button>
                </>
              }
              details={
                <div className="space-y-3 text-xs text-[var(--gc-muted)]">
                  <WorkUidCopy id={id} />
                  {shortUrl ? (
                    <p>
                      {t("shortLinkLabel")}{" "}
                      <code className="break-all text-[var(--gc-text-soft)]">{shortUrl}</code>
                    </p>
                  ) : null}
                  {meta.shareCode ? (
                    <WorkShareBar
                      workType="game"
                      workId={id}
                      title={meta.title}
                      patchUrl={`/api/projects/${id}`}
                      initialShareCode={meta.shareCode}
                    />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={withLocalePath(`/create?from=${encodeURIComponent(id)}`, locale)}
                      className="rounded-full border border-[color:var(--gc-border)] px-3 py-1.5 text-[var(--gc-text-soft)] hover:text-[var(--gc-text)]"
                    >
                      {t("regenerateSame")}
                    </Link>
                    <Link href={withLocalePath("/create", locale)} className="rounded-full px-3 py-1.5 hover:text-[var(--gc-text)]">
                      {t("newBlankCreate")}
                    </Link>
                    {meta.isOwner ? (
                      <Link href={withLocalePath("/studio", locale)} className="rounded-full px-3 py-1.5 text-[color:color-mix(in_srgb,var(--gc-accent)_90%,white)]">
                        {t("studio")}
                      </Link>
                    ) : (
                      <span>{t("guestPlayHint")}</span>
                    )}
                  </div>
                </div>
              }
            />
            </div>

            <div className="order-1 sm:order-2">
            <GameRuntimeTabs
              spec={spec}
              projectId={id}
              allowOfflineExport={meta.isOwner}
              phaser={<GamePlayer spec={spec} immersive promptHint={meta.prompt} coverCapture={meta.isOwner ? { projectId: id } : null} projectId={id} creativeRevisionId={playRevisionId ?? undefined} onIterate={(instr) => {
                setPatchPrompt(instr);
                setTimeout(() => {
                  document.getElementById("patch-prompt")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  document.getElementById("patch-prompt")?.focus();
                }, 100);
              }} />}
            />
            </div>
            <div className="order-3 px-3 sm:px-0">
            {meta.isOwner ? (
              <SpecQuickTunePanel
                spec={spec}
                onChange={(next) => setSpec(next)}
                editorSchema={editorSchema}
                onWish={(wish) => {
                  setPatchPrompt(wish);
                  setPatchError(null);
                  setSaveMsg(null);
                  document.getElementById("patch-prompt")?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              />
            ) : null}

            {/* Runtime AI patch panel */}
            <div className="space-y-3 rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--gc-text-soft)]">{t("coCreateTitle")}</p>
                <p className="text-xs leading-relaxed text-[var(--gc-muted)]">
                  {t("coCreateDesc")}
                  {meta.isOwner ? t("coCreateOwnerHint") : ""}
                </p>
              </div>
              {meta.isOwner ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="text-[var(--gc-muted)]">{t("modeLabel")}</span>
                  <button
                    type="button"
                    onClick={() => setRefineMode("patch")}
                    className={`rounded-full px-3 py-1 font-medium ${
                      refineMode === "patch"
                        ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_22%,transparent)] text-[var(--gc-text)]"
                        : "border border-[color:var(--gc-border)] text-[var(--gc-muted)]"
                    }`}
                  >
                    {t("modePatch")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefineMode("regenerate")}
                    className={`rounded-full px-3 py-1 font-medium ${
                      refineMode === "regenerate"
                        ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_22%,transparent)] text-[var(--gc-text)]"
                        : "border border-[color:var(--gc-border)] text-[var(--gc-muted)]"
                    }`}
                  >
                    {t("modeRegenerate")}
                  </button>
                </div>
              ) : null}
              <form onSubmit={(e) => void applyPatch(e)} className="flex items-center gap-2">
                <input
                  id="patch-prompt"
                  name="patch-prompt"
                  type="text"
                  value={patchPrompt}
                  onChange={(e) => {
                    setPatchPrompt(e.target.value);
                    setPatchError(null);
                    setSaveMsg(null);
                  }}
                  placeholder={t("patchPlaceholder")}
                  disabled={patchBusy}
                  className="min-w-0 flex-1 rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-2 text-sm text-[var(--gc-text)] placeholder:text-[var(--gc-muted)] focus:outline-none focus:ring-1 focus:ring-[color:color-mix(in_srgb,var(--gc-accent)_50%,transparent)] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={patchBusy || !patchPrompt.trim()}
                  className="shrink-0 rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)] px-5 py-2 text-sm font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_20%,transparent)] disabled:opacity-40"
                >
                  {patchBusy
                    ? refineMode === "regenerate"
                      ? t("generating")
                      : t("patching")
                    : meta?.isOwner && refineMode === "regenerate"
                      ? t("aiRegenerate")
                      : t("aiPatch")}
                </button>
                {meta.isOwner ? (
                  <button
                    type="button"
                    disabled={saveBusy}
                    onClick={() => void saveProjectSpec()}
                    className="shrink-0 rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-5 py-2 text-sm font-medium text-[var(--gc-text)] hover:bg-[var(--gc-surface-glass-strong)] disabled:opacity-40"
                  >
                    {saveBusy ? t("saving") : t("applyAndSave")}
                  </button>
                ) : null}
              </form>
              {meta.isOwner && refinementHistory.length > 0 ? (
                <div className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-3 py-2 text-[11px] text-[var(--gc-muted)]">
                  <p className="mb-1 font-medium text-[var(--gc-text-soft)]">{t("recentRefineTitle")}</p>
                  <ul className="max-h-28 space-y-1 overflow-y-auto">
                    {refinementHistory.map((r, i) => (
                      <li key={`${r.at}-${i}`} className="truncate">
                        <span className="text-[var(--gc-text-faint)]">{r.mode}</span> · {r.instruction}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {meta.isOwner && core?.revision ? (
                <div className="rounded-xl border border-sky-400/25 bg-sky-950/20 px-3 py-2 text-[11px] text-sky-100" data-testid="game-core-revision">
                  <CreatorVersionStatus core={core} work={{ type: "game", id }} className="mb-2" />
                  <p className="font-medium">{t("coreRevision", { sequence: core.revision.sequence })}</p>
                  <p className="mt-1 truncate text-sky-100/70">{core.revision.summary ?? t("coreRevisionReady")}</p>
                  {core.project?.evaluation && core.revision.status === "ready" ? (
                    <p className="mt-1 text-sky-100/70" data-testid="game-core-evaluation">
                      {t("coreQuality", { verdict: core.project.evaluation.verdict, score: core.project.evaluation.score })}
                    </p>
                  ) : null}
                  {core.project?.publications?.[0] ? (
                    <p className="mt-1 text-sky-100/70" data-testid="game-core-publication">
                      {t("corePublication", { action: core.project.publications[0].action, visibility: core.project.publications[0].visibility })}
                    </p>
                  ) : null}
                  {graphItemCount(core.revision, "scene_graph", "scenes") !== null && graphItemCount(core.revision, "behavior_graph", "nodes") !== null ? (
                    <p className="mt-1 text-sky-100/70" data-testid="game-design-graph">
                      {t("designGraphReady", {
                        scenes: graphItemCount(core.revision, "scene_graph", "scenes") ?? 0,
                        behaviors: graphItemCount(core.revision, "behavior_graph", "nodes") ?? 0,
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {meta.isOwner ? (
                <div className="rounded-xl border border-violet-400/25 bg-violet-950/20 px-3 py-2 text-[11px] text-violet-100" data-testid="game-asset-job">
                  {assetJob ? (
                    <p>{t("assetJobActive", { percent: assetJob.progress?.percent ?? 0, stage: assetJob.progress?.stage ?? assetJob.status })}</p>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <p>{t("assetJobReady")}</p>
                      <button type="button" disabled={assetJobBusy} onClick={() => void queueAssetRecovery()} className="rounded-full border border-violet-300/35 px-2 py-1 font-medium hover:bg-violet-300/10 disabled:opacity-50">
                        {assetJobBusy ? t("assetJobQueueing") : t("assetJobStart")}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
              {meta.isOwner && playtestAdvice.length > 0 ? (
                <div className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-3 py-2 text-[11px]" data-testid="game-playtest-advice">
                  <p className="font-medium text-[var(--gc-text-soft)]">{t("playtestAdviceTitle")}</p>
                  <ul className="mt-1 space-y-1 text-[var(--gc-muted)]">
                    {playtestAdvice.map((advice) => <li key={advice.kind}>{t(`playtestAdvice.${advice.kind}`)}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
            {saveMsg ? (
              <p className="text-xs text-emerald-400" role="status">
                {saveMsg}
              </p>
            ) : null}
            {patchError ? (
              <p className="text-xs text-red-400">{patchError}</p>
            ) : null}
            </div>
            </div>
              </>
            )}
          {spec && meta && (
            <div className="px-3 sm:px-0">
              <WorkCommentSection workType="game" workId={id} />
            </div>
          )}
          </>
        )}
      </main>
      </AppMain>
    </AppPageShell>
  );
}
