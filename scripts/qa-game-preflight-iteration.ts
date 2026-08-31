import assert from "node:assert/strict";
import { GamePreflightIterationJobPayloadSchema, GameProductionJobPayloadSchema } from "@/lib/creator-core/types";
import { buildGamePreflightRevisionInstruction, shouldScheduleGamePreflightIteration } from "@/lib/game-preflight-iteration";

const base = { projectId: "project", ownerKey: "owner", spec: { title: "QA" }, brief: null, uiLocale: "zh-Hans" };
const initial = GameProductionJobPayloadSchema.parse(base);
assert.equal(initial.productionRound, 1);
assert.equal(initial.maxProductionRounds, 3);

const retry = GamePreflightIterationJobPayloadSchema.parse({
  projectId: "project",
  ownerKey: "owner",
  sourceRevisionId: "revision",
  productionRound: 2,
  maxProductionRounds: 3,
  blockers: ["vertical_slice_blocked"],
  uiLocale: "zh-Hans",
});
assert.equal(shouldScheduleGamePreflightIteration(retry), true);
assert.equal(shouldScheduleGamePreflightIteration({ ...retry, productionRound: 3 }), false, "last permitted production round retires instead of looping forever");
assert.equal(shouldScheduleGamePreflightIteration({ ...retry, blockers: [] }), false, "a passing candidate never schedules a repair job");
assert.equal(GamePreflightIterationJobPayloadSchema.safeParse({ ...retry, maxProductionRounds: 6 }).success, false);
const instruction = buildGamePreflightRevisionInstruction(retry);
assert.match(instruction, /第 3\/3 轮/);
assert.match(instruction, /vertical_slice_blocked/);
assert.match(instruction, /必须实际修改 GameSpec/);

console.log("[OK] qa-game-preflight-iteration: 3-5 round preflight repair is bounded and blocker-driven");
