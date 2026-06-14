/**
 * 多回合共创闭环离线 QA：refine stub + 日志 + create?from 回放字段
 * npm run qa:co-create-loop
 */
import assert from "node:assert/strict";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { appendRefinementLog, parseRefinementLog, pickLastRefinementEntry } from "../src/lib/refinement-log";
import { parseRefineBody } from "../src/lib/refinement-request";
import { refineSpecWithStub } from "../src/lib/refinement-stub";

function main() {
  const spec = mockSpecFromPrompt("收集金币躲开尖刺");
  const patch = refineSpecWithStub({
    mode: "patch",
    spec,
    instruction: "初始金币200",
    currentPrompt: "收集金币",
  });
  assert.match(patch.spec.title ?? "", /初始金币200/, "patch stub 应反映 instruction");
  assert.ok(patch.mergedPrompt.includes("初始金币200"), "mergedPrompt 应含 instruction");

  const regen = refineSpecWithStub({
    mode: "regenerate",
    spec,
    instruction: "节奏更快",
    currentPrompt: "收集金币",
  });
  assert.match(regen.spec.labels.subtitle ?? "", /regen:节奏更快/, "regenerate stub 应标记 subtitle");

  let log = appendRefinementLog(null, {
    at: new Date().toISOString(),
    mode: "patch",
    instruction: "第一轮",
  });
  log = appendRefinementLog(log, {
    at: new Date().toISOString(),
    mode: "regenerate",
    instruction: "第二轮",
  });
  const history = parseRefinementLog(log);
  assert.equal(history.length, 2);
  assert.equal(history[1]?.mode, "regenerate");

  const last = pickLastRefinementEntry(log);
  assert.equal(last?.instruction, "第二轮");

  const body = parseRefineBody({ instruction: "  继续改  ", mode: "patch" });
  assert.ok(body.ok && body.body.instruction === "继续改");

  console.log("qa-co-create-loop: ok");
}

main();
