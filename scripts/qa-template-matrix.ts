/**
 * 六模板离线矩阵：`npm run qa:template-matrix`
 * 覆盖 mock → director/systems → parseGameSpec → 模板专属字段
 */
import type { GameSpec } from "../src/lib/game-spec";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { buildDirector } from "../src/lib/director";
import { buildSystems } from "../src/lib/systems";
import { parseGameSpec } from "../src/lib/game-spec";
import { coerceGameSpec } from "../src/lib/normalize-spec";

const MATRIX: Array<{
  id: GameSpec["templateId"];
  prompt: string;
  expectScene: "PlayScene" | "PlatformerScene" | "TowerDefenseScene" | "ShooterScene";
}> = [
  { id: "avoider", prompt: "躲开从天而降的陨石", expectScene: "PlayScene" },
  { id: "collector", prompt: "收集散落金币躲开尖刺", expectScene: "PlayScene" },
  { id: "survivor", prompt: "多条命生存模式躲开尖刺", expectScene: "PlayScene" },
  { id: "platformer", prompt: "横版闯关跳跃收集钥匙过关", expectScene: "PlatformerScene" },
  { id: "towerDefense", prompt: "塔防卫萝卜波次守住基地", expectScene: "TowerDefenseScene" },
  { id: "shooter", prompt: "飞船射击消灭敌机", expectScene: "ShooterScene" },
];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function sceneForTemplate(t: GameSpec["templateId"]): (typeof MATRIX)[number]["expectScene"] {
  if (t === "towerDefense") return "TowerDefenseScene";
  if (t === "platformer") return "PlatformerScene";
  if (t === "shooter") return "ShooterScene";
  return "PlayScene";
}

function assertPlayTrioEvents(spec: GameSpec) {
  const types = (spec.director?.events ?? []).map((e) => e.type);
  assert(types.includes("coinRain"), `${spec.templateId}: coinRain`);
  assert(types.includes("goalShift"), `${spec.templateId}: goalShift`);
  assert(types.includes("miniBoss"), `${spec.templateId}: miniBoss`);
  if (spec.templateId === "avoider") assert(types.includes("finalBarrage"), "avoider: finalBarrage");
  if (spec.templateId === "collector") assert(types.includes("goldenPickup"), "collector: goldenPickup");
  if (spec.templateId === "survivor") assert(types.includes("breathingRoom"), "survivor: breathingRoom");
}

function main() {
  let pass = 0;
  for (const row of MATRIX) {
    const spec = mockSpecFromPrompt(row.prompt);
    assert(spec.templateId === row.id, `mock template ${row.id} got ${spec.templateId}`);
    assert(sceneForTemplate(spec.templateId) === row.expectScene, `scene map ${row.id}`);

    const parsed = parseGameSpec(JSON.parse(JSON.stringify(spec)));
    assert(parsed.templateId === row.id, `parse roundtrip ${row.id}`);
    assert(parsed.director?.acts?.length === 4, `${row.id} acts`);

    const dir = buildDirector({ prompt: row.prompt, spec: parsed });
    assert(dir.acts.length === 4, `buildDirector acts ${row.id}`);

    const sys = buildSystems({ prompt: row.prompt, spec: parsed });
    assert(Boolean(sys.skill?.id), `${row.id} skill`);

    if (row.id === "towerDefense") {
      assert(Boolean(parsed.towerDefense?.waves?.length), `${row.id} td waves`);
      assert((parsed.gameplay.startingCoins ?? 0) > 0, `${row.id} startingCoins`);
    }
    if (row.id === "platformer") {
      assert((parsed.gameplay.jumpStrength ?? 0) > 0, `${row.id} jumpStrength`);
      assert((parsed.gameplay.gravity ?? 0) > 0, `${row.id} gravity`);
    }
    if (row.id === "shooter") {
      assert((parsed.gameplay.jumpStrength ?? 0) > 0, `${row.id} shooter jump`);
    }
    if (row.id === "avoider" || row.id === "collector" || row.id === "survivor") {
      assertPlayTrioEvents(parsed);
    }

    const coerced = coerceGameSpec(parsed);
    assert(coerced.ok, `coerce ${row.id}`);
    pass += 1;
    console.log(`  [OK] ${row.id} · ${row.prompt.slice(0, 20)}…`);
  }

  console.log(`[OK] qa-template-matrix: ${pass}/${MATRIX.length} templates`);
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
