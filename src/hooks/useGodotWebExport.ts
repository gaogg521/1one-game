"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppLocale } from "@/i18n/routing";
import type { GameSpec } from "@/lib/game-spec";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import { apiErrorMessage } from "@/lib/i18n/progress-message";
import { tMessage } from "@/lib/i18n/messages";
import { buildGodotExportRequestPayload } from "@/lib/godot-export-request.client";
import { safeJsonStringify } from "@/lib/safe-json";
import { getPrefetchedGodotBuild, prefetchGodotExport } from "@/lib/godot-prefetch.client";
import { isGodotExportSupported } from "@/lib/godot-spec-bridge-codegen";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import type { ReferenceImageHandle } from "@/lib/assets/reference-image-storage.types";
import type { GodotReferenceBuildSummary } from "@/lib/godot-export-refs";
import { combinedReferenceDigest } from "@/lib/reference-payloads-digest";

export type GodotExportState = "idle" | "loading" | "ready" | "error" | "unsupported";

function specSignature(spec: GameSpec, projectId?: string, refDigest = "0"): string {
  return `${projectId ?? ""}:${spec.templateId}:${spec.title}:${refDigest}`;
}

function isStackOverflowMessage(msg: string): boolean {
  return msg.includes("Maximum call stack");
}

export function useGodotWebExport(
  spec: GameSpec | null,
  projectId?: string,
  referencePayloads?: RuntimeReferencePayload[],
  referenceHandles?: ReferenceImageHandle[],
  uiLocale: AppLocale = "zh-Hans",
) {
  const [state, setState] = useState<GodotExportState>("idle");
  const [buildUrl, setBuildUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [referenceSummary, setReferenceSummary] = useState<GodotReferenceBuildSummary | null>(null);
  const inflightRef = useRef(false);
  const readySigRef = useRef("");

  const specRef = useRef(spec);
  const refsRef = useRef(referencePayloads);
  const handlesRef = useRef(referenceHandles);
  specRef.current = spec;
  refsRef.current = referencePayloads;
  handlesRef.current = referenceHandles;

  const refDigest = useMemo(
    () => combinedReferenceDigest(referencePayloads, referenceHandles),
    [referencePayloads, referenceHandles],
  );

  const sig = useMemo(
    () => (spec ? specSignature(spec, projectId, refDigest) : ""),
    [spec, projectId, refDigest],
  );

  const applyReady = useCallback((url: string, fromCache: boolean, signature: string) => {
    readySigRef.current = signature;
    setBuildUrl(url);
    setCached(fromCache);
    setState("ready");
    setError(null);
  }, []);

  const runExport = useCallback(async () => {
    const currentSpec = specRef.current;
    if (!currentSpec || !isGodotExportSupported(currentSpec)) {
      setState("unsupported");
      return;
    }
    if (inflightRef.current) return;

    const signature = specSignature(
      currentSpec,
      projectId,
      combinedReferenceDigest(refsRef.current, handlesRef.current),
    );

    if (readySigRef.current === signature) {
      setState("ready");
      return;
    }

    const pref = getPrefetchedGodotBuild(currentSpec, projectId, refsRef.current, handlesRef.current);
    if (pref) {
      applyReady(pref.buildUrl, pref.cached, signature);
      return;
    }

    inflightRef.current = true;

    try {
      setState("loading");
      setError(null);
      setReferenceSummary(null);

      let body: Record<string, unknown>;
      try {
        body = buildGodotExportRequestPayload({
          spec: currentSpec,
          projectId,
          referencePayloads: refsRef.current,
          referenceHandles: handlesRef.current,
          target: "web",
        });
      } catch (e) {
        setState("error");
        setError(
          e instanceof Error && isStackOverflowMessage(e.message)
            ? apiErrorMessage(uiLocale, "godotDataTooLarge")
            : apiErrorMessage(uiLocale, "gameSpecSerializeFailed"),
        );
        return;
      }

      let payload: string;
      try {
        payload = safeJsonStringify(body);
      } catch (e) {
        setState("error");
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          isStackOverflowMessage(msg)
            ? apiErrorMessage(uiLocale, "godotDataTooLarge")
            : apiErrorMessage(uiLocale, "gameSpecSerializeFailed"),
        );
        return;
      }

      const res = await fetch("/api/godot/export", {
        method: "POST",
        headers: mergeLocaleHeaders(uiLocale, { "Content-Type": "application/json" }),
        body: payload,
      });
      const data = (await res.json()) as {
        buildUrl?: string;
        cached?: boolean;
        referenceSummary?: GodotReferenceBuildSummary;
        error?: string;
      };
      if (!res.ok) {
        setState("error");
        const err = data.error ?? apiErrorMessage(uiLocale, "godotBuildFailed");
        setError(isStackOverflowMessage(err) ? apiErrorMessage(uiLocale, "godotDataTooLarge") : err);
        return;
      }
      if (!data.buildUrl) {
        setState("error");
        setError(apiErrorMessage(uiLocale, "godotNoBuildUrl"));
        return;
      }
      setReferenceSummary(data.referenceSummary ?? null);
      applyReady(data.buildUrl, !!data.cached, signature);
    } catch (e) {
      setState("error");
      const msg = e instanceof Error ? e.message : tMessage(uiLocale, "godotExport.networkError");
      setError(
        isStackOverflowMessage(msg) ? apiErrorMessage(uiLocale, "godotDataTooLarge") : msg,
      );
    } finally {
      inflightRef.current = false;
    }
  }, [applyReady, projectId, uiLocale]);

  useEffect(() => {
    if (!spec || !sig) {
      setState("idle");
      setBuildUrl(null);
      readySigRef.current = "";
      return;
    }
    if (!isGodotExportSupported(spec)) {
      setState("unsupported");
      setBuildUrl(null);
      readySigRef.current = "";
      return;
    }

    const pref = getPrefetchedGodotBuild(spec, projectId, referencePayloads, referenceHandles);
    if (pref) {
      applyReady(pref.buildUrl, pref.cached, sig);
    }

    prefetchGodotExport(spec, { projectId, referencePayloads, referenceHandles });
    void runExport();
  }, [sig, runExport, applyReady, projectId, referencePayloads, referenceHandles]);

  return {
    state,
    buildUrl,
    error,
    cached,
    referenceSummary,
    retry: runExport,
    supported: Boolean(spec && isGodotExportSupported(spec)),
  };
}
