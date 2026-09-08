import fs from "node:fs";
import { parseGameSpec } from "@/lib/game-spec";
import { validateGameRuntime } from "@/lib/game-runtime-validation";
import type { QaReport } from "@/lib/game-forge/types";
async function main() {
  const data = JSON.parse(fs.readFileSync("qa-output/runtime-delivery/prod-before.json", "utf8"));
  const spec = parseGameSpec(JSON.parse(data.project.specJson));
  const result = await validateGameRuntime(spec, data.project.id, spec.forgeBuild?.qa as QaReport);
  fs.writeFileSync("qa-output/runtime-delivery/production-fixture-report.json", JSON.stringify(result, null, 2));
  console.log(result);
}
void main();
