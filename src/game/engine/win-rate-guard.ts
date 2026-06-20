/**
 * Win Rate Guard — 每次对局结束写入 localStorage，达到样本量后计算胜率并返回难度偏置。
 * difficultyBias > 0  → 游戏偏难，应降低难度（减少敌人/加快 HP 回复等）
 * difficultyBias < 0  → 游戏偏易，可适当加强
 * 范围 [-0.25, +0.25]
 */

const STORE_KEY = "wrt_v1"; // win-rate tracker v1
const MIN_SAMPLES = 3;
const WINDOW = 10; // 滑动窗口最近 N 局

type Slot = { w: 0 | 1; t: number }; // won, timestamp

interface Store {
  [gameId: string]: Slot[];
}

function loadStore(): Store {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function saveStore(s: Store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* quota — ignore */
  }
}

/** 记录一局对局结果 */
export function recordGameResult(gameId: string, won: boolean): void {
  if (!gameId || typeof localStorage === "undefined") return;
  const store = loadStore();
  const slots: Slot[] = store[gameId] ?? [];
  slots.push({ w: won ? 1 : 0, t: Date.now() });
  // 保留最近 WINDOW 局
  if (slots.length > WINDOW) slots.splice(0, slots.length - WINDOW);
  store[gameId] = slots;
  saveStore(store);
}

/**
 * 返回该 gameId 的难度偏置 [−0.25, +0.25]。
 * 胜率 > 0.65 → 偏易 → bias < 0（加难）
 * 胜率 < 0.35 → 偏难 → bias > 0（降难）
 * 样本不足时返回 0。
 */
export function getDifficultyBias(gameId: string): number {
  if (!gameId || typeof localStorage === "undefined") return 0;
  const store = loadStore();
  const slots = store[gameId] ?? [];
  if (slots.length < MIN_SAMPLES) return 0;
  const wr = slots.reduce((s, sl) => s + sl.w, 0) / slots.length;
  // map wr: 0→+0.25, 0.5→0, 1→−0.25
  return Math.max(-0.25, Math.min(0.25, (0.5 - wr) * 0.5));
}
