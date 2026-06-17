import fs from "node:fs";
import path from "node:path";
import { buildSceneGoalGuidance } from "../src/lib/scene-goal-guidance";
import type { GameSpec } from "../src/lib/game-spec";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function spec(templateId: GameSpec["templateId"]): GameSpec {
  return {
    version: 1,
    templateId,
    title: "星港守卫",
    theme: {
      backgroundColor: "#0f172a",
      playerColor: "#38bdf8",
      hazardColor: "#fb7185",
      collectibleColor: "#facc15",
      particleTint: "#a78bfa",
    },
    gameplay: {
      playerSpeed: 260,
      hazardSpeed: 220,
      spawnIntervalMs: 900,
      winScore: 24,
      lives: 3,
      startingCoins: 120,
      baseHealth: 42,
    },
    labels: {
      player: "守卫者",
      hazard: "入侵者",
      collectible: "能量晶体",
      subtitle: "守住核心，打出连击节奏",
    },
  };
}

for (const templateId of ["collector", "shooter", "platformer", "towerDefense"] as const) {
  const guidance = buildSceneGoalGuidance(spec(templateId), "zh-Hans");
  assert(guidance.title.includes("星港守卫"), `${templateId}: title should include game title`);
  assert(guidance.objective.length >= 8, `${templateId}: objective should be specific`);
  assert(guidance.controls.length >= 6, `${templateId}: controls should explain action`);
  assert(guidance.banner.message.includes("目标"), `${templateId}: banner message should lead with goal`);
  assert(guidance.bottomHint.includes("操作"), `${templateId}: bottom hint should include controls`);
  assert(!/ready|debug|template/i.test(guidance.banner.title), `${templateId}: guidance should not feel like debug copy`);
}

const templeGuidance = buildSceneGoalGuidance(
  {
    ...spec("collector"),
    templateId: "racing",
    samplePlayProfile: { variantId: "temple-relic-runner" },
    coaster: { mode: "endlessRoad", path: [{ x: 0, y: 0 }], distanceGoal: 999_999 },
  },
  "zh-Hans",
);
assert(templeGuidance.controls.includes("跳跃"), "temple runner guidance should mention jump");
assert(templeGuidance.objective.includes("无尽"), "temple runner guidance should mention endless run");

for (const scene of ["PlayScene", "ShooterScene", "PlatformerScene", "TowerDefenseScene", "CoasterScene"]) {
  const source = fs.readFileSync(path.join(process.cwd(), `src/game/engine/${scene}.ts`), "utf8");
  assert(source.includes("buildSceneGoalGuidance"), `${scene} should use shared goal guidance`);
}

console.log("[OK] qa-scene-goal-guidance");
