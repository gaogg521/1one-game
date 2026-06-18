import { z } from "zod";
import { GAME_TEMPLATE_IDS } from "@/lib/game-templates/registry";
import { SamplePlayProfileSchema } from "@/lib/sample-play-profiles/types";

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

const CoasterPathPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const CoasterBlueprintSchema = z.object({
  mode: z.enum(["coaster", "endlessRoad"]).optional(),
  path: z.array(CoasterPathPointSchema).min(8).max(128),
  targetTimeSec: z.number().min(20).max(999).optional(),
  cameraDistance: z.number().min(4).max(16).optional(),
  distanceGoal: z.number().min(100).max(5000).optional(),
});

const CustomizationBlueprintSchema = z.object({
  mode: z.enum(["carPaint", "pottery"]),
  editGoal: z.number().min(3).max(12),
});

const PuzzleBlueprintSchema = z.object({
  mode: z.enum(["match3", "spotDifference", "memoryMatch", "jigsaw", "merge2048"]),
  matchMechanic: z.enum(["flood", "swap"]).optional(),
  cols: z.number().min(2).max(12),
  rows: z.number().min(2).max(12),
  targetScore: z.number().min(1).max(4096),
  moveLimit: z.number().min(1).max(999),
  levelCount: z.number().min(1).max(30).optional(),
  objectives: z
    .array(
      z.object({
        id: z.string().min(1).max(24),
        label: z.string().min(1).max(32),
        type: z.enum(["score", "collectColor", "clearObstacle", "combo"]),
        target: z.number().min(1).max(4096),
      }),
    )
    .max(8)
    .optional(),
  boosters: z
    .array(
      z.object({
        id: z.string().min(1).max(24),
        name: z.string().min(1).max(24),
        effect: z.enum(["rowClear", "colClear", "bomb", "rainbow", "shuffle", "extraMoves"]),
        unlockLevel: z.number().min(1).max(30).optional(),
      }),
    )
    .max(8)
    .optional(),
  specialTiles: z.array(z.enum(["rowClear", "colClear", "bomb", "rainbow"])).max(8).optional(),
});

const ChessBlueprintSchema = z.object({
  ruleset: z.enum(["international", "xiangqi", "go", "jungle"]),
  boardCols: z.number().min(7).max(19),
  boardRows: z.number().min(8).max(19),
  pieceSet: z.array(z.string().min(1).max(16)).min(2).max(32),
  aiDepth: z.number().min(0).max(4),
  showLegalMoves: z.boolean().optional(),
  checkHint: z.boolean().optional(),
});

const PlatformerBlueprintSchema = z.object({
  mode: z.enum(["standard", "stealth"]),
  doubleJump: z.boolean().optional(),
  grappleEnabled: z.boolean().optional(),
  levelLayers: z.number().min(32).max(96).optional(),
  worldWidth: z.number().min(3600).max(9000).optional(),
  suggestedWinScore: z.number().min(24).max(120).optional(),
});

