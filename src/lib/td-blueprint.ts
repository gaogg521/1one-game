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

  // 4 path templates — chosen by seed so same prompt always gets same layout
  const PATH_TEMPLATES: RelPoint[][] = [
    // A: classic Z/S turn
    [
      { x: 0.07, y: 0.60 }, { x: 0.26, y: 0.60 }, { x: 0.26, y: 0.34 },
      { x: 0.53, y: 0.34 }, { x: 0.53, y: 0.74 }, { x: 0.78, y: 0.74 },
      { x: 0.78, y: 0.44 }, { x: 0.93, y: 0.44 },
    ],
    // B: double-U (more turns, harder to cover)
    [
      { x: 0.07, y: 0.30 }, { x: 0.07, y: 0.70 }, { x: 0.35, y: 0.70 },
      { x: 0.35, y: 0.30 }, { x: 0.62, y: 0.30 }, { x: 0.62, y: 0.70 },
      { x: 0.93, y: 0.70 },
    ],
    // C: wide spiral — long exposure, good for slow/splash towers
    [
      { x: 0.07, y: 0.50 }, { x: 0.25, y: 0.50 }, { x: 0.25, y: 0.22 },
      { x: 0.75, y: 0.22 }, { x: 0.75, y: 0.78 }, { x: 0.40, y: 0.78 },
      { x: 0.40, y: 0.50 }, { x: 0.93, y: 0.50 },
    ],
    // D: wave/diagonal feel
    [
      { x: 0.07, y: 0.38 }, { x: 0.28, y: 0.38 }, { x: 0.28, y: 0.68 },
      { x: 0.50, y: 0.68 }, { x: 0.50, y: 0.38 }, { x: 0.72, y: 0.38 },
      { x: 0.72, y: 0.68 }, { x: 0.93, y: 0.68 },
    ],
  ];
  const path: RelPoint[] = PATH_TEMPLATES[seed % PATH_TEMPLATES.length]!;

  // 塔位：每段路径各取1-2个位置，确保覆盖全程且间距充足
  const rawSlots: RelPoint[] = [];
  const segs = path.length - 1;
  // Generate 2 candidate slots per segment (both sides of path)
  for (let seg = 0; seg < segs; seg += 1) {
    const a = path[seg]!;
    const b = path[seg + 1]!;
    for (let side = 0; side < 2; side += 1) {
      const t = 0.35 + rnd(seed, seg * 7 + side * 3 + 1) * 0.3; // position along segment
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const flip = side === 0 ? 1 : -1;
      const off = 0.085 + rnd(seed, seg * 11 + side * 5 + 2) * 0.025;
      const ox = (-dy / len) * off * flip;
      const oy = (dx / len) * off * flip;
      rawSlots.push({
        x: clamp(px + ox, 0.06, 0.94),
        y: clamp(py + oy, 0.16, 0.90),
      });
    }
  }

  // Filter: keep slots with minimum relative distance of 0.13 between each other
  const slots: RelPoint[] = [];
  const minDist = 0.13;
  for (const s of rawSlots) {
    if (slots.every(f => Math.hypot(s.x - f.x, s.y - f.y) >= minDist)) {
      slots.push(s);
      if (slots.length >= 10) break;
    }
  }
  // Guarantee at least 6 slots by relaxing constraint if needed
  if (slots.length < 6) {
    for (const s of rawSlots) {
      if (slots.every(f => Math.hypot(s.x - f.x, s.y - f.y) >= 0.08) && !slots.includes(s)) {
        slots.push(s);
        if (slots.length >= 8) break;
      }
    }
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
    const rushWave = w > 0 && (w + 1) % 4 === 0;
    const eliteWave = w >= 2 && (w + 1) % 3 === 0;
    const aCount = clamp(Math.round((rushWave ? 6 + w : 4 + w) * ramp), 4, 34);
    const hasRunner = w >= 2;
    const hasTank = w >= 3;
    const tankCount = hasTank ? clamp(Math.round((1 + w * 0.55 + (eliteWave ? 1 : 0)) * (1 + rnd(seed, w + 7) * 0.25)), 1, 18) : 0;
    const runnerCount = hasRunner ? clamp(Math.round((2 + w * 0.65 + (rushWave ? 2 : 0)) * (1 + rnd(seed, w + 17) * 0.25)), 2, 24) : 0;

    const spawns: TowerDefenseBlueprint["waves"][number]["spawns"] = [];
    spawns.push({
      enemyId: "grunt",
      count: aCount,
      intervalMs: clamp(Math.round(baseInterval * (rushWave ? 0.72 : 1 - w * 0.04)), 140, 900),
    });
    if (hasRunner) {
      spawns.push({
        enemyId: "runner",
        count: runnerCount,
        intervalMs: clamp(Math.round(baseInterval * (rushWave ? 0.68 : 0.85)), 140, 900),
      });
    }
    if (hasTank) {
      spawns.push({
        enemyId: "tank",
        count: tankCount,
        intervalMs: clamp(Math.round(baseInterval * (eliteWave ? 0.94 : 1.05)), 160, 1000),
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

