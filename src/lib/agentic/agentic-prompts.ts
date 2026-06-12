import type { GameSpec } from "@/lib/game-spec";
import { getTemplateDefinition } from "@/lib/game-templates/registry";

/** 各模板 Agentic 玩法约束（Astrocade 级：拒绝泛化点击计数器） */
const TEMPLATE_GAMEPLAY_HINTS: Partial<Record<GameSpec["templateId"], string>> = {
  avoider: "Dodge falling hazards; player moves with pointer; lose on hit, score over time",
  collector: "Move to collect gems while dodging hazards; win at target score",
  survivor: "Multi-life dodge survival with escalating spawn rate",
  platformer: "Side-view jump platformer: platforms, gaps, collectibles, reach goal",
  towerDefense: "Place towers on grid slots; enemies path toward base; waves",
  shooter: "Top-down or vertical shooter: player ship, enemies spawn, shoot on hold/tap",
  sniper: "Aim reticle, limited shots, hit targets for score",
  coaster: "On-rails speed: boost/brake keys or buttons, reach finish under time",
  racing: "Same as coaster: track progress bar, speed control, timer win",
  puzzle: "Match-3 cluster clear OR memory pairs OR spot-difference — pick one fitting prompt",
  farming: "Grid plant/water/harvest loop with coin economy",
  physics: "Ragdoll dummy: tap applies impulse force, combo scoring",
  chess: "Simple board: pick piece then square to move (simplified rules OK)",
  customization: "Color picker / palette slots that change car or avatar preview",
  strategy: "Node map: select owned node, click neighbor to send troops",
  stealth: "Platformer with patrol vision cones; reach exit unseen",
};

export function buildAgenticSystemPrompt(): string {
  return `You generate a minimal Phaser 3 mini-game module for a sandbox runtime.
Output ONLY valid JSON with keys source (full JS string) and entry (function name, default createGame).
The source must define function createGame(ctx, Phaser) returning { create(scene), update?(scene,time,delta) }.

Runtime API:
- ctx.width, ctx.height, ctx.colors.{background,player,accent}, ctx.labels.{title,subtitle}
- ctx.onScore(delta), ctx.onEnd(won), ctx.rng()
- ctx.assets?.backgroundKey — if set, use scene.add.image(w/2,h/2, key).setDisplaySize(ctx.width, ctx.height) behind gameplay
- ctx.assets?.playerKey — if set, use scene.add.sprite for player instead of rectangle
- ctx.assets?.enemyKey — optional hazard/enemy sprite key

Rules: no fetch/XHR/WebSocket/eval/import/require. Use Phaser arcade physics when needed (scene.physics.add.existing).
Implement the SPECIFIC genre from the template hint — NOT a generic "click anywhere +10 score" unless unavoidable.
Keep source under 140 lines. Must call ctx.onEnd(true) when win condition met.`;
}

export function buildAgenticUserPrompt(prompt: string, spec: GameSpec): string {
  const def = getTemplateDefinition(spec.templateId);
  const hint = TEMPLATE_GAMEPLAY_HINTS[spec.templateId] ?? def.llmSummary;
  const win = spec.gameplay.winScore ?? 100;
  return [
    `Game idea: ${prompt}`,
    `Title: ${spec.title}`,
    `Template: ${spec.templateId}`,
    `Genre: ${def.llmSummary}`,
    `Gameplay requirement: ${hint}`,
    `Theme: bg=${spec.theme.backgroundColor} player=${spec.theme.playerColor} hazard=${spec.theme.hazardColor} accent=${spec.theme.collectibleColor ?? "#fbbf24"}`,
    `Labels: player="${spec.labels.player}" hazard="${spec.labels.hazard}" collectible="${spec.labels.collectible ?? "item"}"`,
    `Win score or equivalent: ${win}`,
    `Generate createGame(ctx, Phaser) that a player would recognize as "${spec.title}" (${spec.templateId}).`,
  ].join("\n");
}

export function buildAgenticRepairPrompt(
  prompt: string,
  spec: GameSpec,
  prevSource: string,
  reason: string,
): string {
  return [
    buildAgenticUserPrompt(prompt, spec),
    "",
    `REPAIR: previous source failed (${reason}). Output fixed JSON only.`,
    "Constraints: no fetch/eval/import/require; must export createGame(ctx, Phaser); create() must not throw.",
    "Broken source excerpt:",
    prevSource.slice(0, 2400),
  ].join("\n");
}
