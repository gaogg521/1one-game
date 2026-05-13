import { z } from "zod";

const RelPointSchema = z.object({
  /** 0..1，按画布宽高归一化 */
  x: z.number().min(0).max(1),
  /** 0..1，按画布宽高归一化 */
  y: z.number().min(0).max(1),
});

const TowerDefenseBlueprintSchema = z.object({
  /** 敌军行进路径（相对坐标） */
  path: z.array(RelPointSchema).min(2).max(24),
  /** 塔位（相对坐标） */
  slots: z.array(RelPointSchema).min(4).max(20),
  /** 敌人类型表 */
  enemies: z
    .array(
      z.object({
        id: z.string().min(1).max(24),
        name: z.string().min(1).max(24),
        hp: z.number().min(8).max(500),
        speed: z.number().min(30).max(320),
        reward: z.number().min(1).max(60),
        armor: z.number().min(0).max(0.9).optional(),
        flying: z.boolean().optional(),
      }),
    )
    .min(2)
    .max(10),
  /** 炮塔类型表 */
  towers: z
    .array(
      z.object({
        id: z.string().min(1).max(24),
        name: z.string().min(1).max(24),
        buildCost: z.number().min(10).max(600),
        /** 每级升级花费（从 2 级起） */
        upgradeCosts: z.array(z.number().min(10).max(900)).max(6).default([]),
        damage: z.number().min(1).max(180),
        cooldownMs: z.number().min(80).max(2400),
        range: z.number().min(60).max(360),
        /** 溅射半径（0 表示无溅射） */
        splashRadius: z.number().min(0).max(180).optional(),
        /** 减速比例 0..0.9（0 表示无减速） */
        slowPct: z.number().min(0).max(0.9).optional(),
        /** 减速持续毫秒 */
        slowMs: z.number().min(0).max(6000).optional(),
      }),
    )
    .min(2)
    .max(8),
  /** 波次配置 */
  waves: z
    .array(
      z.object({
        /** 同一波内的刷怪序列（可组合多种敌人） */
        spawns: z
          .array(
            z.object({
              enemyId: z.string().min(1).max(24),
              count: z.number().min(1).max(80),
              intervalMs: z.number().min(120).max(1800),
            }),
          )
          .min(1)
          .max(5),
        /** 波次开始前延迟（可选） */
        leadInMs: z.number().min(0).max(5000).optional(),
      }),
    )
    .min(4)
    .max(30),
  /** 漏怪对基地造成伤害（可选） */
  leakDamage: z.number().min(1).max(40).optional(),
});

const DirectorSchema = z.object({
  /**
   * 难度曲线 0..1：越高越紧张（影响刷怪密度/速度/波次强度等，由引擎映射）
   */
  intensity: z.number().min(0).max(1),
  /**
   * 关卡段落：每段可定义变奏（如风暴、双倍、重力变化、精英波等）
   */
  acts: z
    .array(
      z.object({
        /** 0..1 时间位置 */
        at: z.number().min(0).max(1),
        /** 段落名（用于 HUD 提示） */
        label: z.string().min(1).max(24),
        /** 变奏标签，由各模板映射 */
        modifiers: z.array(z.string().min(1).max(24)).max(6).default([]),
      }),
    )
    .min(1)
    .max(8),
  /**
   * 关键事件（可选）：如 miniBoss、金币雨、屏幕扰动等
   */
  events: z
    .array(
      z.object({
        at: z.number().min(0).max(1),
        /** 事件类型：运行时识别并映射成玩法（允许自定义字符串以便后续扩展） */
        type: z.string().min(1).max(24),
        strength: z.number().min(0).max(1).optional(),
        /** 持续时间（毫秒）。未提供则运行时使用默认值。 */
        durationMs: z.number().min(0).max(30000).optional(),
        /** 展示标题（可选） */
        title: z.string().min(1).max(32).optional(),
        /** 展示副标题（可选） */
        message: z.string().min(1).max(80).optional(),
      }),
    )
    .max(16)
    .optional(),
});

const SystemsSchema = z.object({
  /** 主动技能（按键触发） */
  skill: z
    .object({
      id: z.string().min(1).max(24),
      name: z.string().min(1).max(24),
      /** 建议 3000~20000 */
      cooldownMs: z.number().min(1500).max(30000),
      /** 技能效果标识，由运行时映射 */
      effect: z.enum(["shield", "bomb", "dash", "timeSlow"]),
      /** 0..1 强度 */
      strength: z.number().min(0).max(1).optional(),
      /** 持续时间（若技能是持续型） */
      durationMs: z.number().min(0).max(20000).optional(),
    })
    .optional(),
  /** 拾取道具池（运行时会按节奏刷出） */
  powerups: z
    .array(
      z.object({
        id: z.string().min(1).max(24),
        name: z.string().min(1).max(24),
        type: z.enum(["shield", "magnet", "doubleScore", "heal", "timeSlow"]),
        durationMs: z.number().min(800).max(25000).optional(),
        strength: z.number().min(0).max(1).optional(),
      }),
    )
    .max(10)
    .optional(),
});

export const GameSpecSchema = z.object({
  version: z.literal(1),
  templateId: z.enum(["avoider", "collector", "survivor", "platformer", "towerDefense"]),
  title: z.string().min(1).max(80),
  theme: z.object({
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    playerColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    hazardColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    collectibleColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    particleTint: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  }),
  gameplay: z.object({
    playerSpeed: z.number().min(120).max(520),
    hazardSpeed: z.number().min(80).max(520),
    spawnIntervalMs: z.number().min(280).max(2200),
    winScore: z.number().min(5).max(200).optional(),
    lives: z.number().min(1).max(9).optional(),
    arenaPadding: z.number().min(16).max(80).optional(),
    /** platformer：跳跃初速度（像素/秒量级，由引擎映射） */
    jumpStrength: z.number().min(280).max(720).optional(),
    /** platformer：重力强度 */
    gravity: z.number().min(400).max(1400).optional(),
    /** towerDefense：开局金币 */
    startingCoins: z.number().min(40).max(400).optional(),
    /** towerDefense：基地生命（与 avoider 的 lives 语义不同，仅塔防使用） */
    baseHealth: z.number().min(15).max(120).optional(),
  }),
  labels: z.object({
    player: z.string().max(32),
    hazard: z.string().max(32),
    collectible: z.string().max(32).optional(),
    subtitle: z.string().max(120).optional(),
  }),
  /** towerDefense 复杂蓝图（可选；缺省则由引擎侧生成默认关卡） */
  towerDefense: TowerDefenseBlueprintSchema.optional(),
  /** 通用导演蓝图（可选；缺省则由引擎侧使用默认曲线） */
  director: DirectorSchema.optional(),
  /** 通用系统层（可选；缺省则由引擎侧补齐） */
  systems: SystemsSchema.optional(),
});

export type GameSpec = z.infer<typeof GameSpecSchema>;

export function parseGameSpec(raw: unknown): GameSpec {
  return GameSpecSchema.parse(raw);
}
