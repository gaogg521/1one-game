"use client";

import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { coerceGameSpec } from "@/lib/normalize-spec";
import { prefetchGodotExport } from "@/lib/godot-prefetch.client";
import { isGodotExportSupported } from "@/lib/godot-spec-bridge-codegen";
import { PRODUCT } from "@/lib/product-config";
import { SAMPLES } from "@/lib/samples";

const inflight = new Set<string>();

/** 样品馆：进入页面后为全部样品 prompt 后台预导出 Godot */
export function prefetchSamplesGodotExports(limit = SAMPLES.length): void {
  if (!PRODUCT.godot.enabled || SAMPLES.length === 0) return;

  for (const s of SAMPLES.slice(0, limit)) {
    if (inflight.has(s.id)) continue;
    inflight.add(s.id);
    void (async () => {
      try {
        const raw = mockSpecFromPrompt(s.prompt);
        const coerced = coerceGameSpec(raw);
        if (!coerced.ok || !isGodotExportSupported(coerced.spec)) return;
        prefetchGodotExport(coerced.spec);
      } catch {
        /* 忽略单条失败 */
      } finally {
        inflight.delete(s.id);
      }
    })();
  }
}
