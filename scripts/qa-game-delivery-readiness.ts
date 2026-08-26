import assert from "node:assert/strict";
import { generateGameSpecWithMeta } from "@/lib/generate-spec";
import { evaluateGameDeliveryReadiness } from "@/lib/game-delivery-readiness";

const cases = [
  "设计一个手机单手玩的三消闯关游戏",
  "做一个横版跳跃收集宝石的冒险",
  "设计一款防守城堡抵抗怪物的塔防",
  "做一个种花收获升级的小农场",
] as const;

async function main() {
  let firstSpec: Awaited<ReturnType<typeof generateGameSpecWithMeta>>["spec"] | undefined;
  for (const prompt of cases) {
    const { spec, debug } = await generateGameSpecWithMeta(prompt);
    firstSpec ??= spec;
    assert.equal(spec.production?.delivery?.targetDevice, "mobile_h5", `${prompt}: delivery target must be mobile H5`);
    assert.equal(spec.production?.delivery?.targetSessionSeconds, 60, `${prompt}: first session must have a 60-second target`);
    assert.equal(spec.production?.delivery?.firstRewardBySecond, 20, `${prompt}: first reward target is required`);
    assert.ok(debug.deliveryReadiness, `${prompt}: generation debug must expose delivery preflight`);
    const readiness = evaluateGameDeliveryReadiness(spec);
    assert.notEqual(readiness.verdict, "blocked", `${prompt}: default kernel must pass delivery preflight`);
    assert.ok(readiness.metrics.estimatedSuccessRate >= 0.42, `${prompt}: numeric envelope must avoid immediate failure`);
    assert.equal(readiness.balance.kind, "deterministic_scenario_sweep", `${prompt}: balance check must be auditable scenario sweep`);
    assert.notEqual(readiness.balance.verdict, "blocked", `${prompt}: default kernel must pass balance scenario sweep`);
  }
  const broken = evaluateGameDeliveryReadiness({
    ...firstSpec!,
    production: { ...firstSpec!.production!, delivery: undefined },
    gameplay: { ...firstSpec!.gameplay, playerSpeed: 0, hazardSpeed: 0, spawnIntervalMs: 0, lives: 0, winScore: 0 },
  });
  assert.equal(broken.verdict, "blocked", "a game without delivery and playable numeric envelopes must fail closed");
  console.log(`[OK] qa-game-delivery-readiness: ${cases.length} generated games carry delivery and balance preflight contracts`);
}

main().catch((error) => { console.error(error); process.exit(1); });
