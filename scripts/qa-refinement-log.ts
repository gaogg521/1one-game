/**
 * 离线：refinement 日志与请求体校验。`npm run qa:refinement-log`
 */
import { appendRefinementLog, parseRefinementLog } from "../src/lib/refinement-log";
import { parseRefineBody } from "../src/lib/refinement-request";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  let json = appendRefinementLog(null, {
    at: "2026-05-17T00:00:00.000Z",
    mode: "patch",
    instruction: "第一次",
  });
  json = appendRefinementLog(json, {
    at: "2026-05-17T00:01:00.000Z",
    mode: "regenerate",
    instruction: "第二次",
  });
  const list = parseRefinementLog(json);
  assert(list.length === 2, "log length");
  assert(list[0]?.mode === "patch", "first mode");

  const bad = parseRefineBody({ instruction: "  hi  ", mode: "patch" });
  assert(bad.ok && bad.body.instruction === "hi", "trim instruction");

  const invalid = parseRefineBody({ instruction: "", mode: "patch" });
  assert(!invalid.ok, "reject empty");

  console.log("[OK] qa-refinement-log");
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
