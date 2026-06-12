"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { GameSpec } from "@/lib/game-spec";
import { readReferenceImagePayloadsFromSession } from "@/lib/assets/reference-image-payloads.client";
import { readReferenceHandlesFromSession } from "@/lib/assets/reference-image-storage.client";
import { GodotOfflineDownloads } from "@/components/GodotOfflineDownloads";
import { GodotWebPlayer } from "@/components/GodotWebPlayer";
import { useGodotWebExport } from "@/hooks/useGodotWebExport";
import {
  GAME_RUNTIME_PREFERENCE_EVENT,
  getGameRuntimePreference,
  setGameRuntimePreference,
  type GameRuntimeChoice,
} from "@/lib/game-runtime-preference";
import { prefetchGodotExport } from "@/lib/godot-prefetch.client";
import { PRODUCT } from "@/lib/product-config";
import { isGodotExportSupported } from "@/lib/godot-spec-bridge-codegen";
import {
  countQueuedReferenceSources,
  formatGodotReferenceBuildHint,
} from "@/lib/godot-reference-build-hint";

type Props = {
  spec: GameSpec;
  projectId?: string;
  phaser: ReactNode;
  refEpoch?: number;
  allowRuntimeSwitch?: boolean;
};

function tabClass(active: boolean): string {
  return `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_22%,transparent)] text-[var(--gc-text)]"
      : "border border-[color:var(--gc-border)] text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
  }`;
}

export function GameRuntimeTabs({
  spec,
  projectId,
  phaser,
  refEpoch = 0,
  allowRuntimeSwitch = true,
}: Props) {
  const t = useTranslations("gameRuntime");
  const locale = useLocale() as AppLocale;
  const godotGloballyOn = PRODUCT.godot.enabled && allowRuntimeSwitch;
  const specSupportsGodot = isGodotExportSupported(spec);

  const [runtime, setRuntime] = useState<GameRuntimeChoice>(() => {
    if (!godotGloballyOn) return "phaser";
    return getGameRuntimePreference();
  });

  const pickRuntime = useCallback((next: GameRuntimeChoice) => {
    setRuntime(next);
    setGameRuntimePreference(next);
  }, []);

  useEffect(() => {
    const onPref = (e: Event) => {
      const detail = (e as CustomEvent<GameRuntimeChoice>).detail;
      if (detail === "phaser" || detail === "godot") setRuntime(detail);
    };
    window.addEventListener(GAME_RUNTIME_PREFERENCE_EVENT, onPref);
    return () => window.removeEventListener(GAME_RUNTIME_PREFERENCE_EVENT, onPref);
  }, []);

  const referencePayloads = useMemo(
    () => readReferenceImagePayloadsFromSession(),
    [spec, refEpoch],
  );
  const referenceHandles = useMemo(() => readReferenceHandlesFromSession(), [spec, refEpoch]);

  useEffect(() => {
    if (!godotGloballyOn || !specSupportsGodot) return;
    prefetchGodotExport(spec, { projectId, referencePayloads, referenceHandles });
  }, [spec, projectId, referencePayloads, referenceHandles, godotGloballyOn, specSupportsGodot]);

  const godot = useGodotWebExport(
    specSupportsGodot ? spec : null,
    projectId,
    referencePayloads,
    referenceHandles,
    locale,
  );

  const showPhaser = runtime === "phaser" || !godotGloballyOn || !specSupportsGodot;
  const showGodot = runtime === "godot" && godotGloballyOn && specSupportsGodot;
  const godotOnlineReady = godot.state === "ready" && !!godot.buildUrl;
  const queuedRefCount = countQueuedReferenceSources(referencePayloads, referenceHandles);
  const refBuildHint = formatGodotReferenceBuildHint(godot.referenceSummary, queuedRefCount, {
    loading: showGodot && godot.state === "loading",
    cached: godot.cached,
    uiLocale: locale,
  });

  return (
    <div className="space-y-3">
      {godotGloballyOn && specSupportsGodot ? (
        <p className="text-[11px] leading-relaxed text-[var(--gc-muted)]">
          {t.rich("hint", {
            godot: (chunks) => <strong className="text-[var(--gc-text-soft)]">{chunks}</strong>,
          })}
        </p>
      ) : null}

      {godotGloballyOn ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--gc-muted)]">{t("engineLabel")}</span>
          {specSupportsGodot ? (
            <button
              type="button"
              data-testid="runtime-tab-godot"
              className={tabClass(runtime === "godot")}
              onClick={() => pickRuntime("godot")}
              title={t("godotTitle")}
            >
              {t("godotOnline")}
            </button>
          ) : null}
          <button
            type="button"
            data-testid="runtime-tab-phaser"
            className={tabClass(runtime === "phaser")}
            onClick={() => pickRuntime("phaser")}
          >
            {t("phaserPreview")}
          </button>
          {showGodot && godot.state === "loading" ? (
            <span className="text-xs text-[var(--gc-accent)]">{refBuildHint ?? t("building")}</span>
          ) : null}
          {godot.cached && godot.state === "ready" ? (
            <span className="text-xs text-[var(--gc-text-faint)]">{t("cached")}</span>
          ) : null}
        </div>
      ) : null}

      {refBuildHint && (showGodot || godotOnlineReady) ? (
        <p
          className={`text-[11px] leading-relaxed ${
            godot.referenceSummary && godot.referenceSummary.imageCount > 0
              ? "text-[color:color-mix(in_srgb,var(--gc-accent)_85%,var(--gc-text-soft))]"
              : queuedRefCount > 0 && godot.state === "ready"
                ? "text-amber-400/90"
                : "text-[var(--gc-text-faint)]"
          }`}
          data-testid="godot-reference-build-hint"
        >
          {refBuildHint}
        </p>
      ) : null}

      {showGodot ? (
        <div className="space-y-3">
          {godot.state === "loading" ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[color:var(--gc-border)] px-4 text-center text-sm text-[var(--gc-muted)]">
              <span>{refBuildHint ?? t("buildingGodot")}</span>
              <span className="text-[11px] text-[var(--gc-text-faint)]">{t("readyHint")}</span>
            </div>
          ) : null}
          {godot.state === "error" ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              {godot.error ?? t("buildFailed")}
              <button
                type="button"
                onClick={() => void godot.retry()}
                className="ml-2 underline underline-offset-2 hover:text-red-200"
              >
                {t("retry")}
              </button>
            </div>
          ) : null}
          {godotOnlineReady ? (
            <>
              <GodotWebPlayer buildUrl={godot.buildUrl!} title={spec.title} />
              <GodotOfflineDownloads
                spec={spec}
                projectId={projectId}
                referencePayloads={referencePayloads}
                referenceHandles={referenceHandles}
                onlineReady
              />
            </>
          ) : null}
        </div>
      ) : null}

      {showPhaser ? phaser : null}

      {showPhaser && specSupportsGodot && godotOnlineReady && runtime === "phaser" ? (
        <p className="text-[11px] text-[var(--gc-text-faint)]">
          {t("godotReady")}
        </p>
      ) : null}
    </div>
  );
}
