import type { GameSpec } from "@/lib/game-spec";

/**
 * 由 GameSpec 内容派生一个稳定的 previewId（"preview-XXXX"）。
 *
 * 用法：
 *   - 创作台生成 spec 后还没保存为 Project 时，用 derivePreviewId(spec) 喂给
 *     <GamePlayer projectId={...}>；这样 Scene 仍然走"远程 sprite 优先 + 程序化兜底"
 *     的双路径，不会因为 projectId 缺失跳过 sprite preload。
 *   - 同一份 spec 永远派生同一个 previewId，便于 AI 异步资产管线落盘到
 *     `public/game-sprites/preview-XXXX/` 后下次进入时直接命中。
 *
 * 注：派生算法用 FNV-1a 32bit 哈希，目标键 = templateId + title + theme + assetStyle。
 *     不依赖 Date.now / Math.random，跨刷新结果稳定。
 */
export function derivePreviewId(spec: GameSpec): string {
  const key = [
    spec.templateId,
    spec.title,
    spec.theme.backgroundColor,
    spec.theme.playerColor,
    spec.theme.hazardColor,
    spec.theme.collectibleColor ?? "",
    spec.theme.particleTint ?? "",
    spec.presentation?.assetStyle ?? "",
    spec.presentation?.musicProfile ?? "",
    spec.labels?.player ?? "",
    spec.labels?.hazard ?? "",
  ].join("|");

  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return `preview-${hex}`;
}
