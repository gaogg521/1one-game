/**
 * platformer stealth 离线断言（Elastic Thief 2 对标）
 */
import assert from "node:assert/strict";
import { buildPlatformerBlueprint, inferPlatformerMode } from "@/lib/platformer-blueprint";

assert.equal(inferPlatformerMode({ sampleId: "elastic-thief-2" }), "stealth");
assert.equal(inferPlatformerMode({ prompt: "普通平台跳跃" }), "standard");

const thief = buildPlatformerBlueprint({ sampleId: "elastic-thief-2", prompt: "Elastic Thief 2" });
assert.equal(thief.mode, "stealth");
assert.equal(thief.grappleEnabled, true);
assert.ok((thief.suggestedWinScore ?? 0) >= 12);

console.log("qa:platformer-stealth-mode: ok");
