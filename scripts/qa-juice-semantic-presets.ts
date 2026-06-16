import { resolveJuicePreset } from "../src/game/engine/gameJuice";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const pickup = resolveJuicePreset("pickup");
const hit = resolveJuicePreset("hit");
const combo = resolveJuicePreset("combo", { combo: 5 });
const boss = resolveJuicePreset("boss");
const win = resolveJuicePreset("win");
const fail = resolveJuicePreset("fail");

assert(hit.shakeIntensity > pickup.shakeIntensity, "hit should shake harder than pickup");
assert(combo.burstCount > pickup.burstCount, "combo should emit more particles than pickup");
assert(combo.floaterPrefix === "x", "combo should use multiplier floater prefix");
assert(boss.burstCount > hit.burstCount, "boss should emit more particles than a normal hit");
assert(win.flashDurationMs > pickup.flashDurationMs, "win should have longer flash than pickup");
assert(fail.shakeDurationMs >= hit.shakeDurationMs, "fail should have at least hit-level shake duration");

console.log("[OK] qa-juice-semantic-presets");
