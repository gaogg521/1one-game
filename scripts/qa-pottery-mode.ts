/**
 * customization pottery 离线断言（Pottery Master 3D 对标）
 */
import assert from "node:assert/strict";
import { buildCustomizationBlueprint, inferCustomizationMode } from "@/lib/customization-blueprint";

assert.equal(inferCustomizationMode({ sampleId: "pottery-master-3d" }), "pottery");
assert.equal(inferCustomizationMode({ prompt: "汽车改色" }), "carPaint");

const pottery = buildCustomizationBlueprint({ sampleId: "pottery-master-3d", prompt: "Pottery Master 3D" });
assert.equal(pottery.mode, "pottery");
assert.ok((pottery.editGoal ?? 0) >= 6);

console.log("qa:pottery-mode: ok");
