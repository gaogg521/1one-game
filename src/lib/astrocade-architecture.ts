/**
 * Astrocade 竞对 — 平台技术架构（非单游戏补丁）
 *
 * 三层运行时：
 * 1. Primary   — Phaser 专用 Scene（样品 / 用户 template-first / 克隆 同路由）
 * 2. Secondary — Godot ai-mother-universal（Web 导出 / 3D 演进）
 * 3. Advanced  — Agentic LLM（AGENTIC_FORCE_LLM=1 或显式 attach，定制玩法）
 */
import type { GameSpec } from "@/lib/game-spec";
import { shouldUseAgenticRuntime, shouldUseDedicatedSceneForTemplateFirst } from "@/lib/agentic/game-module";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import { GAME_TEMPLATE_IDS } from "@/lib/game-templates/registry";
import { PRODUCT } from "@/lib/product-config";
import { normalizeAstrocadePlaySpec } from "@/lib/astrocade-play-spec";

export type AstrocadeRuntimeTier = "primary-dedicated" | "advanced-agentic" | "secondary-godot";

export type AstrocadePlayRoute = {
  tier: AstrocadeRuntimeTier;
  phaserScene: string;
  templateId: string;
  /** 与样品馆是否同一路由规则 */
  sampleParity: boolean;
};

/** 平台级不变量（QA / 文档共用） */
export const ASTROCADE_INVARIANTS = [
  "样品馆、用户新建、duplicate 克隆：同 templateId → 同 Phaser 专用 Scene",
  "template-first 默认不 attach agenticModule（dedicatedSceneForTemplateFirst）",
  "试玩前 normalizeAstrocadePlaySpec 剥离旧 agenticModule",
  "玩法变体由 GameSpec 蓝图字段 + prompt 语义推断写入 specJson",
  "竞品级 per-game 定制写入 spec.samplePlayProfile（seed/clone 烘焙，Scene 读 profile 不查 sampleId）",
  "封面/试玩资产 V2 manifest 双轨一致",
  "Godot 为 Secondary；竞对 polish 默认 Phaser Primary",
  "duplicate/enrich 保留 samplePlayProfile；用户与样品同 prompt 同 Scene 族",
  "用户 POST prompt 与样品完全一致时 enrich 自动套用 samplePlayProfile（inferSampleIdFromPrompt）",
] as const;

/** 解析试玩路由（Astrocade 对齐入口） */
export function resolveAstrocadePlayRoute(spec: GameSpec): AstrocadePlayRoute {
  const normalized = normalizeAstrocadePlaySpec(spec);
  const phaserScene = expectedPhaserSceneName(normalized);

  if (shouldUseAgenticRuntime(normalized)) {
    return {
      tier: "advanced-agentic",
      phaserScene,
      templateId: normalized.templateId,
      sampleParity: false,
    };
  }

  const dedicated = shouldUseDedicatedSceneForTemplateFirst(normalized);

  return {
    tier: dedicated ? "primary-dedicated" : "advanced-agentic",
    phaserScene,
    templateId: normalized.templateId,
    sampleParity: dedicated && PRODUCT.game.dedicatedSceneForTemplateFirst,
  };
}

export type ParityViolation = { code: string; message: string };

/** 检查单份 spec 是否满足 Astrocade 平台 parity（不含 Agentic 高级路径） */
export function checkAstrocadeParity(
  spec: GameSpec,
  opts: { expectDedicated?: boolean; label?: string } = {},
): ParityViolation[] {
  const label = opts.label ?? spec.title;
  const violations: ParityViolation[] = [];
  const route = resolveAstrocadePlayRoute(spec);
  const expectDedicated = opts.expectDedicated ?? true;

  if (expectDedicated && route.phaserScene === "AgenticScene") {
    violations.push({
      code: "ROUTE_AGENTIC",
      message: `${label}: expected dedicated Scene, got AgenticScene`,
    });
  }
  if (expectDedicated && shouldUseAgenticRuntime(spec)) {
    violations.push({
      code: "SPEC_HAS_AGENTIC",
      message: `${label}: agenticModule should be stripped for template-first`,
    });
  }
  if (expectDedicated && !shouldUseDedicatedSceneForTemplateFirst(spec)) {
    violations.push({
      code: "NOT_TEMPLATE_FIRST",
      message: `${label}: template ${spec.templateId} not in agenticTemplateFirst`,
    });
  }
  return violations;
}

/** 全模板是否均在 template-first 列表（平台覆盖度） */
export function templateFirstCoverage(): { covered: string[]; missing: string[] } {
  const list = PRODUCT.game.agenticTemplateFirst;
  const covered = GAME_TEMPLATE_IDS.filter((id) => list.includes(id));
  const missing = GAME_TEMPLATE_IDS.filter((id) => !list.includes(id));
  return { covered, missing };
}
