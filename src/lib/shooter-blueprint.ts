import type { GameSpec } from "@/lib/game-spec";

/**
 * ShooterBlueprint：射击 / 飞机大战 / 弹幕的关卡级设计 DSL。
 *
 * 让 LLM 真正参与射击关卡设计：编队脚本 + 弹幕图样 + 武器升级树 + Boss 阶段，
 * 而不是停留在"playerSpeed/hazardSpeed/spawnIntervalMs"这三个钢琴键上。
 *
 * 数据流：
 *   1. LLM 输出 GameSpec → 服务端 finalizeSpec 检测 templateId === "shooter" 且 !spec.shooter 时调用 buildShooterBlueprint 补齐
 *   2. ShooterScene 优先读 spec.shooter（如有）来驱动 WaveSpawner / WeaponTree / BossPhase
 *   3. 若 LLM 输出了完整的 spec.shooter，则跳过兜底构造，保留 LLM 设计
 *
 * 这套 blueprint 不会替代现有 `director.events`（director 是关卡节奏，blueprint 是机制细节），两者协同。
 */

export type ShooterFormationPattern =
  | "v-formation" // V 字编队，三五架机一起入场
  | "side-swoop" // 从两侧扫向中央
  | "circle-swarm" // 圆形蜂群（弹幕风格）
  | "wave-grid" // 横向网格波（小蜜蜂）
  | "diagonal-strafe" // 对角线扫射
  | "tail-chase" // 长蛇阵
  | "burst-spawn" // 集中刷出一团
  | "boss-arena"; // boss 战场（仅 boss 用）

export type ShooterBulletPattern =
  | "single" // 单发瞄准
  | "spread-3" // 3 连散弹
  | "spread-5" // 5 连散弹
  | "fan-7" // 7 路扇形
  | "spiral" // 螺旋弹幕
  | "ring" // 圆环弹幕
  | "shotgun" // 霰弹喷射
  | "aimed-volley" // 瞄准齐射
  | "laser-beam"; // 持续激光

export type ShooterDropKind =
  | "spread-shot" // 散弹道具
  | "laser-beam" // 激光道具
  | "shield" // 护盾
  | "bomb" // 屏幕炸弹
  | "wingman" // 僚机
  | "heal" // 回血
  | "score-mult"; // 双倍得分

export type ShooterBossPhase = {
  /** 0..1 HP 阈值（≤ 该比例时进入此阶段） */
  hpThreshold: number;
  /** 阶段名（HUD 显示） */
  label: string;
  /** 该阶段开火图案 */
  bullet: ShooterBulletPattern;
  /** 该阶段移动方式 */
  motion: "horizontal-swing" | "figure-eight" | "spiral-down" | "teleport-burst" | "still-rage";
  /** 强度倍率 0.5..2 */
  intensity: number;
};

export type ShooterWave = {
  /** 该波在关卡时间线 0..1 上的触发点（与 director events at 对齐） */
  at: number;
  /** 编队脚本 */
  pattern: ShooterFormationPattern;
  /** 该波敌人总数 */
  count: number;
  /** 敌人 HP 倍率（普通=1） */
  hpMul: number;
  /** 敌人速度倍率 */
  speedMul: number;
  /** 敌人开火图样 */
  bullet: ShooterBulletPattern;
  /** 是否精英（替代普通敌人贴图）*/
  elite?: boolean;
  /** 该波横幅副标题（可选，不填用模板默认） */
  banner?: string;
};

export type ShooterBlueprint = {
  /** 4-8 波关卡脚本 */
  waves: ShooterWave[];
  /** 道具掉落池（出现在 director.events 的 coinRain / breathingRoom 等窗口） */
  drops: ShooterDropKind[];
  /** Boss 战阶段（关卡末尾） */
  boss: {
    label: string;
    phases: ShooterBossPhase[];
    /** Boss HP（按 wave 数自动放大） */
    baseHp: number;
  };
  /** 玩家初始武器（默认炮 = single）*/
  startingWeapon: ShooterBulletPattern;
  /** 武器升级树（按拾取道具次数解锁，索引 = 拾取计数） */
  weaponTree: ShooterBulletPattern[];
};

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
function pick<T>(arr: readonly T[], seed: number, i: number): T {
  return arr[(seed + i * 17) % arr.length]!;
}

/**
 * 兜底构造 ShooterBlueprint：当 LLM 没输出 spec.shooter 时调用。
 * 关键词驱动：弹幕 / 太空 / 武侠 / 机甲 / 萌系 各出不同节奏。
 */
