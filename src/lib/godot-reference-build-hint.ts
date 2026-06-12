import type { AppLocale } from "@/i18n/routing";
import { godotBuildHintMessage } from "@/lib/i18n/chapter-labels";
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
  opts?: { loading?: boolean; cached?: boolean; uiLocale?: AppLocale },
): string | null {
  const locale = opts?.uiLocale ?? "zh-Hans";
  const msg = (key: string, params?: Record<string, string | number>) =>
    godotBuildHintMessage(locale, key, params);

  if (opts?.loading) {
    if (queuedCount > 0) {
      return msg("loadingWithRefs", { count: queuedCount });
    }
    return msg("loading");
  }

  if (!summary) return null;

  if (summary.imageCount > 0) {
    const parts: string[] = [];
    if (summary.hasBackground) parts.push(msg("detailMap"));
    if (summary.monsterCount > 0) parts.push(msg("detailMonster", { count: summary.monsterCount }));
    if (summary.towerSkinCount > 0) parts.push(msg("detailTower", { count: summary.towerSkinCount }));
    if (summary.hasProtagonist) parts.push(msg("detailProtagonist"));
    const listSep = locale.startsWith("zh") ? "、" : ", ";
    const detailWrap = locale.startsWith("zh")
      ? (s: string) => `（${s}）`
      : (s: string) => ` (${s})`;
    const detail = parts.length ? detailWrap(parts.join(listSep)) : "";
    const cacheNote = opts?.cached ? msg("cacheHit") : "";
    return msg("refsWritten", {
      count: summary.imageCount,
      detail,
      cache: cacheNote,
    });
  }

  if (queuedCount > 0) {
    return msg("queuedButFailed");
  }

  return msg("noRefs");
}
