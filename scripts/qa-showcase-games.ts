import fs from "node:fs";
import path from "node:path";
import { buildCanonicalAstrocadeSpec } from "@/lib/astrocade-canonical-spec";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import { SAMPLES } from "@/lib/samples";

const CASES = [
  { id: "voxel-power-frontier", runtime: "voxel-frontier", scene: "VoxelFrontierScene", hooks: ["targetCell", "mine()", "place()", "renderWorld", "voxelCompleted"] },
  { id: "neon-territory-loop", runtime: "territory-loop", scene: "TerritoryLoopScene", hooks: ["closeLoop", "crashTrail", "territoryCoverage", "territoryCompleted"] },
  { id: "grand-estate-merge", runtime: "estate-merge", scene: "EstateMergeScene", hooks: ["moveOrMerge", "spawnBuilding", "estateBoard", "estateCompleted"] },
] as const;

const REMOVED = [
  "hundred-gate-breaker", "blockland-sharpshooter", "voxel-daybreak-survival",
  "passenger-rail-express", "fusion-legends-arena", "sparkle-auto-spa", "red-blue-arsenal",
] as const;

for (const id of REMOVED) {
  if (SAMPLES.some((sample) => sample.id === id)) throw new Error(`${id}: rejected prototype is still published`);
}

for (const test of CASES) {
  const sample = SAMPLES.find((candidate) => candidate.id === test.id);
  if (!sample) throw new Error(`${test.id}: sample missing`);
  const spec = buildCanonicalAstrocadeSpec(sample.prompt, "zh-Hans", { sampleId: sample.id });
  if (spec.samplePlayProfile?.showcaseRuntime !== test.runtime) throw new Error(`${test.id}: runtime contract mismatch`);
  if (expectedPhaserSceneName(spec) !== test.scene) throw new Error(`${test.id}: expected ${test.scene}`);
  const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine", `${test.scene}.ts`), "utf8");
  for (const hook of test.hooks) if (!source.includes(hook)) throw new Error(`${test.id}: missing gameplay hook ${hook}`);
  console.log(`[OK] ${test.id} -> ${test.scene}`);
}

console.log("qa:showcase-games: ok (3 independent runtimes; 7 rejected prototypes removed)");
