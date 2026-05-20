"use client";

import type { GameSpec } from "@/lib/game-spec";
import { buildGodotExportRequestPayload } from "@/lib/godot-export-request.client";
import { safeJsonStringify } from "@/lib/safe-json";
import { isGodotExportSupported } from "@/lib/godot-spec-bridge-codegen";
import { PRODUCT } from "@/lib/product-config";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import type { ReferenceImageHandle } from "@/lib/assets/reference-image-storage.types";
import { combinedReferenceDigest } from "@/lib/reference-payloads-digest";

type PrefetchEntry = {
  buildUrl: string;
  cached: boolean;
  at: number;
};

const mem = new Map<string, PrefetchEntry>();
const inflight = new Map<string, Promise<PrefetchEntry | null>>();
const SESSION_PREFIX = "1one-godot-build:";

function cacheKey(
  spec: GameSpec,
  projectId?: string,
  referencePayloads?: RuntimeReferencePayload[],
  referenceHandles?: ReferenceImageHandle[],
): string {
  const ref = combinedReferenceDigest(referencePayloads, referenceHandles);
  return `${projectId ?? "draft"}:${spec.templateId}:${spec.title}:${ref}`;
}

function readSession(key: string): PrefetchEntry | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${SESSION_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PrefetchEntry;
    if (parsed?.buildUrl) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function writeSession(key: string, entry: PrefetchEntry): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(`${SESSION_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

export function getPrefetchedGodotBuild(
  spec: GameSpec,
  projectId?: string,
  referencePayloads?: RuntimeReferencePayload[],
  referenceHandles?: ReferenceImageHandle[],
): PrefetchEntry | null {
  const key = cacheKey(spec, projectId, referencePayloads, referenceHandles);
  return mem.get(key) ?? readSession(key);
}

/**
 * 创作台生成完成后后台预导出 Godot Web，切换引擎时秒开缓存。
 */
export function prefetchGodotExport(
  spec: GameSpec,
  opts?: {
    projectId?: string;
    referencePayloads?: RuntimeReferencePayload[];
    referenceHandles?: ReferenceImageHandle[];
  },
): void {
  if (!PRODUCT.godot.enabled || !isGodotExportSupported(spec)) return;

  const key = cacheKey(spec, opts?.projectId, opts?.referencePayloads, opts?.referenceHandles);
  if (mem.has(key) || inflight.has(key) || readSession(key)) return;

  const p = fetch("/api/godot/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: safeJsonStringify(
      buildGodotExportRequestPayload({
        spec,
        projectId: opts?.projectId,
        referencePayloads: opts?.referencePayloads,
        referenceHandles: opts?.referenceHandles,
        target: "web",
      }),
    ),
  })
    .then(async (res) => {
      const data = (await res.json()) as { buildUrl?: string; cached?: boolean; error?: string };
      if (!res.ok || !data.buildUrl) return null;
      const entry: PrefetchEntry = { buildUrl: data.buildUrl, cached: !!data.cached, at: Date.now() };
      mem.set(key, entry);
      writeSession(key, entry);
      return entry;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, p);
}
