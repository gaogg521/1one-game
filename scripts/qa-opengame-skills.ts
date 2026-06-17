/**
 * OpenGame Skills 离线 QA — Template Skill + Debug Skill 管线
 * npm run qa:opengame-skills
 */
import { buildTemplateFallbackModule } from "@/lib/agentic/template-fallback-modules";
import { buildAgenticSystemPrompt, buildAgenticUserPrompt } from "@/lib/agentic/agentic-prompts";
import type { GameSpec } from "@/lib/game-spec";
import {
  getDebugProtocolEntryCount,
  listTemplateArchetypeIds,
  resolveTemplateArchetype,
  runDebugSkillPipeline,
  runDebugSkillProactive,
  TEMPLATE_ARCHETYPES,
} from "@/lib/opengame-skills";

const SPEC: GameSpec = {
  version: 1,
  templateId: "platformer",
  title: "OpenGame Skills QA",
  theme: {
    backgroundColor: "#1a2220",
    playerColor: "#89a884",
    hazardColor: "#9d5838",
    collectibleColor: "#c9a66b",
  },
  gameplay: {
    playerSpeed: 300,
    hazardSpeed: 220,
    spawnIntervalMs: 640,
    winScore: 42,
    lives: 3,
  },
  labels: { player: "英雄", hazard: "障碍", subtitle: "跳跃闯关" },
};

const failures: string[] = [];

if (getDebugProtocolEntryCount() < 8) {
  failures.push("debug protocol too small");
}

for (const id of listTemplateArchetypeIds()) {
  if (!TEMPLATE_ARCHETYPES[id]?.scaffoldLines.length) {
    failures.push(`archetype missing scaffold: ${id}`);
  }
}

const archetype = resolveTemplateArchetype(SPEC, "复仇者 3 关平台跳跃选角");
if (archetype.id !== "gravity_side_view" && archetype.id !== "ui_heavy") {
  failures.push(`unexpected archetype for marvel prompt: ${archetype.id}`);
}

const system = buildAgenticSystemPrompt();
if (!system.includes("Template Skill")) {
  failures.push("system prompt missing Template Skill scaffold");
}

const user = buildAgenticUserPrompt("跳跃收集金币", SPEC);
if (!user.includes("Template Skill archetype")) {
  failures.push("user prompt missing Template Skill append");
}

const goodMod = buildTemplateFallbackModule(SPEC);
const goodPipeline = runDebugSkillPipeline(goodMod);
if (!goodPipeline.ok) {
  failures.push(`template fallback failed debug skill: ${goodPipeline.reason}`);
}

const badSource = `function createGame(ctx, Phaser) {
  return { create(scene) { scene.input.on('pointerdown', () => ctx.onScore(10)); } };
}`;
const proactive = runDebugSkillProactive(badSource);
const codes = new Set(proactive.map((p) => p.errorCode));
for (const need of ["MISSING_WIN_OR_LOSE", "MISSING_HUD", "MISSING_PLAYFIELD"]) {
  if (!codes.has(need)) failures.push(`proactive should catch ${need}`);
}

if (failures.length) {
  console.error("[FAIL] qa-opengame-skills");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("[OK] qa-opengame-skills: protocol, archetypes, prompts, pipeline");
