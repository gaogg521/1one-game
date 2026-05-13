import type { GameSpec } from "@/lib/game-spec";

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number, i: number): T {
  return arr[(seed + i * 17) % arr.length];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export type Systems = NonNullable<GameSpec["systems"]>;

export function buildSystems(params: { prompt: string; spec: GameSpec }): Systems {
  const p = params.prompt.toLowerCase();
  const seed = hashString(`${params.prompt}\n${params.spec.title}\n${params.spec.templateId}`);
  const hard = /硬核|高难|地狱|弹幕|挑战|boss|rush|hardcore/.test(p);
  const cozy = /轻松|治愈|休闲|cozy|casual/.test(p);
  const cyber = /赛博|霓虹|cyber|neon/.test(p);
  const fantasy = /魔法|巫师|龙|精灵|神殿|符文/.test(params.prompt);
  const cute = /猫|狗|萌|可爱|kitten|cute|moe|chibi/.test(p);

  const skillEffect = hard
    ? pick(["shield", "timeSlow", "bomb"] as const, seed, 2)
    : cozy
      ? pick(["shield", "dash"] as const, seed, 2)
      : pick(["dash", "timeSlow", "shield", "bomb"] as const, seed, 2);

  const skillName =
    skillEffect === "shield"
      ? cyber
        ? "护盾协议"
        : fantasy
          ? "圣盾"
          : cute
            ? "泡泡盾"
            : "护盾"
      : skillEffect === "bomb"
        ? cyber
          ? "清除指令"
          : fantasy
            ? "爆裂符文"
            : cute
              ? "喵喵炸弹"
              : "爆破"
        : skillEffect === "dash"
          ? cyber
            ? "闪跃"
            : fantasy
              ? "瞬步"
              : cute
                ? "冲冲冲"
                : "冲刺"
          : cyber
            ? "降速场"
            : fantasy
              ? "时停"
              : "时间减速";

  const skillCd = hard ? 9000 : cozy ? 6500 : 7500;
  const skill: Systems["skill"] = {
    id: "skill",
    name: skillName,
    cooldownMs: clamp(skillCd + (seed % 1500), 3500, 20000),
    effect: skillEffect,
    strength: hard ? 0.85 : cozy ? 0.6 : 0.72,
    durationMs: skillEffect === "shield" ? 2200 : skillEffect === "timeSlow" ? 2200 : 0,
  };

  const powerups: NonNullable<Systems["powerups"]> = [
    {
      id: "shield",
      name: cyber ? "一次性护盾" : fantasy ? "护符" : cute ? "泡泡" : "护盾",
      type: "shield",
      durationMs: 2200,
      strength: 0.8,
    },
    {
      id: "slow",
      name: cyber ? "降速补丁" : fantasy ? "缓速咒" : "时间泡",
      type: "timeSlow",
      durationMs: 2600,
      strength: 0.45,
    },
    {
      id: "double",
      name: cyber ? "双倍积分" : fantasy ? "幸运祝福" : cute ? "加倍小鱼干" : "双倍得分",
      type: "doubleScore",
      durationMs: 5200,
      strength: 1,
    },
  ];

  // 平台/塔防不一定需要磁铁，但收集类会更爽
  if (params.spec.templateId === "collector" || /收集|coin|gem|宝石|金币/.test(p)) {
    powerups.push({
      id: "magnet",
      name: cyber ? "吸附场" : fantasy ? "引力符" : cute ? "小磁铁" : "磁铁",
      type: "magnet",
      durationMs: 5200,
      strength: 0.75,
    });
  }

  // 生存/平台更偏“回血”
  if (params.spec.templateId === "survivor" || params.spec.templateId === "platformer") {
    powerups.push({
      id: "heal",
      name: cyber ? "修复包" : fantasy ? "治疗药水" : cute ? "小饼干" : "回复",
      type: "heal",
      strength: 0.35,
    });
  }

  return { skill, powerups };
}

