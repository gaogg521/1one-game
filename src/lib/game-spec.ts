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
  ruleset: z.enum(["international", "xiangqi", "go", "jungle", "gomoku", "junqi"]),
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
  levelStyle: z.enum(["explore", "challenge", "speedrun"]).optional(),
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

/**
 * Shooter Blueprint：射击模板的关卡级设计 DSL（编队 + 弹幕 + 武器树 + Boss 阶段）。
 * LLM 可输出，缺省时由服务端 buildShooterBlueprint 兜底补齐。
 */
const ShooterBlueprintSchema = z.object({
  waves: z
    .array(
      z.object({
        at: z.number().min(0).max(1),
        pattern: z.enum([
          "v-formation",
          "side-swoop",
          "circle-swarm",
          "wave-grid",
          "diagonal-strafe",
          "tail-chase",
          "burst-spawn",
          "boss-arena",
        ]),
        count: z.number().min(1).max(30),
        hpMul: z.number().min(0.5).max(4),
        speedMul: z.number().min(0.5).max(3),
        bullet: z.enum([
          "single",
          "spread-3",
          "spread-5",
          "fan-7",
          "spiral",
          "ring",
          "shotgun",
          "aimed-volley",
          "laser-beam",
        ]),
        elite: z.boolean().optional(),
        banner: z.string().min(1).max(32).optional(),
      }),
    )
    .min(3)
    .max(10),
  drops: z
    .array(z.enum(["spread-shot", "laser-beam", "shield", "bomb", "wingman", "heal", "score-mult"]))
    .min(2)
    .max(8),
  boss: z.object({
    label: z.string().min(1).max(32),
    phases: z
      .array(
        z.object({
          hpThreshold: z.number().min(0).max(1),
          label: z.string().min(1).max(32),
          bullet: z.enum([
            "single",
            "spread-3",
            "spread-5",
            "fan-7",
            "spiral",
            "ring",
            "shotgun",
            "aimed-volley",
            "laser-beam",
          ]),
          motion: z.enum(["horizontal-swing", "figure-eight", "spiral-down", "teleport-burst", "still-rage"]),
          intensity: z.number().min(0.2).max(3),
        }),
      )
      .min(1)
      .max(6),
    baseHp: z.number().min(20).max(800),
  }),
  startingWeapon: z.enum([
    "single",
    "spread-3",
    "spread-5",
    "fan-7",
    "spiral",
    "ring",
    "shotgun",
    "aimed-volley",
    "laser-beam",
  ]),
  weaponTree: z
    .array(
      z.enum([
        "single",
        "spread-3",
        "spread-5",
        "fan-7",
        "spiral",
        "ring",
        "shotgun",
        "aimed-volley",
        "laser-beam",
      ]),
    )
    .min(2)
    .max(8),
});

const CollectorBlueprintSchema = z.object({
  /** 收集物类型表（普通 + 高价值限时） */
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(24),
        name: z.string().min(1).max(24),
        /** 每次拾取得分 */
        points: z.number().min(1).max(50),
        /** 是否是限时高价值（goldenPickup 事件时出现） */
        isGolden: z.boolean().optional(),
        /** 限时黄金收集物的出现窗口（毫秒） */
        goldenWindowMs: z.number().min(2000).max(12000).optional(),
      }),
    )
    .min(2)
    .max(8),
  /** 磁铁道具：玩家附近收集物自动吸附 */
  magnetEnabled: z.boolean().optional(),
  /** 连击奖励倍数（comboBonus 事件的得分乘数） */
  comboMultiplier: z.number().min(1.2).max(5).optional(),
  /** 危险物（接触扣分或失去一命） */
  hazardPenalty: z.enum(["loseLife", "loseScore", "none"]).optional(),
});

const SurvivorBlueprintSchema = z.object({
  /** 精英波配置（miniBoss 事件的具体波形） */
  eliteWaves: z
    .array(
      z.object({
        at: z.number().min(0).max(1),
        label: z.string().min(1).max(24),
        /** 精英怪 HP 倍数 */
        hpMul: z.number().min(1.5).max(8),
        /** 精英怪速度倍数 */
        speedMul: z.number().min(1).max(3),
        count: z.number().min(1).max(12),
      }),
    )
    .min(1)
    .max(5),
  /** 喘息窗口（breathingRoom）期间是否停止生成危险物 */
  breathingRoomPausesSpawns: z.boolean().optional(),
  /** 供给道具（喘息段掉落的治疗/护盾） */
  supplyDrops: z
    .array(
      z.object({
        type: z.enum(["heal", "shield", "speedBoost", "invincible"]),
        durationMs: z.number().min(1000).max(10000),
      }),
    )
    .max(4)
    .optional(),
  /** 最大同屏危险物数（超出则暂停刷怪） */
  maxHazardsOnScreen: z.number().min(4).max(40).optional(),
});

