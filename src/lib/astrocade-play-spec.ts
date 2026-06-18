import type { GameSpec } from "@/lib/game-spec";
import { shouldUseDedicatedSceneForTemplateFirst } from "@/lib/agentic/game-module";

export { ASTROCADE_INVARIANTS, checkAstrocadeParity, resolveAstrocadePlayRoute } from "@/lib/astrocade-architecture";

/**
 * 试玩前规范化：旧项目/复制体可能仍带 agenticModule，剥离后路由专用 Scene（竞对对齐）。
 */
export function normalizeAstrocadePlaySpec(spec: GameSpec): GameSpec {
  if (spec.agenticPlayRoute === "agentic") return spec;
  if (!shouldUseDedicatedSceneForTemplateFirst(spec)) return spec;
  if (!spec.agenticModule?.source) return spec;
  const { agenticModule: _removed, ...rest } = spec;
  return rest;
}

/** 该模板在 Phaser 专用 Scene 上 polish 高于 Godot 通用母版 */
export function prefersPhaserAstrocadeScene(spec: GameSpec): boolean {
  return shouldUseDedicatedSceneForTemplateFirst(spec);
}
