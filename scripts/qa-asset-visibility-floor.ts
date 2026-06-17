import fs from "node:fs";
import path from "node:path";
import { assetBackgroundAlpha, visibleSpriteTargetSize } from "../src/game/engine/phaser-loaded-sprites";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

assert(assetBackgroundAlpha(null, "standard") >= 0.18, "user-generated standard backgrounds should be visible");
assert(assetBackgroundAlpha("project-123", "standard") >= 0.18, "non-sample project backgrounds should be visible");
assert(assetBackgroundAlpha("sample-abc", "showcase") >= 0.24, "sample showcase backgrounds should stay prominent");
assert(assetBackgroundAlpha("project-123", "minimal") >= 0.14, "minimal tier should not make backgrounds disappear");

assert(visibleSpriteTargetSize("player", "standard") >= 46, "standard player sprites should have a visible size floor");
assert(visibleSpriteTargetSize("hazard", "standard") >= 36, "standard hazard sprites should have a visible size floor");
assert(visibleSpriteTargetSize("collectible", "standard") >= 30, "standard collectible sprites should have a visible size floor");
assert(visibleSpriteTargetSize("boss", "showcase") >= 72, "showcase boss sprites should feel prominent");

for (const scene of ["PlayScene", "ShooterScene", "PlatformerScene", "TowerDefenseScene", "FarmingScene", "PuzzleScene", "PhysicsScene"]) {
  const source = fs.readFileSync(path.join(process.cwd(), `src/game/engine/${scene}.ts`), "utf8");
  assert(source.includes("assetBackgroundAlpha"), `${scene} should use shared background visibility floor`);
  assert(!source.includes(".setAlpha(0.12)"), `${scene} should not hardcode low background alpha 0.12`);
  assert(!source.includes(".setAlpha(0.1)"), `${scene} should not hardcode low background alpha 0.1`);
}

const puzzleSource = fs.readFileSync(path.join(process.cwd(), "src/game/engine/PuzzleScene.ts"), "utf8");
assert(puzzleSource.includes(".setDepth(-7)"), "PuzzleScene background image should sit above the opaque puzzle backdrop");

console.log("[OK] qa-asset-visibility-floor");
