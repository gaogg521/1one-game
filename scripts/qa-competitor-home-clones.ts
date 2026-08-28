import fs from "node:fs";
import path from "node:path";
import { buildCanonicalAstrocadeSpec } from "@/lib/astrocade-canonical-spec";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import { SAMPLES } from "@/lib/samples";

const EXPECTED = new Map([
  ["voxel-power-frontier", "voxel-builder"],
  ["neon-territory-loop", "territory-loop"],
  ["hundred-gate-breaker", "tower-punch"],
  ["grand-estate-merge", "estate-merge"],
  ["blockland-sharpshooter", "voxel-sniper"],
  ["voxel-daybreak-survival", "daybreak-survival"],
  ["passenger-rail-express", "passenger-rail"],
  ["fusion-legends-arena", "fusion-legends"],
  ["sparkle-auto-spa", "auto-spa"],
  ["red-blue-arsenal", "team-arsenal"],
] as const);

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

const sceneSource = fs.readFileSync(path.join(process.cwd(), "src/game/engine/CompetitorCloneScene.ts"), "utf8");
assert(sceneSource.includes("this.finish(true)"), "clone runtime must expose a reachable win condition");
assert(sceneSource.includes("this.onEnd({ score: this.score, won })"), "clone runtime must report completion");
assert(sceneSource.includes("cloneCompleted"), "clone runtime must publish completion evidence");

for (const [sampleId, mode] of EXPECTED) {
  const sample = SAMPLES.find((item) => item.id === sampleId);
  assert(sample, `missing sample ${sampleId}`);
  const spec = buildCanonicalAstrocadeSpec(sample.prompt, "zh-Hans", { sampleId });
  assert(spec.samplePlayProfile?.variantId === sampleId, `${sampleId}: variant mismatch`);
  assert(spec.samplePlayProfile?.competitorClone?.mode === mode, `${sampleId}: mode mismatch`);
  assert((spec.samplePlayProfile.competitorClone.target ?? 0) > 0, `${sampleId}: completion target missing`);
  assert(expectedPhaserSceneName(spec) === "CompetitorCloneScene", `${sampleId}: wrong runtime scene`);
  assert(sceneSource.includes(`"${mode}"`), `${sampleId}: runtime mode not implemented`);
  console.log(`[OK] ${sampleId} -> ${mode} target=${spec.samplePlayProfile.competitorClone.target}`);
}

assert(EXPECTED.size === 10, "competitor homepage clone set must contain exactly 10 games");
console.log("qa:competitor-home-clones: ok (10/10)");
