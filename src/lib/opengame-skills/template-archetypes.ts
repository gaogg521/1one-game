import type { GameSpec } from "@/lib/game-spec";
import type { TemplateArchetype, TemplateArchetypeId } from "@/lib/opengame-skills/types";

/**
 * Template Skill 族 — 映射 OpenGame agent-test/templates/modules 到 Operone templateId。
 * 单文件 Agentic 内用 Template Method 骨架（setupWorld/createEntities/HUD）替代多 Scene 工程。
 */
export const TEMPLATE_ARCHETYPES: Record<TemplateArchetypeId, TemplateArchetype> = {
  gravity_side_view: {
    id: "gravity_side_view",
    label: "Gravity Side View",
    opengameModule: "platformer",
    physicsProfile: "Arcade gravity, static platforms, jump, goal overlap",
    hooks: ["setupWorld", "createPlayer", "createPlatforms", "createGoal", "wireJumpInput"],
    scaffoldLines: [
      "Template Skill (platformer): use CONFIG constants for jumpPower/gravity/walkSpeed from spec.gameplay.",
      "setupWorld: full-screen bg + staticGroup platforms (no tilemap).",
      "createPlayer: rectangle/sprite at spawn; physics.add.existing; collider(player, platforms).",
      "wireJumpInput: SPACE/W/UP sets velocity.y negative; createCursorKeys for left/right.",
      "createGoal: overlap flag zone → ctx.onEnd(true); hazard overlap → ctx.onEnd(false).",
      "Juice: brief camera shake on land/hit (cameras.main.shake(80, 0.004)).",
    ],
    playabilityChecks: ["jump input", "platform collider", "goal or score win"],
  },
  top_down_continuous: {
    id: "top_down_continuous",
    label: "Top-Down Continuous",
    opengameModule: "top_down",
    physicsProfile: "No gravity or low gravity; 8-way or pointer move; projectiles",
    hooks: ["setupArena", "createPlayer", "createEnemies", "wireShooting", "waveSpawner"],
    scaffoldLines: [
      "Template Skill (top_down): world bounds; player moves on X/Y (pointer or WASD).",
      "Enemy group with physics; spawn waves in update() with escalating interval.",
      "Bullets group + overlap(enemy, bullet) → destroy + ctx.onScore.",
      "Player-enemy overlap → ctx.onEnd(false); win at ctx.winScore or wave clear.",
    ],
    playabilityChecks: ["move + shoot or dodge", "enemy spawn", "score or survive win"],
  },
  path_and_wave: {
    id: "path_and_wave",
    label: "Path and Wave",
    opengameModule: "tower_defense",
    physicsProfile: "Path followers, build slots, wave manager",
    hooks: ["drawPath", "createBuildSlots", "createWaveManager", "createTowers", "baseHealth"],
    scaffoldLines: [
      "Template Skill (tower_defense): draw path line; enemies move along path toward base.",
      "Clickable tower slots; on pointerdown place tower if coins >= cost.",
      "WaveManager in update: spawn enemy every N ms; enemy reaches base → damage baseHealth.",
      "Win when all waves cleared; lose when baseHealth <= 0.",
    ],
    playabilityChecks: ["place tower", "enemy path", "wave progression"],
  },
  grid_logic: {
    id: "grid_logic",
    label: "Grid Logic",
    opengameModule: "grid_logic / puzzle",
    physicsProfile: "Discrete grid cells; pointer pick; no continuous physics required",
    hooks: ["createGrid", "createCellStates", "handleCellPick", "checkWin"],
    scaffoldLines: [
      "Template Skill (grid): fixed rows×cols; each cell is rectangle with gridX/gridY metadata.",
      "Pointer picks swap cells, flip pairs, or flood-fill match — pick ONE mechanic matching prompt.",
      "Moves counter + goal panel text; win when target met → ctx.onEnd(true).",
    ],
    playabilityChecks: ["grid interaction", "move limit or goal", "clear win state"],
  },
  ui_heavy: {
    id: "ui_heavy",
    label: "UI-Heavy",
    opengameModule: "ui_heavy",
    physicsProfile: "Modal panels, cards, dialogue; gameplay in UI state machine",
    hooks: ["createStatusBar", "createMainPanel", "stateMachine", "modalFlow"],
    scaffoldLines: [
      "Template Skill (ui_heavy): StatusBar top (HP/score/turn); main play area center.",
      "Use gameState enum (SELECT, PLAY, RESOLVE, WIN) guarded in pointer handlers.",
      "Modal overlay for quiz/card choice — blocking input until resolved.",
      "Combo/streak counter updates ctx.onScore on success.",
    ],
    playabilityChecks: ["visible UI state", "turn/phase progression", "win after N rounds"],
  },
  physics_sandbox: {
    id: "physics_sandbox",
    label: "Physics Sandbox",
    opengameModule: "physics / customization",
    physicsProfile: "Few bodies; pointer impulses; preview recolor",
    hooks: ["createFloor", "createMainBody", "pointerImpulse", "comboScoring"],
    scaffoldLines: [
      "Template Skill (physics): ONE main body + static floor; pointerdown applies velocity impulse toward tap.",
      "Max 4 arcade bodies; no Matter/container ragdoll.",
      "Combo counter on rapid hits; ctx.onEnd(true) at ctx.winScore.",
    ],
    playabilityChecks: ["pointer impulse", "floor collider", "score feedback"],
  },
};

