/** 本地最高分存储（localStorage, per templateId） */

const STORE_KEY = "lhs_v1"; // local high scores v1

interface Store {
  [gameId: string]: { best: number; t: number };
}

function load(): Store {
  if (typeof localStorage === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") as Store; }
  catch { return {}; }
}

function save(s: Store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* quota */ }
}

/** 记录本局分数，若刷新历史最高返回 true */
export function recordScore(gameId: string, score: number): boolean {
  if (!gameId || typeof localStorage === "undefined") return false;
  const s = load();
  const prev = s[gameId]?.best ?? -1;
  const isNew = score > prev;
  if (isNew) {
    s[gameId] = { best: score, t: Date.now() };
    save(s);
  }
  return isNew;
}

/** 取历史最高，无记录返回 null */
export function getHighScore(gameId: string): number | null {
  if (!gameId || typeof localStorage === "undefined") return null;
  const s = load();
  return s[gameId]?.best ?? null;
}
