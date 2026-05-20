import type { GameSpec } from "@/lib/game-spec";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import { enrichGameSpecForRuntime } from "@/lib/enrich-game-spec";
import { exportGameSpecToGodotWeb } from "@/lib/godot-export";
import { isGodotExportSupported } from "@/lib/godot-spec-bridge-codegen";
import { PRODUCT } from "@/lib/product-config";

/** 服务端：生成完成后异步预导出 Godot Web（不阻塞 SSE done） */
export function scheduleGodotPrefetch(
  spec: GameSpec,
  opts?: { projectId?: string; referencePayloads?: RuntimeReferencePayload[] },
): boolean {
  if (!PRODUCT.godot.enabled || !isGodotExportSupported(spec)) return false;

  const enriched = enrichGameSpecForRuntime(spec);
  const projectId = opts?.projectId ?? `prefetch-${enriched.templateId}`;

  void exportGameSpecToGodotWeb({
    spec: enriched,
    projectId,
    referencePayloads: opts?.referencePayloads,
  }).then((r) => {
    if (!r.ok) {
      console.warn("[godot-prefetch]", r.error);
    }
  });

  return true;
}

export function godotPrefetchTraceDetail(spec: GameSpec): Record<string, unknown> {
  const supported = PRODUCT.godot.enabled && isGodotExportSupported(spec);
  return {
    supported,
    templateId: spec.templateId,
    scheduled: supported,
  };
}
