import type { GameSpec } from "@/lib/game-spec";

/**
 * 真 2048 合并蓝图。
 *
 * 字段可由 LLM 在 spec.merge2048 内填入（当前 GameSpec schema 暂未注册该字段，
 * 故通过 raw 读取兜底），也可在运行时通过 buildMerge2048Blueprint 从 prompt / spec
 * 推断兜底。Scene 读取时永远走 blueprint，保证「同 prompt 出同局」。
 */
export type Merge2048Blueprint = {
  /** 网格尺寸：4 / 5 / 6，默认 4 */
  gridSize: 4 | 5 | 6;
  /** 通关目标方块：2048 / 4096 / 8192，默认 2048 */
  targetTile: 2048 | 4096 | 8192;
  /** 每次有效移动后生成的新块数：1 或 2，默认 1 */
  spawnPerMove: 1 | 2;
  /** 上限移动次数（达到即判定结束）：200..1000，默认 1000 */
  maxMoves: number;
};

/** 用户提示 / spec 中可显式指定的构造参数。 */
export type Merge2048BlueprintInput = {
  prompt?: string;
  spec?: GameSpec;
  sampleId?: string;
};

const GRID_SIZE_MIN = 4 as const;
const GRID_SIZE_MAX = 6 as const;
const MOVES_MIN = 200;
const MOVES_MAX = 1000;

/**
 * 兼容读取：spec.merge2048 当前未在 GameSpec schema 注册，
 * 故通过 as any 兜底读取 LLM 显式落库的蓝图字段，避免 schema 漂移时报错。
 */
function readRawBlueprint(spec: GameSpec | undefined): {
  gridSize?: unknown;
  targetTile?: unknown;
  spawnPerMove?: unknown;
  maxMoves?: unknown;
} {
  if (!spec) return {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (spec as any).merge2048;
  if (raw && typeof raw === "object") {
    return raw as {
      gridSize?: unknown;
      targetTile?: unknown;
      spawnPerMove?: unknown;
      maxMoves?: unknown;
    };
  }
  return {};
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function inferGridSize(opts: Merge2048BlueprintInput): 4 | 5 | 6 {
  const blob = (opts.prompt ?? opts.spec?.title ?? "").toLowerCase();
  if (/5\s*[×x*]\s*5|五维|五宫|5\s*grid|grid\s*5/.test(blob)) return 5;
  if (/6\s*[×x*]\s*6|六维|六宫|6\s*grid|grid\s*6/.test(blob)) return 6;
  const raw = readRawBlueprint(opts.spec).gridSize;
  if (raw === 4 || raw === 5 || raw === 6) return raw;
  // 高强度（hardcore / 极限挑战）时偏向 5x5 / 6x6 以增加合并难度
  const intensity = opts.spec?.director?.intensity ?? 0.5;
  if (intensity > 0.82) return 5;
  return 4;
}

function inferTargetTile(opts: Merge2048BlueprintInput): 2048 | 4096 | 8192 {
  const blob = (opts.prompt ?? opts.spec?.title ?? "").toLowerCase();
  if (/8192|8k|终极合成|极限2048/.test(blob)) return 8192;
  if (/4096|4k|进阶合成|挑战.*4096/.test(blob)) return 4096;
  const raw = readRawBlueprint(opts.spec).targetTile;
  if (raw === 2048 || raw === 4096 || raw === 8192) return raw;
  // 默认 2048 — 经典玩法最直观
  return 2048;
}

function inferSpawnPerMove(opts: Merge2048BlueprintInput): 1 | 2 {
  const raw = readRawBlueprint(opts.spec).spawnPerMove;
  if (raw === 1 || raw === 2) return raw;
  const blob = (opts.prompt ?? opts.spec?.title ?? "").toLowerCase();
  if (/双生成|快速|速通|hardcore|地狱|疯狂|chaos|fast/i.test(blob)) return 2;
  return 1;
}

function inferMaxMoves(opts: Merge2048BlueprintInput): number {
  const raw = readRawBlueprint(opts.spec).maxMoves;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return clampInt(raw, MOVES_MIN, MOVES_MAX);
  }
  // 5x5/6x6 + 高 target → 给更长移动预算；4x4 2048 经典局 1000 步足够
  const grid = inferGridSize(opts);
  const target = inferTargetTile(opts);
  if (grid >= 6 || target >= 8192) return 1000;
  if (grid === 5 || target === 4096) return 800;
  return 600;
}

/**
 * 构造 2048 合并蓝图。优先取 spec.merge2048（若已显式落库），
 * 否则按 prompt 关键词 + director.intensity 兜底推断。
 *
 * 同 prompt + 同 spec 永远出同一蓝图（纯函数，无随机）。
 */
export function buildMerge2048Blueprint(opts: Merge2048BlueprintInput): Merge2048Blueprint {
  const gridSize = inferGridSize(opts);
  const targetTile = inferTargetTile(opts);
  const spawnPerMove = inferSpawnPerMove(opts);
  const maxMoves = clampInt(inferMaxMoves(opts), MOVES_MIN, MOVES_MAX);

  // gridSize 防御性二次校验（避免 schema 漂移）
  const safeGrid: 4 | 5 | 6 = (gridSize >= GRID_SIZE_MIN && gridSize <= GRID_SIZE_MAX
    ? gridSize
    : 4) as 4 | 5 | 6;

  return {
    gridSize: safeGrid,
    targetTile,
    spawnPerMove,
    maxMoves,
  };
}
