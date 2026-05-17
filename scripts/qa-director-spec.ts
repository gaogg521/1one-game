/**
 * 离线断言 director/mock：`npm run qa:director-spec`
 */
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { buildDirector } from "../src/lib/director";
import { coerceGameSpec } from "../src/lib/normalize-spec";

const PROMPTS = [
  "躲开从天而降的障碍物",
  "收集散落金币躲开尖刺",
  "多条命生存模式躲开尖刺",
  "横版闯关跳跃收集钥匙过关",
  "塔防卫萝卜波次守住基地",
  "飞船射击消灭敌机",
];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  for (const prompt of PROMPTS) {
    const spec = mockSpecFromPrompt(prompt);
    assert(spec.director?.acts?.length === 4, `mock acts≠4 prompt=${prompt.slice(0, 24)}`);
    const types = (spec.director?.events ?? []).map((e) => e.type);
    if (
      spec.templateId === "avoider" ||
      spec.templateId === "collector" ||
      spec.templateId === "survivor"
    ) {
      assert(types.includes("coinRain"), `missing coinRain ${spec.templateId}`);
      assert(types.includes("goalShift"), `missing goalShift ${spec.templateId}`);
      assert(types.includes("miniBoss"), `missing miniBoss ${spec.templateId}`);
      if (spec.templateId === "avoider") {
        assert(types.includes("finalBarrage"), `missing finalBarrage avoider`);
      }
      if (spec.templateId === "collector") {
        assert(types.includes("goldenPickup"), `missing goldenPickup collector`);
      }
      if (spec.templateId === "survivor") {
        assert(types.includes("breathingRoom"), `missing breathingRoom survivor`);
      }
    }
  }

  const d = buildDirector({
    prompt: "收集金币躲开陷阱",
    spec: mockSpecFromPrompt("收集金币躲开陷阱"),
  });
  assert(d.acts.length === 4, "buildDirector acts length");
  const evTypes = (d.events ?? []).map((e) => e.type);
  assert(evTypes.includes("coinRain") && evTypes.includes("goalShift") && evTypes.includes("miniBoss"), "play trio");

  console.log(`[OK] qa-director-spec: ${PROMPTS.length} mocks + buildDirector`);

  const coerced = coerceGameSpec({
    version: 1,
    templateId: "collector",
    title: "测试",
    theme: {
      backgroundColor: "#111111",
      playerColor: "#222222",
      hazardColor: "#333333",
      collectibleColor: "#444444",
      particleTint: "#555555",
    },
    gameplay: {
      playerSpeed: 300,
      hazardSpeed: 200,
      spawnIntervalMs: 700,
      winScore: 20,
      lives: 3,
      arenaPadding: 32,
      jumpStrength: 420,
      gravity: 980,
      startingCoins: 120,
      baseHealth: 48,
    },
    labels: { player: "A", hazard: "B", collectible: "C", subtitle: "D" },
    director: {
      intensity: 0.61,
      acts: [
        { at: 0, label: "开场", modifiers: [] },
        { at: 0.33, label: "加速", modifiers: ["doubleSpawn"] },
        { at: 0.66, label: "变奏", modifiers: [] },
        { at: 1, label: "终局", modifiers: ["finale"] },
      ],
      events: [{ at: 0.5, type: "coinRain", durationMs: 4000 }],
    },
  });
  assert(coerced.ok && coerced.spec.director?.acts?.length === 4, "coerce preserves director");
  console.log("[OK] qa-director-spec: coerceGameSpec keeps validated director");
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
