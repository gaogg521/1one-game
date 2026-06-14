/**
 * Godot Secondary 读取 samplePlayProfile 门禁
 * npm run qa:godot:sample-profile
 */
import { SAMPLES } from "../src/lib/samples";
import { enrichGameSpecForRuntime } from "../src/lib/enrich-game-spec";
import { specForSample } from "../src/lib/sample-specs";

const PROFILE_SAMPLES: Record<string, string[]> = {
  "elastic-thief-2": ["platformer.treasureHeist"],
  "color-bloom": ["puzzle.match3BloomScale"],
  "rail-in-air": ["coaster.speedBoost"],
  "grow-a-garden": ["farming.autoWater"],
  "gun-merge-3d-zombie-apocalypse": ["towerDefense.mergeGrid"],
  "ultimate-3d-chess": ["chess.showLegalMoves"],
  "state-conquest": ["strategy.rushMode"],
  "smash-the-dummy": ["physics.comboMultiplier"],
  "tiny-planet-chopper": ["shooter.orbitChopper"],
  "blocky-sniper-hunter": ["shooter.sniperScope"],
  "pottery-master-3d": ["customization.potterySpin"],
  "car-color-palette": ["customization.editGoal"],
  "kids-puzzle": ["puzzle.kidsJigsaw"],
  "whimsy-differences": ["puzzle.whimsicalPanels"],
  "memory-match-mania": ["puzzle.memoryTimerSec"],
  "blade-defender-merge": ["towerDefense.mergeGrid"],
};

function getNested(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function main() {
  console.log("# qa:godot:sample-profile — enrich 后 profile 字段存在\n");
  let ok = 0;
  for (const [sampleId, paths] of Object.entries(PROFILE_SAMPLES)) {
    const sample = SAMPLES.find((s) => s.id === sampleId);
    if (!sample) throw new Error(`missing sample ${sampleId}`);
    const spec = enrichGameSpecForRuntime(specForSample(sample), sample.prompt, "zh-Hans", {
      sampleId,
    });
    const pf = spec.samplePlayProfile as Record<string, unknown> | undefined;
    if (!pf) throw new Error(`${sampleId} missing samplePlayProfile`);
    for (const p of paths) {
      const val = getNested(pf, p);
      if (val === undefined || val === null || val === false) {
        throw new Error(`${sampleId} missing profile path ${p}`);
      }
      console.log(`[OK] ${sampleId} · ${p}=${String(val)}`);
    }
    ok += 1;
  }
  console.log(`\n✓ godot sample profile bridge gate passed (${ok} samples)`);
}

main();
