"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameSpec } from "@/lib/game-spec";
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

export function useGodotWebExport(
  spec: GameSpec | null,
  projectId?: string,
  referencePayloads?: RuntimeReferencePayload[],
  referenceHandles?: ReferenceImageHandle[],
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
        setError(e instanceof Error ? e.message : "GameSpec 无法序列化");
        return;
      }

      let payload: string;
      try {
        payload = safeJsonStringify(body);
      } catch (e) {
        setState("error");
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          msg.includes("Maximum call stack")
            ? "游戏数据过大或结构异常，请去掉部分参考图后重试"
            : "GameSpec 无法序列化",
        );
        return;
      }

      const res = await fetch("/api/godot/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        const err = data.error ?? "Godot 在线版构建失败";
        setError(
          err.includes("Maximum call stack")
            ? "游戏数据过大或结构异常，请去掉部分参考图后重试"
            : err,
        );
        return;
      }
      if (!data.buildUrl) {
        setState("error");
        setError("未返回构建地址");
        return;
      }
      setReferenceSummary(data.referenceSummary ?? null);
      applyReady(data.buildUrl, !!data.cached, signature);
    } catch (e) {
      setState("error");
      const msg = e instanceof Error ? e.message : "网络异常";
      setError(
        msg.includes("Maximum call stack")
          ? "游戏数据过大或结构异常，请去掉部分参考图后重试"
          : msg,
      );
    } finally {
      inflightRef.current = false;
    }
  }, [applyReady, projectId]);

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
