import { applyHardQualityDefaults } from "../src/lib/game-quality";
import type { GameSpec } from "../src/lib/game-spec";
import { lintGameSpecForOrchestration } from "../src/lib/orchestration/lint-spec";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function baseSpec(templateId: GameSpec["templateId"], title: string): GameSpec {
  return {
    version: 1,
    templateId,
    title,
    theme: {
      backgroundColor: "#111827",
      playerColor: "#38bdf8",
      hazardColor: "#f97316",
    },
    gameplay: {
      playerSpeed: 160,
      hazardSpeed: 90,
      spawnIntervalMs: 320,
      winScore: 6,
      lives: 1,
      arenaPadding: 32,
      jumpStrength: 320,
      gravity: 620,
      startingCoins: 45,
      baseHealth: 20,
    },
    labels: {
      player: "主角",
      hazard: "敌人",
      collectible: "奖励",
      subtitle: "普通用户非样品 prompt",
    },
  };
}

const cases: Array<{ prompt: string; spec: GameSpec }> = [
  { prompt: "做一个赛博猫咪收集金币躲避无人机的小游戏", spec: baseSpec("collector", "赛博猫咪冲刺") },
  { prompt: "做一个太空飞船打陨石和 boss 的射击游戏", spec: baseSpec("shooter", "星际炮火") },
  { prompt: "做一个植物守家打怪物的塔防经营游戏", spec: baseSpec("towerDefense", "花园守卫战") },
  { prompt: "做一个物理撞击木偶获得连击和爆炸反馈的游戏", spec: baseSpec("physics", "爆裂训练场") },
  { prompt: "做一个农场种菜收获升级抵御害虫的休闲游戏", spec: baseSpec("farming", "晨光农场") },
];

for (const { prompt, spec } of cases) {
  assert(!spec.samplePlayProfile?.variantId, `${spec.title}: contract case must be non-sample`);
  const upgraded = applyHardQualityDefaults(spec, prompt);
  const lint = lintGameSpecForOrchestration(upgraded);

  assert(lint.ok, `${spec.title}: upgraded spec should pass orchestration lint: ${lint.ok ? "" : lint.issues.join("; ")}`);
  assert(upgraded.director, `${spec.title}: non-sample spec should have director`);
  assert((upgraded.director?.acts.length ?? 0) >= 4, `${spec.title}: should have at least 4 acts`);
  assert((upgraded.director?.events?.length ?? 0) >= 3, `${spec.title}: should have at least 3 runtime events`);
  assert(upgraded.systems?.skill, `${spec.title}: should have an active skill`);
  assert((upgraded.systems?.powerups?.length ?? 0) >= 4, `${spec.title}: should have at least 4 powerups`);
  assert(
    upgraded.presentation?.qualityTier === "standard" || upgraded.presentation?.qualityTier === "showcase",
    `${spec.title}: non-sample spec should default to a commercial presentation quality tier`,
  );
}

console.log("[OK] qa-non-sample-game-quality");
