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

/** 确定性伪随机 0..1 */
function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

type RelPoint = { x: number; y: number };

export type TowerDefenseBlueprint = NonNullable<GameSpec["towerDefense"]>;

export function buildTowerDefenseBlueprint(params: {
  prompt: string;
  spec: GameSpec;
}): TowerDefenseBlueprint {
  const clean = `${params.prompt}\n${params.spec.title}`.trim();
  const seed = hashString(clean);
  const p = params.prompt.toLowerCase();

  const isCute = /猫|狗|萌|可爱|kitten|cute|moe|chibi/.test(p);
  const isPixel = /像素|pixel|8-bit|8bit/.test(p);
  const isCyber = /赛博|霓虹|cyber|neon/.test(p);
  const isForest = /森林|蘑菇|精灵|树|藤蔓/.test(params.prompt);
  const isOcean = /海|洋|珊瑚|章鱼|潜水|鱼/.test(params.prompt);
  const isSpace = /太空|宇宙|星|陨石|飞船|银河/.test(params.prompt);

  const path: RelPoint[] = [
    { x: 0.07, y: 0.60 },
    { x: 0.26, y: 0.60 },
    { x: 0.26, y: 0.34 },
    { x: 0.53, y: 0.34 },
    { x: 0.53, y: 0.74 },
    { x: 0.78, y: 0.74 },
    { x: 0.78, y: 0.44 },
    { x: 0.93, y: 0.44 },
  ];

  // 塔位：沿路径段中点偏移并抖动，保证 1 句话也能生成“可玩的布局”
  const slots: RelPoint[] = [];
  const baseSlots = 10;
  for (let i = 0; i < baseSlots; i += 1) {
    const seg = i % (path.length - 1);
    const a = path[seg];
    const b = path[seg + 1];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const flip = seg % 2 === 0 ? 1 : -1;
    const off = 0.09 + rnd(seed, i + 11) * 0.03;
    const ox = (-dy / len) * off * flip;
    const oy = (dx / len) * off * flip;
    const jx = (rnd(seed, i + 31) - 0.5) * 0.025;
    const jy = (rnd(seed, i + 51) - 0.5) * 0.025;
    slots.push({
      x: clamp(mx + ox + jx, 0.06, 0.94),
      y: clamp(my + oy + jy, 0.18, 0.92),
    });
  }

  const coinWord = params.spec.labels.collectible ?? "金币";

  const enemyNameA = isOcean
    ? "潮虫"
    : isForest
      ? "树精"
      : isSpace
        ? "陨石兽"
        : isCyber
          ? "入侵程序"
          : isCute
            ? "捣蛋鼠"
            : "杂兵";

  const enemyNameB = isOcean
    ? "泡泡鲸"
    : isForest
      ? "荆棘傀儡"
      : isSpace
        ? "彗核"
        : isCyber
          ? "装甲无人机"
          : isCute
            ? "毛球怪"
            : "装甲怪";

  const enemyNameC = isOcean
    ? "墨喷者"
    : isForest
      ? "毒孢子"
      : isSpace
        ? "相位幽影"
        : isCyber
          ? "隐身协议"
          : isCute
            ? "小幽灵"
            : "刺客";

  const baseSpeed = clamp(62 + params.spec.gameplay.hazardSpeed * 0.22, 70, 190);
  const enemies: TowerDefenseBlueprint["enemies"] = [
    {
      id: "grunt",
      name: enemyNameA,
      hp: 22,
      speed: baseSpeed,
      reward: 8,
    },
    {
      id: "tank",
      name: enemyNameB,
      hp: 58,
      speed: clamp(baseSpeed * 0.78, 55, 150),
      reward: 14,
      armor: 0.18,
    },
    {
      id: "runner",
      name: enemyNameC,
      hp: 32,
      speed: clamp(baseSpeed * 1.18, 85, 240),
      reward: 12,
    },
  ];

  const towers: TowerDefenseBlueprint["towers"] = [
    {
      id: "dart",
      name: isPixel ? "像素连弩" : isCyber ? "脉冲炮" : "箭塔",
      buildCost: 52,
      upgradeCosts: [58, 74, 96],
      damage: 11,
      cooldownMs: 520,
      range: 140,
    },
    {
      id: "splash",
      name: isOcean ? "潮汐炮" : isForest ? "孢子炮" : isCyber ? "等离子榴弹" : "炸弹塔",
      buildCost: 78,
      upgradeCosts: [86, 110, 140],
      damage: 22,
      cooldownMs: 980,
      range: 128,
      splashRadius: 72,
    },
    {
      id: "frost",
      name: isSpace ? "引力场" : isCyber ? "减速协议" : "寒霜塔",
      buildCost: 64,
      upgradeCosts: [70, 92, 118],
      damage: 7,
      cooldownMs: 720,
      range: 136,
      slowPct: 0.35,
      slowMs: 900,
    },
  ];

  const wantLong = /长线|多波|硬核|挑战|kingdom|rush|rogue|肉鸽|章节|关卡/.test(p);
  const wavesN = clamp(params.spec.gameplay.winScore ?? (wantLong ? 10 : 8), 6, 12);
  const baseInterval = clamp(Math.floor(params.spec.gameplay.spawnIntervalMs * 0.55), 180, 720);

  const waves: TowerDefenseBlueprint["waves"] = [];
  for (let w = 0; w < wavesN; w += 1) {
    const leadInMs = w === 0 ? 650 : 1200;
    const ramp = 1 + w * 0.18;
    const aCount = clamp(Math.round((4 + w) * ramp), 4, 34);
    const hasRunner = w >= 2;
    const hasTank = w >= 3;
    const tankCount = hasTank ? clamp(Math.round((1 + w * 0.55) * (1 + rnd(seed, w + 7) * 0.25)), 1, 18) : 0;
    const runnerCount = hasRunner ? clamp(Math.round((2 + w * 0.65) * (1 + rnd(seed, w + 17) * 0.25)), 2, 24) : 0;

    const spawns: TowerDefenseBlueprint["waves"][number]["spawns"] = [];
    spawns.push({
      enemyId: "grunt",
      count: aCount,
      intervalMs: clamp(Math.round(baseInterval * (1 - w * 0.04)), 140, 900),
    });
    if (hasRunner) {
      spawns.push({
        enemyId: "runner",
        count: runnerCount,
        intervalMs: clamp(Math.round(baseInterval * 0.85), 140, 900),
      });
    }
    if (hasTank) {
      spawns.push({
        enemyId: "tank",
        count: tankCount,
        intervalMs: clamp(Math.round(baseInterval * 1.05), 160, 1000),
      });
    }

    waves.push({ spawns, leadInMs });
  }

  const leakDamage = pick([10, 11, 12, 13], seed, 99);

  // 文字提示里给“经济”一个更像成品的感觉：通过起始金币、基地血量再兜底
  // 这些字段仍沿用 gameplay 的 startingCoins/baseHealth，以便 UI 展示一致
  void coinWord;

  return {
    path,
    slots,
    enemies,
    towers,
    waves,
    leakDamage,
  };
}

