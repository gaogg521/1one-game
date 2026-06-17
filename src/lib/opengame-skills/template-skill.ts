import type { GameSpec } from "@/lib/game-spec";
import { resolveTemplateArchetype } from "@/lib/opengame-skills/template-archetypes";

/**
 * Template Skill — 为 Agentic LLM 注入 OpenGame 式稳定 scaffold（单文件 Template Method）。
 */
export function buildTemplateSkillSystemAppend(): string {
  return `
Template Skill (OpenGame-inspired single-file scaffold):
Inside create(scene), follow this skeleton — do NOT skip steps:
1. CONFIG: const WIN=ctx.winScore??100; const colors from ctx.colors
2. let gameCompleted=false; guard all onEnd calls
3. setupWorld(): background + boundaries/platforms/path/grid
4. createEntities(): player + hazards/collectibles/enemies
5. createHUD(): scene.add.text score/lives (setScrollFactor(0), depth 100+)
6. wireInput(): pointer/keyboard + physics overlap/collider
7. update?(scene,time,delta): spawners, timers, win/lose checks
Must call ctx.onEnd(true|false). No generic click-for-score unless template is ui_heavy quiz.`;
}

export function buildTemplateSkillUserAppend(prompt: string, spec: GameSpec): string {
  const archetype = resolveTemplateArchetype(spec, prompt);
  const lines = [
    "",
    `Template Skill archetype: ${archetype.label} (OpenGame module: ${archetype.opengameModule})`,
    `Physics profile: ${archetype.physicsProfile}`,
    "Required hooks in create():",
    ...archetype.hooks.map((h) => `  - ${h}`),
    "",
    ...archetype.scaffoldLines,
    "",
    "Playability floor:",
    ...archetype.playabilityChecks.map((c) => `  - ${c}`),
  ];
  return lines.join("\n");
}

export function buildTemplateSkillRepairAppend(spec: GameSpec, prompt: string): string {
  const archetype = resolveTemplateArchetype(spec, prompt);
  return [
    `Template Skill repair: re-implement ${archetype.label} hooks:`,
    archetype.hooks.join(", "),
    ...archetype.scaffoldLines.slice(0, 3),
  ].join("\n");
}
