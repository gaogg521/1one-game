/**
 * Astrocade 平台架构 parity（全模板 / 全路径，非单游戏补丁）
 * npm run qa:architecture-parity
 */
import fs from "node:fs";
import path from "node:path";
import { AGENTIC_QA_CASES } from "./agentic-qa-cases";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { attachAgenticModuleIfEnabled } from "../src/lib/agentic/generate-game-module";
import {
  ASTROCADE_INVARIANTS,
  checkAstrocadeParity,
  resolveAstrocadePlayRoute,
  templateFirstCoverage,
} from "../src/lib/astrocade-architecture";
import { normalizeAstrocadePlaySpec } from "../src/lib/astrocade-play-spec";
import { expectedPhaserSceneName } from "../src/lib/game-templates/runtime";
import { SAMPLES } from "../src/lib/samples";
import { specForSample } from "../src/lib/sample-specs";
import { PRODUCT } from "../src/lib/product-config";

const BLUEPRINT_FILES = [
  "src/lib/puzzle-blueprint.ts",
  "src/lib/coaster-blueprint.ts",
  "src/lib/customization-blueprint.ts",
  "src/lib/platformer-blueprint.ts",
];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function grepGateNoSampleModesInBlueprints() {
  for (const rel of BLUEPRINT_FILES) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    assert(!/SAMPLE_MODES\s*:/.test(src), `${rel} must not use SAMPLE_MODES (use spec + prompt infer)`);
  }
  console.log("[OK] blueprint files: no runtime SAMPLE_MODES");
}

async function main() {
  console.log("# qa:architecture-parity — Astrocade 平台对齐\n");
  console.log("Invariants:");
  for (const inv of ASTROCADE_INVARIANTS) console.log(`  · ${inv}`);

  assert(PRODUCT.game.dedicatedSceneForTemplateFirst, "dedicatedSceneForTemplateFirst");
  assert(PRODUCT.orchestration.qualityTier === "astrocade", "qualityTier=astrocade");

  const coverage = templateFirstCoverage();
  assert(coverage.missing.length === 0, `templates missing from template-first: ${coverage.missing.join(", ")}`);
  console.log(`[OK] template-first covers ${coverage.covered.length} templates`);

  grepGateNoSampleModesInBlueprints();

  for (const c of AGENTIC_QA_CASES) {
    const base = mockSpecFromPrompt(c.prompt);
    assert(base.templateId === c.expectTemplate, `mock ${c.expectTemplate}`);
    const attached = await attachAgenticModuleIfEnabled(c.prompt, base, true);
    const violations = checkAstrocadeParity(attached, { label: c.expectTemplate });
    assert(violations.length === 0, violations.map((v) => v.message).join("; "));
    const route = resolveAstrocadePlayRoute(attached);
    assert(route.tier !== "advanced-agentic", `${c.expectTemplate} should not route agentic`);
    assert(route.phaserScene !== "AgenticScene", `${c.expectTemplate} AgenticScene`);
  }
  console.log(`[OK] user path: ${AGENTIC_QA_CASES.length} templates → dedicated Scene`);

  for (const s of SAMPLES) {
    const spec = specForSample(s);
    const violations = checkAstrocadeParity(spec, { label: s.id });
    assert(violations.length === 0, violations.map((v) => v.message).join("; "));
    const migrated = normalizeAstrocadePlaySpec({
      ...spec,
      agenticModule: { version: 1, entry: "createGame", source: "function createGame(){return{create(){}}}" },
    });
    const v2 = checkAstrocadeParity(migrated, { label: `${s.id}-clone` });
    assert(v2.length === 0, v2.map((v) => v.message).join("; "));
  }
  console.log(`[OK] sample gallery: ${SAMPLES.length} samples parity + clone normalize`);

  const sceneByTemplate = new Map<string, Set<string>>();
  for (const s of SAMPLES) {
    const spec = specForSample(s);
    const scene = expectedPhaserSceneName(spec);
    const set = sceneByTemplate.get(spec.templateId) ?? new Set();
    set.add(scene);
    sceneByTemplate.set(spec.templateId, set);
  }
  for (const [tid, scenes] of sceneByTemplate) {
    if (scenes.size > 1) {
      console.warn(`[warn] template ${tid} maps to multiple scenes: ${[...scenes].join(", ")}`);
    }
  }

  console.log("\n[OK] qa:architecture-parity — platform Astrocade alignment");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
