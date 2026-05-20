"use client";

import { coerceGameSpec } from "@/lib/normalize-spec";
import { prefetchGodotExport } from "@/lib/godot-prefetch.client";
import { isGodotExportSupported } from "@/lib/godot-spec-bridge-codegen";
import { PRODUCT } from "@/lib/product-config";

const inflight = new Set<string>();

/** 任意列表页：按 projectId 后台预导出 Godot（工作室 / 发现 / 首页热门等共用） */
export function prefetchGameProjectsByIds(projectIds: string[], limit = 6): void {
  if (!PRODUCT.godot.enabled || projectIds.length === 0) return;

  const slice = projectIds.slice(0, limit);
  for (const id of slice) {
    if (inflight.has(id)) continue;
    inflight.add(id);
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${id}`);
        if (!res.ok) return;
        const data = (await res.json()) as { spec?: unknown };
        if (!data.spec) return;
        const coerced = coerceGameSpec(data.spec);
        if (!coerced.ok || !isGodotExportSupported(coerced.spec)) return;
        prefetchGodotExport(coerced.spec, { projectId: id });
      } catch {
        /* 忽略单条失败 */
      } finally {
        inflight.delete(id);
      }
    })();
  }
}

/** @deprecated 使用 prefetchGameProjectsByIds */
export function prefetchStudioGameProjects(projectIds: string[], limit = 4): void {
  prefetchGameProjectsByIds(projectIds, limit);
}
