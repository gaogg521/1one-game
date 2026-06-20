import type { GameSpec } from "@/lib/game-spec";

/** 恐怖监控蓝图：与 HorrorBlueprintSchema 对齐 */
export type HorrorBlueprint = {
  /** 夜晚数（每夜一段时长，撑过即进下一夜） */
  nights: number;
  /** 摄像头数量（玩家可切换查看的视图数） */
  cameras: number;
  /** 怪物生成间隔（毫秒） */
  monsterSpawnIntervalMs: number;
  /** 关门冷却（毫秒）：玩家关门动作后需冷却才能再关 */
  doorCooldownMs: number;
  /** 电力上限：关门与切摄像头均消耗，归零判负 */
  powerMax: number;
};

/** 从 prompt / spec 推断怪物生成节奏（强度越高越频繁） */
function inferMonsterSpawnInterval(opts: {
  prompt?: string;
  spec?: GameSpec;
}): number {
  const intensity = opts.spec?.director?.intensity ?? 0.6;
  const blob = (opts.prompt ?? opts.spec?.title ?? "").toLowerCase();
  // 关键词偏好：极限/无情类描述 → 更快生成
  const extreme = /极限|无情|地狱|insane|extreme|nightmare|噩梦|hardcore/.test(blob);
  const base = extreme ? 6000 : 7500;
  // intensity 0..1 → interval 9000..6000（强度高→间隔短）
  const interval = base - (intensity - 0.5) * 3000;
  return Math.round(clamp(interval, 6000, 9000));
}

/** 从 prompt / spec 推断门冷却（强度越高门冷却越长，限制玩家滥用） */
function inferDoorCooldown(opts: {
  prompt?: string;
  spec?: GameSpec;
}): number {
  const intensity = opts.spec?.director?.intensity ?? 0.6;
  const base = 4000;
  const cd = base + (intensity - 0.5) * 1500;
  return Math.round(clamp(cd, 3000, 5000));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function buildHorrorBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
}): HorrorBlueprint {
  // 若 spec 已显式给出 horror 蓝图，优先沿用（保持 LLM/系统已确定的参数）
  const existing = opts.spec?.horror;
  const nights = existing?.nights ?? 3;
  const cameras = existing?.cameras ?? 4;
  const monsterSpawnIntervalMs =
    existing?.monsterSpawnIntervalMs ?? inferMonsterSpawnInterval(opts);
  const doorCooldownMs =
    existing?.doorCooldownMs ?? inferDoorCooldown(opts);
  const powerMax = existing?.powerMax ?? 100;

  return {
    nights,
    cameras,
    monsterSpawnIntervalMs,
    doorCooldownMs,
    powerMax,
  };
}
