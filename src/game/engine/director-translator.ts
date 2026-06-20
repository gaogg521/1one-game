/**
 * Director Event Translator：把 LLM 输出的语义事件翻译成"运行时修饰符"。
 *
 * runtimeEventImpact.ts 只负责 juice 反馈（粒子 / 横幅 / 字标）。
 * 这里负责 **实际改变玩法**：刷怪密度 / 玩家护盾 / 道具掉率 / 子弹速度 / 得分倍率...
 *
 * Scene 调用方在 startEvent(ev) 时调一次 translateDirectorEvent，
 * 拿到 DirectorModifiers 后把字段应用到 Scene 状态（currentFireDelay / dropRateMul / scoreMult 等）。
 *
 * 设计目标：
 *  - "coinRain" / "goldenPickup" 真的让收集物雨下；不只 banner
 *  - "miniBoss" / "finalBarrage" 真的拔高刷怪密度 + 子弹速度
 *  - "breathingRoom" 真的给玩家一段护盾窗口 + 短暂降低敌人密度
 *  - "comboBonus" 真的让得分翻倍
 *  - "timeAttack" 真的提高弹幕速度
 *  - "goalShift" 同时拉宽火力散弹（视觉与机制都变）
 */

import type { GameSpec } from "@/lib/game-spec";

/** 修饰符（运行时短期生效，由 Scene 自己管理过期时间） */
export type DirectorModifiers = {
  /** 刷怪间隔倍率（< 1 更密，> 1 更稀疏） */
  spawnRateMul: number;
  /** 敌人移动速度倍率 */
  enemySpeedMul: number;
  /** 敌人子弹速度倍率 */
  enemyBulletSpeedMul: number;
  /** 玩家自动开火间隔倍率（< 1 更快） */
  playerFireRateMul: number;
  /** 玩家护盾窗口（ms，立刻应用） */
  shieldGrantMs: number;
  /** 道具掉率倍率（影响 Scene 内 powerup 生成） */
  dropRateMul: number;
  /** 得分倍率（持续 ev.durationMs） */
  scoreMul: number;
  /** 是否立刻生成一波 boss / mini-boss */
  spawnMiniBoss: boolean;
  /** 是否立刻生成一波散弹 / 火力扩散（玩家临时获得 spread） */
  grantSupportWingMs: number;
  /** 是否生成"金币雨"额外收集物 */
  spawnCollectibleBurst: number;
  /** 是否生成"黄金高分物" */
  spawnGoldenWindowMs: number;
  /** 摄像机短暂震动倍率（受 juice 控制，这里给 hint） */
  cameraShakeBoost: number;
};

const ZERO: DirectorModifiers = {
  spawnRateMul: 1,
  enemySpeedMul: 1,
  enemyBulletSpeedMul: 1,
  playerFireRateMul: 1,
  shieldGrantMs: 0,
  dropRateMul: 1,
  scoreMul: 1,
  spawnMiniBoss: false,
  grantSupportWingMs: 0,
  spawnCollectibleBurst: 0,
  spawnGoldenWindowMs: 0,
  cameraShakeBoost: 0,
};

/**
 * 把语义事件翻译成机制修饰符。
 * @param type   director.events[i].type（任意字符串，常用 enum 见 generate-spec prompt）
 * @param strength 0-1
 * @param spec   用于 template 相关的轻微差异化
 */
export function translateDirectorEvent(
  type: string,
  strength: number,
  spec: GameSpec,
): DirectorModifiers {
  const s = Math.max(0, Math.min(1, strength));
  const tpl = spec.templateId;

  switch (type) {
    case "coinRain":
      return {
        ...ZERO,
        scoreMul: 2,
        dropRateMul: 1.6 + s * 0.8,
        spawnCollectibleBurst: tpl === "collector" ? 12 + Math.round(s * 8) : 8,
      };
    case "goldenPickup":
      return {
        ...ZERO,
        scoreMul: 1.5,
        spawnGoldenWindowMs: 4500 + Math.round(s * 2500),
      };
    case "miniBoss":
      return {
        ...ZERO,
        spawnMiniBoss: true,
        spawnRateMul: 1.2,
        enemySpeedMul: 1.05,
        cameraShakeBoost: 0.6,
      };
    case "finalBarrage":
      return {
        ...ZERO,
        spawnRateMul: 0.55, // 间隔更短 = 更密
        enemySpeedMul: 1.18,
        enemyBulletSpeedMul: 1.22 + s * 0.3,
        cameraShakeBoost: 1,
        playerFireRateMul: 0.7, // 玩家也更快火
      };
    case "breathingRoom":
      return {
        ...ZERO,
        spawnRateMul: 1.6, // 间隔变长 = 更稀
        enemySpeedMul: 0.85,
        shieldGrantMs: 3500 + Math.round(s * 2500),
        dropRateMul: 1.4,
      };
    case "comboBonus":
      return {
        ...ZERO,
        scoreMul: 2.5,
        playerFireRateMul: 0.78,
        dropRateMul: 1.25,
      };
    case "timeAttack":
      return {
        ...ZERO,
        spawnRateMul: 0.7,
        enemySpeedMul: 1.18,
        enemyBulletSpeedMul: 1.18,
        scoreMul: 1.6,
      };
    case "goalShift":
      return {
        ...ZERO,
        grantSupportWingMs: 3500 + Math.round(s * 2500),
        playerFireRateMul: 0.78,
        dropRateMul: 1.2,
        scoreMul: 1.3,
      };
    default:
      // 未知类型不改变运行时（但 juice 反馈仍会触发）
      return { ...ZERO };
  }
}
