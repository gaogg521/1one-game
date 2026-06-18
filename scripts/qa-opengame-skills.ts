/**
 * OpenGame Skills 离线 QA — Template Skill + Debug Skill 管线
 * npm run qa:opengame-skills
 */
import { buildTemplateFallbackModule } from "@/lib/agentic/template-fallback-modules";
import { buildAgenticSystemPrompt, buildAgenticUserPrompt } from "@/lib/agentic/agentic-prompts";
import type { GameSpec } from "@/lib/game-spec";
import {
  classifyPromptComplexity,
  getDebugProtocolEntryCount,
  listTemplateArchetypeIds,
  resolveAgenticPlayRoute,
  runDebugSkillPipeline,
  runDebugSkillProactive,
  shouldSkipTemplateFirstForPrompt,
  shouldUseDedicatedSceneForTemplateFirst,
  TEMPLATE_ARCHETYPES,
} from "@/lib/opengame-skills";
import { normalizeAstrocadePlaySpec } from "@/lib/astrocade-play-spec";

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

const marvelPrompt =
  "Build an epic side-scrolling platformer with 3 levels, character select, and final boss Thanos.";
const complex = classifyPromptComplexity(marvelPrompt, { title: "Avengers", labels: { subtitle: "Infinity Strike" } });
if (!complex.skipTemplateFirst || complex.tier !== "agentic_complex") {
  failures.push(`marvel prompt should be agentic_complex: ${complex.tier}`);
}
if (shouldSkipTemplateFirstForPrompt(marvelPrompt, SPEC)) {
  /* ok */
} else {
  failures.push("shouldSkipTemplateFirstForPrompt(marvel)");
}

const simple = classifyPromptComplexity("躲开陨石", SPEC);
if (simple.tier !== "spec_fast" && simple.tier !== "agentic_standard") {
  failures.push(`simple prompt unexpected tier: ${simple.tier}`);
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

const marvelRoute = resolveAgenticPlayRoute(marvelPrompt, {
  ...SPEC,
  title: "Avengers",
  labels: { ...SPEC.labels, subtitle: "Infinity Strike" },
});
if (marvelRoute !== "agentic") {
  failures.push(`marvel prompt should resolve agentic route, got ${marvelRoute}`);
}

const simpleRoute = resolveAgenticPlayRoute("躲开陨石", SPEC);
if (simpleRoute !== "dedicated") {
  failures.push(`simple prompt should resolve dedicated route, got ${simpleRoute}`);
}

const agenticSpec = {
  ...SPEC,
  agenticPlayRoute: "agentic" as const,
  agenticModule: goodMod,
};
const normalized = normalizeAstrocadePlaySpec(agenticSpec);
if (!normalized.agenticModule?.source) {
  failures.push("normalize should preserve agenticModule when agenticPlayRoute=agentic");
}
const stripped = normalizeAstrocadePlaySpec({
  ...SPEC,
  agenticPlayRoute: "dedicated" as const,
  agenticModule: goodMod,
});
if (stripped.agenticModule?.source) {
  failures.push("normalize should strip agenticModule when agenticPlayRoute=dedicated");
}
if (shouldUseDedicatedSceneForTemplateFirst({ ...SPEC, agenticPlayRoute: "agentic" })) {
  failures.push("shouldUseDedicatedScene false when agenticPlayRoute=agentic");
}

const staleDedicated = resolveAgenticPlayRoute(
  marvelPrompt,
  { ...SPEC, agenticPlayRoute: "dedicated", title: "Avengers", labels: { ...SPEC.labels, subtitle: "Infinity Strike" } },
  { respectPersisted: true },
);
if (staleDedicated !== "dedicated") {
  failures.push("respectPersisted should keep dedicated when stamped");
}
const upgraded = resolveAgenticPlayRoute(
  marvelPrompt,
  { ...SPEC, agenticPlayRoute: "dedicated", title: "Avengers", labels: { ...SPEC.labels, subtitle: "Infinity Strike" } },
  { respectPersisted: false },
);
if (upgraded !== "agentic") {
  failures.push(`respectPersisted=false should upgrade marvel to agentic, got ${upgraded}`);
}

async function runAttachRouteQa() {
  process.env.E2E_AGENTIC_FALLBACK_ONLY = "1";
  const { attachAgenticModuleIfEnabled, lintDedicatedRouteDebugSkill } = await import("@/lib/agentic/generate-game-module");
  const simpleAttach = await attachAgenticModuleIfEnabled("躲开陨石", SPEC);
  if (simpleAttach.agenticPlayRoute !== "dedicated" || simpleAttach.agenticModule?.source) {
    failures.push("attach simple prompt should be dedicated without agenticModule");
  }
  const complexAttach = await attachAgenticModuleIfEnabled(marvelPrompt, {
    ...SPEC,
    agenticPlayRoute: "dedicated",
    title: "Avengers",
    labels: { ...SPEC.labels, subtitle: "Infinity Strike" },
  });
  if (complexAttach.agenticPlayRoute !== "agentic" || !complexAttach.agenticModule?.source) {
    failures.push("attach complex prompt should upgrade to agentic with module");
  }
  const dedicatedLint = lintDedicatedRouteDebugSkill({ ...SPEC, agenticPlayRoute: "dedicated" });
  if (!dedicatedLint.ok) {
    failures.push(`dedicated debug lint failed: ${dedicatedLint.reason}`);
  }
  delete process.env.E2E_AGENTIC_FALLBACK_ONLY;
}

void runAttachRouteQa().then(() => {
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
});
