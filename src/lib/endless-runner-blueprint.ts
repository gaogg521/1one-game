import type { GameSpec } from "@/lib/game-spec";
import { makeSeededRng, jitter } from "@/lib/prompt-fingerprint";

/**
 * 无尽跑酷蓝图（神庙逃亡 / Subway Surfers 风格 3 道跑酷）。
 * 与 EndlessRunnerBlueprintSchema 对齐：
 * - lanes：道数（通常 3）
 * - targetScore：通关分数
 * - speed：滚动速度（像素/秒）
 * - obstacleDensity：障碍密度 0..1
 */
export type EndlessRunnerBlueprint = {
  /** 道数（神庙逃亡/Subway Surfers 标准 3） */
  lanes: number;
  /** 目标分数（达到即通关） */
  targetScore: number;
  /** 滚动速度（像素/秒） */
  speed: number;
  /** 障碍密度 0..1（越高越频繁） */
  obstacleDensity: number;
};

/**
 * 按 prompt 与 director.intensity 推断蓝图。
 * - lanes 固定 3（神庙逃亡式标准玩法）
 * - targetScore 2000..5000（按 intensity）
 * - speed 450..650（按 intensity）
 * - obstacleDensity 0.3..0.6（按 intensity）
 *
 * 同 prompt 永远出同蓝图；不同 prompt 出不同细节（seed 驱动 ±8% 微调）。
 */
export function buildEndlessRunnerBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
  sampleId?: string;
}): EndlessRunnerBlueprint {
  const intensity = opts.spec?.director?.intensity ?? 0.62;

  // 千人千面：从 prompt 派生 seed，微调目标分 / 速度 / 密度（同模板不同 prompt 出不同局）
  const seed = opts.spec?.samplePlayProfile?.seed ?? 0;
  const seedInt = Math.floor(seed * 0x100000000);
  const rng = makeSeededRng(seedInt || 1);

  // 道数固定 3（神庙逃亡式核心玩法）
  const lanes = 3;

  // 目标分：基础 3000，随 intensity 上升至 5000；高强度 +难达
  const baseTarget = 2800 + intensity * 2200;
  const targetScore = Math.round(jitter(rng, baseTarget, 2000, 5000, 0.08));

  // 速度：基础 480，随 intensity 上升至 650
  const baseSpeed = 480 + intensity * 170;
  const speed = Math.round(jitter(rng, baseSpeed, 450, 650, 0.08));

  // 障碍密度：基础 0.4，随 intensity 上升至 0.6
  const baseDensity = 0.38 + intensity * 0.22;
  const obstacleDensity = Math.round(jitter(rng, baseDensity, 0.3, 0.6, 0.1) * 100) / 100;

  return {
    lanes,
    targetScore,
    speed,
    obstacleDensity,
  };
}
