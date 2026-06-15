/**
 * coaster endlessRoad 离线断言
 */
import assert from "node:assert/strict";
import { buildCoasterBlueprint, inferCoasterMode } from "@/lib/coaster-blueprint";

assert.equal(inferCoasterMode({ sampleId: "crashy-roads" }), "endlessRoad");
assert.equal(inferCoasterMode({ prompt: "空中过山车计时赛" }), "coaster");
assert.equal(inferCoasterMode({ prompt: "无尽公路换道躲避" }), "endlessRoad");

const crashy = buildCoasterBlueprint({ sampleId: "crashy-roads", prompt: "Crashy Roads" });
assert.equal(crashy.mode, "endlessRoad");
assert.ok((crashy.distanceGoal ?? 0) > 500);

console.log("qa:coaster-endless-mode: ok");