const AvoiderBlueprintSchema = z.object({
  /** 弹幕波形配置 */
  bulletPatterns: z
    .array(
      z.object({
        at: z.number().min(0).max(1),
        pattern: z.enum(["aimed", "ring", "spiral", "random-burst", "wall", "cross", "fan", "gate"]),
        density: z.number().min(1).max(5),
        speedMul: z.number().min(0.5).max(3),
      }),
    )
    .min(2)
    .max(8),
  /** 终局 finalBarrage 持续时间（毫秒） */
  finalBarrageDurationMs: z.number().min(5000).max(30000).optional(),
  /** 擦弹奖励（comboBonus）：危险物通过玩家附近 N 像素内时计入 */
  grazingDistancePx: z.number().min(8).max(40).optional(),
  /** 擦弹连击奖励得分 */
  grazingBonus: z.number().min(1).max(20).optional(),
  /** 是否允许低速缩小体积（蓄力闪避） */
  focusModeEnabled: z.boolean().optional(),
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

/** 节奏音游蓝图：节拍 + 轨道 + 命中窗口 */
export const RhythmBlueprintSchema = z.object({
  bpm: z.number().min(60).max(220),
  lanes: z.number().int().min(3).max(6),
  patternDensity: z.number().min(0.2).max(1.0),
  hitWindowMs: z.number().min(60).max(220),
  totalNotes: z.number().int().min(12).max(160),
  /** 速度倍率（玩家可选难度） */
  speedMult: z.number().min(0.6).max(2.0).optional(),
});

/** 体育运动蓝图：运动类型 + 目标分 + 时间限制 */
export const SportsBlueprintSchema = z.object({
  sport: z.enum(["basketball", "football", "tennis", "golf", "bowling"]),
  targetScore: z.number().int().min(3).max(50),
  timeLimitMs: z.number().min(20000).max(180000),
  /** AI 对手强度 0..1 */
  aiDifficulty: z.number().min(0).max(1),
  /** 物理：抛物线重力 / 球速等 */
  gravity: z.number().min(4).max(25).optional(),
  ballSpeed: z.number().min(4).max(20).optional(),
});

/** 卡牌战斗蓝图：手牌上限 + 法力 + 牌组 + AI 难度 */
export const CardBlueprintSchema = z.object({
  startingHand: z.number().int().min(3).max(7),
  maxMana: z.number().int().min(5).max(12),
  deckSize: z.number().int().min(16).max(40),
  aiDifficulty: z.number().min(0).max(1),
  /** 玩家初始血量 */
  playerHp: z.number().int().min(10).max(60),
});

/** 格斗蓝图：回合 + 血量 + 招式 + AI 难度 */
export const FightingBlueprintSchema = z.object({
  rounds: z.number().int().min(1).max(5),
  playerHp: z.number().int().min(40).max(200),
  aiDifficulty: z.number().min(0).max(1),
  moves: z.array(z.enum(["light", "heavy", "block", "special"])).max(4).optional(),
});

/** MOBA 1v1 蓝图：推塔目标 + 英雄血量 + 技能 + AI 难度 */
export const MobaBlueprintSchema = z.object({
  towersToWin: z.number().int().min(1).max(3),
  playerHp: z.number().int().min(80).max(500),
  aiDifficulty: z.number().min(0).max(1),
  abilities: z.number().int().min(2).max(5),
});

/** 恐怖监控蓝图：夜晚数 + 摄像头数 + 怪物生成节奏 + 门冷却 */
export const HorrorBlueprintSchema = z.object({
  nights: z.number().int().min(1).max(7),
  cameras: z.number().int().min(3).max(6),
  monsterSpawnIntervalMs: z.number().min(3000).max(15000),
  doorCooldownMs: z.number().min(1500).max(10000),
  /** 玩家电力 / 资源上限 */
  powerMax: z.number().int().min(50).max(200),
});

/** 麻将蓝图：变体 + 点数 + AI 难度 + 局数 */
export const MahjongBlueprintSchema = z.object({
  /** 规则变体：sichuan=四川血战 / national=国标 / japanese=日本立直 */
  variant: z.enum(["sichuan", "national", "japanese"]),
  /** 初始点数 */
  startingPoints: z.number().int().min(250).max(1000),
  /** AI 难度 0..1 */
  aiDifficulty: z.number().min(0).max(1),
  /** 对局局数 */
  rounds: z.number().int().min(1).max(8),
  /** 日本麻将是否启用宝牌（dora） */
  enableDora: z.boolean().optional(),
});

/** 俄罗斯方块蓝图 */
export const TetrisBlueprintSchema = z.object({
  /** 网格宽 */
  gridWidth: z.number().int().min(8).max(12),
  /** 网格高 */
  gridHeight: z.number().int().min(16).max(24),
  /** 目标消行数 */
  targetLines: z.number().int().min(10).max(80),
  /** 起始速度（毫秒/步） */
  startSpeedMs: z.number().min(200).max(1200),
  /** 速度递增（每消 N 行加速） */
  speedStepMs: z.number().min(20).max(200).optional(),
});

/** 无尽跑酷蓝图 */
export const EndlessRunnerBlueprintSchema = z.object({
  /** 道数（通常 3） */
  lanes: z.number().int().min(2).max(5),
  /** 目标距离 / 分数 */
  targetScore: z.number().int().min(500).max(10000),
  /** 速度（像素/秒） */
  speed: z.number().min(300).max(900),
  /** 障碍密度 0..1 */
  obstacleDensity: z.number().min(0.1).max(0.8),
});

/** 水果忍者蓝图 */
export const FruitNinjaBlueprintSchema = z.object({
  /** 目标分数 */
  targetScore: z.number().int().min(20).max(200),
  /** 时间限制（毫秒） */
  timeLimitMs: z.number().min(30000).max(180000),
  /** 水果抛出间隔（毫秒） */
  spawnIntervalMs: z.number().min(400).max(2000),
  /** 炸弹概率 0..1 */
  bombChance: z.number().min(0).max(0.5),
});

/**
 * 深度 Godot 视觉层（可选；省略时 enrich 阶段按 assetStyle 自动推断）。
 *
 * `shaderPack`：母版 `resources/shaders/{pack}.gdshader` 名（不含扩展名）。
 * `particleIntensity`：粒子密度倍率（minimal=0.3× / standard=1× / showcase=2×）。
 * `animationSet`：属性动画集档位（none=纯 tween；prop-bounce=弹跳；prop-action=跑/跳/受击/死亡/Boss；prop-action-glb=同上+预留 .glb 兜底）。
 * `zones[]`：LLM 显式声明的关卡触发器/AOE，runtime 用 Area3D 实例化。
 */
export const VisualSchema = z.object({
  shaderPack: z
    .enum([
      "flat",
      "neon-glow",
      "hologram",
      "toon",
      "pixel-grade",
      "ink-wash",
      "dissolve",
      "crystal",
      "organic-pulse",
    ])
    .optional(),
  particleIntensity: z.enum(["minimal", "standard", "showcase"]).optional(),
  animationSet: z.enum(["none", "prop-bounce", "prop-action", "prop-action-glb"]).optional(),
  zones: z
    .array(
      z.object({
        id: z.string().min(1).max(32),
        type: z.enum(["spawn", "hazard", "goal", "trigger", "aoe"]),
        shape: z.enum(["box", "sphere"]),
        center: z.array(z.number()).length(3).optional(),
        size: z.array(z.number()).length(3).optional(),
        radius: z.number().min(0).max(64).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        label: z.string().max(32).optional(),
      }),
    )
    .max(24)
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
  /** 深度 Godot 视觉层（可选；省略时 enrich 按 assetStyle 自动推断 shaderPack/animationSet） */
  visual: VisualSchema.optional(),
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
  /** shooter：射击关卡级蓝图（编队 / 弹幕 / 武器树 / Boss 阶段） */
  shooter: ShooterBlueprintSchema.optional(),
  /** platformer / stealth：二段跳与弹性摆荡 */
  platformer: PlatformerBlueprintSchema.optional(),
  /** farming：网格种植经济 */
  farming: FarmingBlueprintSchema.optional(),
  /** strategy：区域征服派兵 */
  strategy: StrategyBlueprintSchema.optional(),
  /** collector：收集物品类型 + 连击 + 磁铁 */
  collector: CollectorBlueprintSchema.optional(),
  /** survivor：精英波 + 喘息窗口 + 供给道具 */
  survivor: SurvivorBlueprintSchema.optional(),
  /** avoider：弹幕波形 + 擦弹连击 + 终局弹幕 */
  avoider: AvoiderBlueprintSchema.optional(),
  /** 节奏音游：bpm + 轨道 + 命中窗口 */
  rhythm: RhythmBlueprintSchema.optional(),
  /** 体育运动：投篮/射门/挥拍等抛物线物理 */
  sports: SportsBlueprintSchema.optional(),
  /** 卡牌战斗：手牌 + 法力 + AI 对手 */
  card: CardBlueprintSchema.optional(),
  /** 格斗：回合 + 血量 + 招式 + AI */
  fighting: FightingBlueprintSchema.optional(),
  /** MOBA 1v1：推塔 + 技能 + AI 英雄 */
  moba: MobaBlueprintSchema.optional(),
  /** 恐怖监控：摄像头 + 怪物生成 + 门冷却 */
  horror: HorrorBlueprintSchema.optional(),
  /** 麻将：变体 + 点数 + AI + 局数 */
  mahjong: MahjongBlueprintSchema.optional(),
  /** 俄罗斯方块：网格 + 目标消行 + 速度 */
  tetris: TetrisBlueprintSchema.optional(),
  /** 无尽跑酷：道数 + 目标 + 速度 + 障碍密度 */
  endlessRunner: EndlessRunnerBlueprintSchema.optional(),
  /** 水果忍者：目标分 + 时间 + 抛出间隔 + 炸弹概率 */
  fruitNinja: FruitNinjaBlueprintSchema.optional(),
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
