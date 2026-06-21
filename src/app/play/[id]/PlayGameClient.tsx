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
import { writeAssetManifestToSession } from "@/lib/assets/asset-manifest-session.client";
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
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { resolveClientApiError } from "@/lib/i18n/resolve-client-api-error";

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

  const apiHeaders = (init?: HeadersInit) => mergeLocaleHeaders(locale, init);

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
          };
          refinementHistory?: Array<{ at: string; mode: string; instruction: string }>;
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
          // 保险：若精灵/背景尚未生成，后台静默触发一次（服务端有缓存，重复无害）
          void fetch(`/api/projects/${id}/background`, {
            method: "POST",
            keepalive: true,
            headers: apiHeaders(),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((payload) => {
              if (payload?.assetManifest) writeAssetManifestToSession(payload.assetManifest);
            })
            .catch(() => {});
          setMeta({
            title: data.project.title,
            prompt: data.project.prompt,
            isOwner: data.project.isOwner,
            isSampleGallery: Boolean(data.project.isSampleGallery),
            shareCode: data.project.shareCode ?? null,
            likeCount: data.project.likeCount ?? 0,
            playCount: data.project.playCount ?? 0,
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
        }
      } catch {
        if (!cancelled) setError(t("networkError"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, locale, t]);

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

  return (
    <AppPageShell className="text-[var(--gc-text)]">
      {!meta?.isSampleGallery ? <SiteHeader /> : null}
      <AppMain>
      <main className={`mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:py-10 lg:px-8 xl:pr-12 ${meta?.isSampleGallery ? "max-w-4xl" : ""}`}>
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={withLocalePath("/samples", locale)}
                    className="text-sm font-medium text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
                  >
                    ← {t("backToSamples")}
                  </Link>
                  <h1 className="min-w-0 flex-1 text-center text-lg font-semibold tracking-tight text-[var(--gc-text)] sm:text-xl">
                    {meta.title}
                  </h1>
                  <div className="flex flex-wrap justify-end gap-2">
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
                <GamePlayer spec={spec} immersive projectId={id} promptHint={meta.prompt} />
              </>
            ) : (
              <>
            {parityInfo ? (
              <SampleParityTrustBadge info={parityInfo} />
            ) : null}
            <ResultMomentBanner
              mode="game"
              title={resultTitle}
              subtitle={resultSubtitle}
              actions={
                <>
                  <WorkEngagementStats kind="game" playCount={playCount} likeCount={likeCount} hideLikes size="md" />
                  <GameRuntimePreferenceControl />
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

            <GameRuntimeTabs
              spec={spec}
              projectId={id}
              phaser={<GamePlayer spec={spec} promptHint={meta.prompt} coverCapture={meta.isOwner ? { projectId: id } : null} projectId={id} onIterate={(instr) => {
                setPatchPrompt(instr);
                setTimeout(() => {
                  document.getElementById("patch-prompt")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  document.getElementById("patch-prompt")?.focus();
                }, 100);
              }} />}
            />
            {meta.isOwner ? <SpecQuickTunePanel spec={spec} onChange={(next) => setSpec(next)} /> : null}

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
            </div>
            {saveMsg ? (
              <p className="text-xs text-emerald-400" role="status">
                {saveMsg}
              </p>
            ) : null}
            {patchError ? (
              <p className="text-xs text-red-400">{patchError}</p>
            ) : null}
              </>
            )}
          {spec && meta && (
            <WorkCommentSection workType="game" workId={id} />
          )}
          </>
        )}
      </main>
      </AppMain>
    </AppPageShell>
  );
}
