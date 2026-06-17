import type { GameSpec } from "@/lib/game-spec";
import { getTemplateDefinition } from "@/lib/game-templates/registry";
import {
  buildDebugSkillRepairHints,
  buildTemplateSkillRepairAppend,
  buildTemplateSkillSystemAppend,
  buildTemplateSkillUserAppend,
  matchDebugSkillReactive,
  runDebugSkillProactive,
} from "@/lib/opengame-skills";

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
  physics: "Ragdoll dummy: tap applies impulse force, combo scoring. Use simple rectangles + pointer impulse; avoid Matter constraints, generateTexture, or container ragdolls.",
  chess: "Simple board: pick piece then square to move (simplified rules OK)",
  customization: "Color picker / palette slots that change car or avatar preview",
  strategy: "Node map: select owned node, click neighbor to send troops",
  stealth: "Platformer with patrol vision cones; reach exit unseen",
};

/** 各模板追加 user prompt 段（template-first 失败走 LLM 时） */
const TEMPLATE_PROMPT_EXTRA: Partial<Record<GameSpec["templateId"], string[]>> = {
  physics: [
    "Physics template pattern (required): ONE main dummy body (rectangle or sprite), scene.physics.add.existing, pointerdown applies velocity impulse toward tap, combo scoring. No ragdoll constraints, no generateTexture, no container, max 4 physics bodies total.",
    "Use ctx.assets.enemyKey as optional hazard/target prop on floor (scene.add.image, static). scene.physics.world.gravity.y=900; collider(dummy,floor).",
  ],
  shooter: [
    "Shooter pattern (required): player ship + pointer/auto fire bullets + enemy group spawning downward. Use scene.physics.add.sprite/existing and overlap only — no custom graphics.fillTriangle or staticImage unless necessary.",
  ],
  sniper: [
    "Sniper pattern: reticle/crosshair aim + limited shots + overlap on targets — reuse shooter overlap/group pattern.",
  ],
  coaster: [
    "Coaster pattern (required): pseudo-3D on-rails track with graphics layers, boost (E/right/click) + brake (Q/left), timer + KM/H HUD, progress 0→1 then ctx.onEnd(true). No physics bodies — use scene.add.graphics + scene.events.on('update').",
  ],
  racing: [
    "Racing pattern: same as coaster — track progress 0→1, speed HUD, timer win via graphics (no Matter).",
  ],
  avoider: [
    "Avoider pattern: pointer-move player at bottom, physics group hazards fall downward, overlap → ctx.onEnd(false), score over time → ctx.onEnd(true) at ctx.winScore.",
  ],
  collector: [
    "Collector pattern: pointer-move player, overlap collectibles for score, overlap hazards → lose, win at ctx.winScore.",
  ],
  survivor: [
    "Survivor pattern: multi-life dodge (lives HUD), escalating hazard spawn, survive N seconds or ctx.winScore to win.",
  ],
  platformer: [
    "Platformer pattern: staticGroup platforms + player body jump on SPACE/W/UP, overlap flag/goal → ctx.onEnd(true). No tilemap.",
  ],
  stealth: [
    "Stealth pattern: platformer jump + reach exit zone; optional patrol rectangles — no tilemap.",
  ],
  towerDefense: [
    "Tower defense pattern: clickable tower slots + enemy group moving toward base line, build towers to slow/kill, win after waves — no tilemap.",
  ],
  puzzle: [
    "Puzzle pattern: match-3 flood fill OR memory flip pairs on grid — pointer only, no physics unless needed.",
  ],
  farming: [
    "Farming pattern: grid tiles with plant/water/harvest states and coin economy, win after N harvests.",
  ],
  strategy: [
    "Strategy pattern: node circles with troop counts, select owned node then neighbor to send troops, conquer all → win.",
  ],
  chess: [
    "Chess pattern: 8×8 board graphics, tap piece then square to move simplified pieces, win after N moves or capture king.",
  ],
  customization: [
    "Customization pattern: palette swatches + part tabs (body/wheel/bg) recolor preview graphics, win after N edits.",
  ],
};

