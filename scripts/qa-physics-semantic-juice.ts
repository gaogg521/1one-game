import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine/PhysicsScene.ts"), "utf8");

assert(source.includes("juiceHit"), "PhysicsScene should use semantic hit feedback");
assert(source.includes("juiceCombo"), "PhysicsScene should use semantic combo feedback");
assert(source.includes("juiceWin"), "PhysicsScene should use semantic win feedback");
assert(!source.includes("juiceShake(this, { intensityScale"), "PhysicsScene should not keep old ad-hoc hit shake");

console.log("[OK] qa-physics-semantic-juice");
