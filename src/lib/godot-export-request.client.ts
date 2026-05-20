import type { GameSpec } from "@/lib/game-spec";
import { safeJsonStringify, toPlainJson } from "@/lib/safe-json";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import type { ReferenceImageHandle } from "@/lib/assets/reference-image-storage.types";

export type GodotExportTarget = "web" | "windows" | "project" | "android";

const DEFAULT_MAX_JSON_CHARS = 480_000;

export function buildGodotExportRequestPayload(
  params: {
    spec: GameSpec;
    projectId?: string;
    referencePayloads?: RuntimeReferencePayload[];
    referenceHandles?: ReferenceImageHandle[];
    target?: GodotExportTarget;
  },
  opts?: { maxJsonChars?: number },
): Record<string, unknown> {
  const maxChars = opts?.maxJsonChars ?? DEFAULT_MAX_JSON_CHARS;
  const plainSpec = toPlainJson(params.spec) as GameSpec;
  let refs = params.referencePayloads?.length
    ? params.referencePayloads.map((r) => toPlainJson(r))
    : undefined;

  const handles = params.referenceHandles?.length
    ? params.referenceHandles.map((h) => toPlainJson(h))
    : undefined;

  const pack = (includeRefs: boolean) => ({
    spec: plainSpec,
    projectId: params.projectId,
    target: params.target ?? "web",
    ...(handles?.length ? { referenceHandles: handles } : {}),
    ...(includeRefs && refs?.length ? { referencePayloads: refs } : {}),
  });

  let body = pack(true);
  try {
    let json = safeJsonStringify(body);
    while (json.length > maxChars && refs && refs.length > 0) {
      refs = refs.slice(0, -1);
      body = pack(true);
      json = safeJsonStringify(body);
    }
    if (json.length > maxChars) {
      body = pack(false);
    }
  } catch {
    body = pack(false);
  }
  return body;
}
