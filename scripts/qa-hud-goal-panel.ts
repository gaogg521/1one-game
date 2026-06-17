import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const panelPath = path.join(process.cwd(), "src/game/engine/HudGoalPanel.ts");
assert(fs.existsSync(panelPath), "HudGoalPanel component should exist");

const panelSource = fs.readFileSync(panelPath, "utf8");
for (const symbol of ["export class HudGoalPanel", "SceneGoalGuidance", "CohesivePresentation", "show(", "update(", "destroy("]) {
  assert(panelSource.includes(symbol), `HudGoalPanel should include ${symbol}`);
}

for (const scene of ["PlayScene", "ShooterScene", "PlatformerScene", "TowerDefenseScene", "FarmingScene", "PuzzleScene", "PhysicsScene", "CoasterScene"]) {
  const source = fs.readFileSync(path.join(process.cwd(), `src/game/engine/${scene}.ts`), "utf8");
  assert(source.includes("HudGoalPanel"), `${scene} should mount HudGoalPanel`);
  assert(source.includes("this.goalPanel"), `${scene} should keep a goalPanel instance`);
}

console.log("[OK] qa-hud-goal-panel");
