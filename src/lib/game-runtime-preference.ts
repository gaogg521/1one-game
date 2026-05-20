/** 用户偏好的试玩引擎：Phaser 秒开预览 / Godot 在线完整版 */
export type GameRuntimeChoice = "phaser" | "godot";

const STORAGE_KEY = "1one-game-runtime-preference";
export const GAME_RUNTIME_PREFERENCE_EVENT = "1one-game-runtime-preference-change";

export function getGameRuntimePreference(): GameRuntimeChoice {
  if (typeof window === "undefined") return "phaser";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "godot" ? "godot" : "phaser";
  } catch {
    return "phaser";
  }
}

export function setGameRuntimePreference(choice: GameRuntimeChoice): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, choice);
    window.dispatchEvent(new CustomEvent(GAME_RUNTIME_PREFERENCE_EVENT, { detail: choice }));
  } catch {
    /* quota / private mode */
  }
}
