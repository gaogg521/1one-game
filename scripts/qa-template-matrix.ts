/**
 * Phase 4：语义模板 + 专用运行时矩阵 QA
 * npm run qa:template-matrix
 */
import type { GameSpec } from "../src/lib/game-spec";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { buildDirector } from "../src/lib/director";
import { buildSystems } from "../src/lib/systems";
import { parseGameSpec } from "../src/lib/game-spec";
import { coerceGameSpec } from "../src/lib/normalize-spec";
import { expectedPhaserSceneName } from "../src/lib/game-templates/runtime";
import { enrichGameSpecForRuntime } from "../src/lib/enrich-game-spec";
import { SAMPLES } from "../src/lib/samples";
import { specForSample } from "../src/lib/sample-specs";

const CORE_MATRIX: Array<{
  id: GameSpec["templateId"];
  prompt: string;
}> = [
  { id: "avoider", prompt: "躲开从天而降的陨石" },
  { id: "collector", prompt: "收集散落金币躲开尖刺" },
  { id: "survivor", prompt: "多条命生存模式躲开尖刺" },
  { id: "platformer", prompt: "横版闯关跳跃收集钥匙过关" },
  { id: "towerDefense", prompt: "塔防卫萝卜波次守住基地" },
  { id: "shooter", prompt: "飞船射击消灭敌机" },
  { id: "coaster", prompt: "空中轨道过山车竞速" },
  { id: "puzzle", prompt: "色彩消除益智 match3" },
  { id: "farming", prompt: "星露谷种地农场农业灌溉收获" },
  { id: "physics", prompt: "打击 dummy 假人解压" },
  { id: "chess", prompt: "国际象棋对弈" },
  { id: "customization", prompt: "汽车换装角色自定义造型定制 avatar maker" },
  { id: "strategy", prompt: "地图征服派兵占领区域" },
];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function runRow(row: (typeof CORE_MATRIX)[number]) {
  const spec = mockSpecFromPrompt(row.prompt);
  assert(spec.templateId === row.id, `mock template ${row.id} got ${spec.templateId}`);

  const scene = expectedPhaserSceneName(spec);
  if (row.id === "puzzle") assert(scene === "PuzzleScene", "puzzle scene");
  if (row.id === "farming") assert(scene === "FarmingScene", "farming scene");
  if (row.id === "physics") assert(scene === "PhysicsScene", "physics scene");
  if (row.id === "chess") assert(scene === "ChessScene", "chess scene");
  if (row.id === "customization") assert(scene === "CustomizationScene", "customization scene");
  if (row.id === "strategy") assert(scene === "StrategyScene", "strategy scene");
  if (row.id === "coaster") assert(scene === "CoasterScene", "coaster scene");

  const parsed = parseGameSpec(JSON.parse(JSON.stringify(spec)));
  assert(parsed.templateId === row.id, `parse roundtrip ${row.id}`);

  const dir = buildDirector({ prompt: row.prompt, spec: parsed });
  assert(dir.acts.length === 4, `buildDirector acts ${row.id}`);

  const sys = buildSystems({ prompt: row.prompt, spec: parsed });
  assert(Boolean(sys.skill?.id), `${row.id} skill`);

  if (row.id === "towerDefense") assert(Boolean(parsed.towerDefense?.waves?.length), "td waves");
  if (row.id === "puzzle") assert(Boolean(parsed.puzzle?.mode), "puzzle blueprint");
  if (row.id === "farming") assert(Boolean(parsed.farming?.crops?.length), "farming blueprint");
  if (row.id === "strategy") {
    const enriched = enrichGameSpecForRuntime(parsed, row.prompt);
    assert(Boolean(enriched.strategy?.nodes?.length), "strategy blueprint");
  }
  if (row.id === "coaster") assert(Boolean(parsed.coaster?.path?.length), "coaster path");

  const coerced = coerceGameSpec(parsed);
  assert(coerced.ok, `coerce ${row.id}`);
  console.log(`  [OK] ${row.id} → ${scene}`);
}

function main() {
  for (const row of CORE_MATRIX) runRow(row);

  for (const s of SAMPLES) {
    const spec = specForSample(s);
    const scene = expectedPhaserSceneName(spec);
    if (s.id === "grow-a-garden") assert(scene === "FarmingScene", "sample farming");
    if (s.id === "smash-the-dummy") assert(scene === "PhysicsScene", "sample physics");
    if (s.id === "temple-relic-runner") assert(scene === "CoasterScene", "sample temple runner");
    if (s.id === "color-bloom") assert(scene === "PuzzleScene", "sample match3");
    console.log(`  [OK] sample/${s.id} → ${scene}`);
  }

  console.log(`[OK] qa-template-matrix: ${CORE_MATRIX.length} templates + ${SAMPLES.length} samples`);
}

main();
