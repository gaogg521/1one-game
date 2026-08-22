import { RuntimeActorStateMachine } from "../src/game/engine/runtime-actor-state";
import fs from "node:fs";
import path from "node:path";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const actor = new RuntimeActorStateMachine();
assert(actor.snapshot().state === "intro", "actor should begin in intro");
actor.set("idle", 0);
actor.set("hit", 10, 200);
actor.set("move", 50);
assert(actor.snapshot().state === "hit", "held hit feedback must not be overwritten by movement");
actor.set("move", 210);
assert(actor.snapshot().state === "move", "movement should resume after the feedback hold");
actor.set("victory", 220);
actor.set("idle", 500);
assert(actor.snapshot().state === "victory", "terminal success state must remain observable");

for (const scene of ["FarmingScene", "PhysicsScene", "PlatformerScene", "PlayScene", "PuzzleScene"]) {
  const source = fs.readFileSync(path.join(process.cwd(), "src/game/engine", `${scene}.ts`), "utf8");
  assert(source.includes("RuntimeActorStateMachine"), `${scene} must use the shared actor state machine`);
  assert(source.includes("actorStateTransitions"), `${scene} must expose state transitions to runtime QA`);
}

console.log("[OK] qa-runtime-actor-state");