const FarmingBlueprintSchema = z.object({
  cols: z.number().min(3).max(8),
  rows: z.number().min(3).max(8),
  startingCoins: z.number().min(10).max(500),
  harvestGoal: z.number().min(3).max(50),
  crops: z
    .array(
      z.object({
        id: z.string().min(1).max(24),
        name: z.string().min(1).max(24),
        growSec: z.number().min(2).max(30),
        seedCost: z.number().min(1).max(100),
        sellPrice: z.number().min(2).max(200),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    )
    .min(1)
    .max(6),
});

const StrategyNodeSchema = z.object({
  id: z.string().min(1).max(24),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  owner: z.enum(["player", "ai", "neutral"]),
  troops: z.number().min(1).max(200),
  links: z.array(z.string().min(1).max(24)).min(1).max(8),
});

const StrategyBlueprintSchema = z.object({
  winNodes: z.number().min(2).max(10),
  nodes: z.array(StrategyNodeSchema).min(3).max(12),
});

const AgenticModuleSchema = z.object({
  version: z.literal(1),
  /** 受限 TS/JS 模块源码（由 Agentic Gameplay Agent 生成） */
  source: z.string().min(8).max(48_000),
  entry: z.string().min(1).max(32).default("createGame"),
});

export const DirectorSchema = z.object({
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

export const SystemsSchema = z.object({
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
  templateId: z.enum(GAME_TEMPLATE_IDS),
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
  /** 试听体验层：可选音频气质（省略时由系统从 theme 推断） */
  presentation: z
    .object({
      musicProfile: z.enum(["organic", "pulse", "minimal", "neon"]).optional(),
      /** 运行时表现档：用户新建默认 standard；样品/精选可升 showcase；CI/低端环境可降 minimal。 */
      qualityTier: z.enum(["minimal", "standard", "showcase"]).optional(),
      /**
       * 模板内艺术风格枚举。由 LLM 输出 → 运行时挑选对应程序化绘制皮肤。
       * 跨模板通用（不是每个模板都支持所有风格，运行时挑最接近的）：
       * - classic-arcade：80-90s 复古街机像素感（飞机大战 / 弹幕首选）
       * - hard-sci-fi：硬科幻金属光泽（太空 / 战舰）
       * - kawaii-mecha：可爱机甲 / 萌系射击
       * - bullet-hell：高密度弹幕、霓虹冷暖
       * - wuxia-flight：中国风 / 水墨写意飞行
       * - blocky-pixel：方块像素（Minecraft 风）
       * - cute-cartoon：可爱卡通圆角
       * - dark-fantasy：暗黑奇幻 / 哥特
       * - 80s-cartoon：80 年代手绘卡通
       * - nature-organic：自然有机 / 田园
       * - neon-cyber：赛博霓虹
       * - paper-craft：纸艺折纸
       */
      assetStyle: z
        .enum([
          "classic-arcade",
          "hard-sci-fi",
          "kawaii-mecha",
          "bullet-hell",
          "wuxia-flight",
          "blocky-pixel",
          "cute-cartoon",
          "dark-fantasy",
          "80s-cartoon",
          "nature-organic",
          "neon-cyber",
          "paper-craft",
        ])
        .optional(),
      /** HUD 字体倾向：与 assetStyle 协同（serif/handwritten/pixel/sans 等） */
      hudFontStyle: z.enum(["sans", "serif", "pixel", "handwritten", "display"]).optional(),
      /** 背景音乐标签：与 musicProfile 协同，用于映射 public/game-bgm/*.ogg */
      bgmTag: z.string().min(1).max(40).optional(),
      /** SFX 音效包标签：用于映射 public/game-sfx/{tag}/*.wav */
      sfxPack: z.string().min(1).max(40).optional(),
    })
    .optional(),
  labels: z.object({
    player: z.string().max(32),
    hazard: z.string().max(32),
    collectible: z.string().max(32).optional(),
    subtitle: z.string().max(120).optional(),
  }),
  /** towerDefense 复杂蓝图（可选；缺省则由引擎侧生成默认关卡） */
  towerDefense: TowerDefenseBlueprintSchema.optional(),
  /** coaster：3D 空中轨道（缺省则由引擎侧生成默认轨道） */
  coaster: CoasterBlueprintSchema.optional(),
  /** customization：汽车涂色 / 陶艺拉坯 */
  customization: CustomizationBlueprintSchema.optional(),
  /** puzzle：消除/找不同/记忆/拼图模式 */
  puzzle: PuzzleBlueprintSchema.optional(),
  /** chess：国际象棋 / 中国象棋规则蓝图 */
  chess: ChessBlueprintSchema.optional(),
  /** platformer / stealth：二段跳与弹性摆荡 */
  platformer: PlatformerBlueprintSchema.optional(),
  /** farming：网格种植经济 */
  farming: FarmingBlueprintSchema.optional(),
  /** strategy：区域征服派兵 */
  strategy: StrategyBlueprintSchema.optional(),
  /** Phase 3：Agentic 生成的受限游戏模块（优先于 template 场景） */
  agenticModule: AgenticModuleSchema.optional(),
  /** OpenGame 试玩路由：dedicated=样品级专用 Scene；agentic=AgenticScene+Skills（复杂 prompt 自动 agentic） */
  agenticPlayRoute: z.enum(["dedicated", "agentic"]).optional(),
  /** 通用导演蓝图（可选；缺省则由引擎侧使用默认曲线） */
  director: DirectorSchema.optional(),
  /** 通用系统层（可选；缺省则由引擎侧补齐） */
  systems: SystemsSchema.optional(),
  /** Astrocade 式 per-game 定制（seed/生成时烘焙；运行时读 profile 不查 sampleId） */
  samplePlayProfile: SamplePlayProfileSchema.optional(),
});

export type GameSpec = z.infer<typeof GameSpecSchema>;

export function parseGameSpec(raw: unknown): GameSpec {
  return GameSpecSchema.parse(raw);
}