const TEMPLATE_ID_TO_ARCHETYPE: Partial<Record<GameSpec["templateId"], TemplateArchetypeId>> = {
  platformer: "gravity_side_view",
  stealth: "gravity_side_view",
  shooter: "top_down_continuous",
  sniper: "top_down_continuous",
  avoider: "top_down_continuous",
  collector: "top_down_continuous",
  survivor: "top_down_continuous",
  towerDefense: "path_and_wave",
  puzzle: "grid_logic",
  chess: "grid_logic",
  farming: "grid_logic",
  strategy: "grid_logic",
  customization: "ui_heavy",
  physics: "physics_sandbox",
  coaster: "path_and_wave",
  racing: "path_and_wave",
};

const PROMPT_ARCHETYPE_HINTS: { pattern: RegExp; archetype: TemplateArchetypeId }[] = [
  { pattern: /卡牌|问答|quiz|card battle|turn.?based|duel|dialogue|modals?/i, archetype: "ui_heavy" },
  { pattern: /选角|character select|hero roster|multi.?level|3 distinct levels|boss/i, archetype: "gravity_side_view" },
  { pattern: /tower defense|塔防|wave|炮塔|plant/i, archetype: "path_and_wave" },
  { pattern: /match.?3|消消乐|grid|棋盘|chess|农场|strategy/i, archetype: "grid_logic" },
  { pattern: /twin.?stick|top.?down|俯视角|mandolarian|shooter/i, archetype: "top_down_continuous" },
];

export function resolveTemplateArchetype(
  spec: GameSpec,
  prompt = "",
  overrideId?: TemplateArchetypeId,
): TemplateArchetype {
  if (overrideId && TEMPLATE_ARCHETYPES[overrideId]) {
    return TEMPLATE_ARCHETYPES[overrideId];
  }
  for (const { pattern, archetype } of PROMPT_ARCHETYPE_HINTS) {
    if (pattern.test(prompt) || pattern.test(spec.title) || pattern.test(spec.labels.subtitle ?? "")) {
      return TEMPLATE_ARCHETYPES[archetype];
    }
  }
  const id = TEMPLATE_ID_TO_ARCHETYPE[spec.templateId] ?? "top_down_continuous";
  return TEMPLATE_ARCHETYPES[id];
}

export function listTemplateArchetypeIds(): TemplateArchetypeId[] {
  return Object.keys(TEMPLATE_ARCHETYPES) as TemplateArchetypeId[];
}
