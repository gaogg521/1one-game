import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const helperPath = path.join(process.cwd(), "src/game/engine/systemImpact.ts");
assert(fs.existsSync(helperPath), "systemImpact helper should exist");

const helperSource = fs.readFileSync(helperPath, "utf8");
for (const symbol of ["applySystemImpact", "skill", "powerup", "juicePickup", "juiceBoss", "juiceCombo"]) {
  assert(helperSource.includes(symbol), `systemImpact should include ${symbol}`);
}

for (const scene of ["PlayScene", "PlatformerScene"]) {
  const source = fs.readFileSync(path.join(process.cwd(), `src/game/engine/${scene}.ts`), "utf8");
  assert(source.includes("applySystemImpact"), `${scene} should use shared systems impact`);
  assert(source.includes("private applyPowerup"), `${scene} should keep powerup runtime entry point`);
  assert(source.includes("private tryCastSkill"), `${scene} should keep skill runtime entry point`);
}

for (const scene of ["ShooterScene", "TowerDefenseScene"]) {
  const source = fs.readFileSync(path.join(process.cwd(), `src/game/engine/${scene}.ts`), "utf8");
  assert(source.includes("applySystemImpact"), `${scene} should use shared skill impact`);
  assert(source.includes("private tryCastSkill"), `${scene} should keep skill runtime entry point`);
}

console.log("[OK] qa-systems-observable-impact");