export function buildShooterBlueprint(params: { prompt: string; spec: GameSpec }): ShooterBlueprint {
  const clean = `${params.prompt}\n${params.spec.title}`.trim();
  const seed = hashStr(clean);
  const p = params.prompt.toLowerCase();

  const isBulletHell = /弹幕|bullet[\s-]?hell|东方|touhou|barrage/.test(p);
  const isWuxia = /武侠|剑|江湖|wuxia|仙侠|水墨/.test(p);
  const isHardSciFi = /太空|宇宙|星际|战舰|space|galaxy|spaceship|starfighter|sci-?fi/.test(p);
  const isKawaii = /萌|可爱|cute|kawaii|chibi|喵|猫/.test(p);
  const isMecha = /机甲|高达|gundam|mecha|robot/.test(p);

  const intensity = params.spec.director?.intensity ?? 0.6;
  const winScore = params.spec.gameplay.winScore ?? 50;

  /** 6 波关卡脚本：侦察 → 编队 → 中盘 → 精锐 → 突破 → 终局决战 */
  const waves: ShooterWave[] = [
    // Wave 1: 侦察小队（热身）
    {
      at: 0.06,
      pattern: "wave-grid",
      count: 5,
      hpMul: 0.9,
      speedMul: 0.9,
      bullet: "single",
    },
    // Wave 2: 编队入侵（加速）
    {
      at: 0.25,
      pattern: pick(["v-formation", "side-swoop"] as const, seed, 1),
      count: 7,
      hpMul: 1.05,
      speedMul: 1.1,
      bullet: pick(["single", "aimed-volley"] as const, seed, 2),
    },
    // Wave 3: 中盘压迫
    {
      at: 0.42,
      pattern: pick(["diagonal-strafe", "burst-spawn", "side-swoop"] as const, seed, 3),
      count: 9,
      hpMul: 1.15,
      speedMul: 1.2,
      bullet: pick(["aimed-volley", "spread-3"] as const, seed, 4),
    },
    // Wave 4: 精锐突袭
    {
      at: 0.60,
      pattern: isBulletHell
        ? "circle-swarm"
        : pick(["tail-chase", "diagonal-strafe", "burst-spawn"] as const, seed, 5),
      count: 10,
      hpMul: 1.3,
      speedMul: 1.3,
      bullet: pick(["spread-5", "fan-7"] as const, seed, 6),
      elite: true,
    },
    // Wave 5: 突破前哨（密集但短促）
    {
      at: 0.76,
      pattern: isBulletHell ? "burst-spawn" : pick(["wave-grid", "circle-swarm"] as const, seed, 7),
      count: 12,
      hpMul: 1.2,
      speedMul: 1.4,
      bullet: isBulletHell
        ? "fan-7"
        : pick(["spread-3", "shotgun"] as const, seed, 8),
      elite: true,
      banner: isBulletHell ? "弹幕强化" : "精锐前哨",
    },
    // Wave 6: Boss 决战
    {
      at: 0.88,
      pattern: "boss-arena",
      count: 1,
      hpMul: 1,
      speedMul: 1,
      bullet: "spiral",
      banner: isBulletHell ? "终幕弹幕" : "最终决战",
    },
  ];

  // 道具池 - 按主题挑
  const drops: ShooterDropKind[] = ["spread-shot", "shield", "bomb"];
  if (isBulletHell || isHardSciFi || isMecha) drops.push("laser-beam");
  if (intensity > 0.55) drops.push("wingman");
  if (intensity < 0.5 || isKawaii) drops.push("heal");
  drops.push("score-mult");

  // Boss 阶段：3 段
  const bossBaseHp = Math.round(40 + intensity * 60 + winScore * 0.6);
  const bossPhases: ShooterBossPhase[] = isBulletHell
    ? [
        { hpThreshold: 1, label: "Phase 1: Ring", bullet: "ring", motion: "horizontal-swing", intensity: 0.85 },
        { hpThreshold: 0.66, label: "Phase 2: Spiral", bullet: "spiral", motion: "figure-eight", intensity: 1 },
        { hpThreshold: 0.33, label: "Phase 3: Fan Storm", bullet: "fan-7", motion: "teleport-burst", intensity: 1.4 },
      ]
    : isWuxia
      ? [
          { hpThreshold: 1, label: "起手：剑气", bullet: "aimed-volley", motion: "horizontal-swing", intensity: 0.8 },
          { hpThreshold: 0.6, label: "中盘：剑雨", bullet: "fan-7", motion: "figure-eight", intensity: 1.1 },
          { hpThreshold: 0.3, label: "终招：万剑归宗", bullet: "spiral", motion: "still-rage", intensity: 1.5 },
        ]
      : isKawaii
        ? [
            { hpThreshold: 1, label: "Phase 1", bullet: "spread-3", motion: "horizontal-swing", intensity: 0.7 },
            { hpThreshold: 0.5, label: "Phase 2 · 怒气", bullet: "shotgun", motion: "figure-eight", intensity: 1.0 },
            { hpThreshold: 0.25, label: "Phase 3 · 爆发", bullet: "ring", motion: "still-rage", intensity: 1.3 },
          ]
        : [
            { hpThreshold: 1, label: "Phase 1: Volley", bullet: "aimed-volley", motion: "horizontal-swing", intensity: 0.85 },
            { hpThreshold: 0.66, label: "Phase 2: Shotgun", bullet: "shotgun", motion: "figure-eight", intensity: 1.05 },
            { hpThreshold: 0.33, label: "Phase 3: Beam", bullet: "laser-beam", motion: "still-rage", intensity: 1.4 },
          ];

  // 武器升级树（拾取 spread-shot/laser-beam 触发升级）
  const weaponTree: ShooterBulletPattern[] = isBulletHell
    ? ["single", "spread-3", "spread-5", "fan-7"]
    : isHardSciFi || isMecha
      ? ["single", "spread-3", "laser-beam", "fan-7"]
      : ["single", "spread-3", "spread-5", "shotgun"];

  return {
    waves,
    drops,
    boss: {
      label: isBulletHell ? "终幕弹幕王" : isWuxia ? "邪宗宗主" : isKawaii ? "Boss 猫王" : "母舰",
      phases: bossPhases,
      baseHp: bossBaseHp,
    },
    startingWeapon: "single",
    weaponTree,
  };
}
