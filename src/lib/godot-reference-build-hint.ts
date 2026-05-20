import type { GodotReferenceBuildSummary } from "@/lib/godot-export-refs";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import type { ReferenceImageHandle } from "@/lib/assets/reference-image-storage.types";

/** 客户端：本次排队可供 Godot 使用的参考图数量（session 像素 + 摄取句柄） */
export function countQueuedReferenceSources(
  payloads: RuntimeReferencePayload[] | undefined,
  handles: ReferenceImageHandle[] | undefined,
): number {
  const ordinals = new Set<number>();
  for (const p of payloads ?? []) ordinals.add(p.ordinal);
  for (const h of handles ?? []) ordinals.add(h.ordinal);
  return ordinals.size;
}

export function formatGodotReferenceBuildHint(
  summary: GodotReferenceBuildSummary | null | undefined,
  queuedCount: number,
  opts?: { loading?: boolean; cached?: boolean },
): string | null {
  if (opts?.loading) {
    if (queuedCount > 0) {
      return `正在构建 Godot 在线版，将尝试写入 ${queuedCount} 张参考图…`;
    }
    return "正在构建 Godot 在线版（约 10～30 秒）…";
  }

  if (!summary) return null;

  if (summary.imageCount > 0) {
    const parts: string[] = [];
    if (summary.hasBackground) parts.push("地图/背景");
    if (summary.monsterCount > 0) parts.push(`怪物×${summary.monsterCount}`);
    if (summary.towerSkinCount > 0) parts.push(`炮塔×${summary.towerSkinCount}`);
    if (summary.hasProtagonist) parts.push("主角/守点");
    const detail = parts.length ? `（${parts.join("、")}）` : "";
    const cacheNote = opts?.cached ? " · 命中缓存" : "";
    return `参考图已写入 Godot 构建：${summary.imageCount} 张${detail}${cacheNote}`;
  }

  if (queuedCount > 0) {
    return "已排队参考图，但未能写入 Godot 构建（将使用默认造型）。请重新「解析素材」后点 Godot 重试。";
  }

  return "本次 Godot 构建未包含参考贴图（仅使用默认造型）。";
}
