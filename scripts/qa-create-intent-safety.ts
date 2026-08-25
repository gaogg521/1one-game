import assert from "node:assert/strict";
import { buildCoCreationDirections, buildCoCreationIntent } from "@/lib/create-studio-narrative";

const prompt = "设计一个开心消消乐游戏";
const intent = buildCoCreationIntent(prompt, "auto", "zh-Hans");
const directions = buildCoCreationDirections(intent, "zh-Hans", prompt);

assert.equal(intent.templateId, "puzzle", "消消乐必须路由到 puzzle 模板");
assert.equal(directions.length, 1, "三消细化只保留与原意一致的方向");
assert.equal(directions[0]?.id, "puzzle-match3");
assert.match(directions[0]?.promptAddon ?? "", /交换相邻棋子/);
assert.match(directions[0]?.title ?? "", /三消/);

console.log("qa:create-intent-safety: ok");