const TEMPLATE_REPAIR_EXTRA: Partial<Record<GameSpec["templateId"], string>> = {
  physics: "Physics repair: one dummy body, pointerdown impulse, combo score, ctx.winScore — mirror PHYSICS_DUMMY.",
  shooter: "Shooter repair: player + bullet group + enemy group + overlap scoring.",
  sniper: "Sniper repair: aim + shoot + overlap targets — mirror shooter fallback.",
  coaster: "Coaster repair: graphics pseudo-3D track, boost/brake, trackProgress 0..1 — mirror COASTER_RACE.",
  racing: "Racing repair: same as coaster COASTER_RACE fallback.",
  avoider: "Avoider repair: pointer-move + falling hazards + overlap lose + time/score win.",
  collector: "Collector repair: gems group + hazard group + overlap scoring.",
  survivor: "Survivor repair: lives + hazard overlap + survive timer win.",
  platformer: "Platformer repair: static platforms + jump keys + goal overlap.",
  stealth: "Stealth repair: platformer jump to exit — mirror PLATFORMER_JUMP.",
  towerDefense: "TD repair: tower slots + enemy lane group — mirror TD_LANE fallback.",
  puzzle: "Puzzle repair: grid match-3 flood — mirror PUZZLE_MATCH3.",
  farming: "Farming repair: grid plant/harvest — mirror FARMING_GRID.",
  strategy: "Strategy repair: node map send troops — mirror STRATEGY_NODES.",
  chess: "Chess repair: board tap moves — mirror CHESS_LITE.",
  customization: "Customization repair: palette recolor preview — mirror CUSTOMIZE_PAINT.",
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

Rules: no fetch/XHR/WebSocket/eval/import/require. Use Phaser Arcade physics only (scene.physics.add.existing, overlap, collider, staticGroup) — do NOT use Matter-only APIs (constraint, worldConstraint, setDamping on body).
Implement the SPECIFIC genre from the template hint — NOT a generic "click anywhere +10 score" unless unavoidable.
Keep source under 140 lines. Must call ctx.onEnd(true) when win condition met.
${buildTemplateSkillSystemAppend()}`;
}

export function buildAgenticUserPrompt(prompt: string, spec: GameSpec): string {
  const def = getTemplateDefinition(spec.templateId);
  const hint = TEMPLATE_GAMEPLAY_HINTS[spec.templateId] ?? def.llmSummary;
  const win = spec.gameplay.winScore ?? 100;
  const lines = [
    `Game idea: ${prompt}`,
    `Title: ${spec.title}`,
    `Template: ${spec.templateId}`,
    `Genre: ${def.llmSummary}`,
    `Gameplay requirement: ${hint}`,
    `Theme: bg=${spec.theme.backgroundColor} player=${spec.theme.playerColor} hazard=${spec.theme.hazardColor} accent=${spec.theme.collectibleColor ?? "#fbbf24"}`,
    `Labels: player="${spec.labels.player}" hazard="${spec.labels.hazard}" collectible="${spec.labels.collectible ?? "item"}"`,
    `Win score or equivalent: ${win}`,
    `Generate createGame(ctx, Phaser) that a player would recognize as "${spec.title}" (${spec.templateId}).`,
  ];
  const extra = TEMPLATE_PROMPT_EXTRA[spec.templateId];
  if (extra?.length) {
    lines.push("", ...extra);
  }
  lines.push(buildTemplateSkillUserAppend(prompt, spec));
  return lines.join("\n");
}

export function buildAgenticRepairPrompt(
  prompt: string,
  spec: GameSpec,
  prevSource: string,
  reason: string,
  debugHints: string[] = [],
): string {
  const repairHints: string[] = [
    "Constraints: no fetch/eval/import/require; must export createGame(ctx, Phaser); create() must not throw.",
  ];
  if (/container|generateTexture|Matter|constraint|tilemap|tileSprite/i.test(reason + prevSource)) {
    repairHints.push(
      "Use ONLY scene.add.rectangle/sprite/image/graphics + scene.physics.add.existing/sprite/group/overlap. No container ragdolls, no generateTexture, no Matter, no tilemap.",
    );
  }
  const repairExtra = TEMPLATE_REPAIR_EXTRA[spec.templateId];
  if (repairExtra) repairHints.push(repairExtra);
  repairHints.push(buildTemplateSkillRepairAppend(spec, prompt));
  if (debugHints.length) repairHints.push(...debugHints);
  return [
    buildAgenticUserPrompt(prompt, spec),
    "",
    `REPAIR: previous source failed (${reason}). Output fixed JSON only.`,
    ...repairHints,
    "Broken source excerpt:",
    (prevSource || "").slice(0, 2400),
  ].join("\n");
}

/** Debug Skill 协议条目 → repair 提示（供 generate 管线调用） */
export function buildAgenticDebugRepairHints(reason: string, source: string): string[] {
  const proactive = runDebugSkillProactive(source);
  const reactive = matchDebugSkillReactive(reason);
  return buildDebugSkillRepairHints([...proactive, ...reactive]);
}
