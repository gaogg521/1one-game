/** Godot 运行时键：语义模板 → 专用 godotKey（非 collector 回落） */
import { SAMPLES } from "@/lib/samples";
import { specForSample } from "@/lib/sample-specs";
import { buildGodotRuntimePayload } from "@/lib/game-templates/runtime";

const EXPECT: Record<string, string> = {
  "grow-a-garden": "farming",
  "color-bloom": "puzzle",
  "smash-the-dummy": "physics",
  "ultimate-3d-chess": "chess",
  "car-color-palette": "customization",
  "rail-in-air": "coaster",
  "state-conquest": "strategy",
};

let failed = 0;
for (const s of SAMPLES) {
  const spec = specForSample(s);
  const rt = buildGodotRuntimePayload(spec);
  const expected = EXPECT[s.id];
  if (expected && rt.godotKey !== expected) {
    console.error(`[FAIL] ${s.id} godotKey=${rt.godotKey} expected=${expected}`);
    failed += 1;
  } else if (expected) {
    console.log(`[OK] ${s.id} → godotKey=${rt.godotKey}`);
  }
}

if (failed > 0) process.exit(1);
console.log(`qa-godot-runtime-keys: ${Object.keys(EXPECT).length} dedicated keys OK`);
