import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const helperPath = path.join(process.cwd(), "src/game/engine/runtimeEventImpact.ts");
assert(fs.existsSync(helperPath), "runtimeEventImpact helper should exist");

const helperSource = fs.readFileSync(helperPath, "utf8");
for (const symbol of ["applyRuntimeEventImpact", "juicePickup", "juiceHit", "juiceCombo", "juiceBoss"]) {
  assert(helperSource.includes(symbol), `runtimeEventImpact should include ${symbol}`);
}

for (const scene of ["PlayScene", "ShooterScene", "PlatformerScene", "TowerDefenseScene"]) {
  const source = fs.readFileSync(path.join(process.cwd(), `src/game/engine/${scene}.ts`), "utf8");
  assert(source.includes("applyRuntimeEventImpact"), `${scene} should use shared runtime event impact`);
  assert(source.includes("startEvent(ev: DirectorEvent)"), `${scene} should keep director event entry point`);
}

console.log("[OK] qa-runtime-depth-observable");
