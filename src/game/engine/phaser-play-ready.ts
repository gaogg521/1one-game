export type QaClickHint = { x: number; y: number };

export type { PhaserQaState } from "@/game/engine/phaser-qa-state";
import { clearPhaserQaState, initQaState, type PhaserQaState } from "@/game/engine/phaser-qa-state";

declare global {
  interface Window {
    __PHASER_PLAY_READY__?: boolean;
    /** QA：Playwright 读取当前 Phaser Game 实例（scene key / 交互断言） */
    __PHASER_QA_GAME__?: import("phaser").Game;
    /** QA：Scene 提供的相对点击坐标（0–1），优先于静态用例坐标 */
    __PHASER_QA_CLICKS__?: QaClickHint[];
    /** QA：运行时状态（金币/分数等），用于玩法深度断言 */
    __PHASER_QA_STATE__?: import("@/game/engine/phaser-qa-state").PhaserQaState;
  }
}

/** QA / 对标截图：Scene 稳定后标记（HudBanner 结束后调用） */
export function markPhaserPlayReady(): void {
  if (typeof window !== "undefined") {
    window.__PHASER_PLAY_READY__ = true;
    // 确保 QA 状态对象存在（Scene create 与 ready 标记之间的竞态）
    if (!window.__PHASER_QA_STATE__) {
      window.__PHASER_QA_STATE__ = { qaTouches: 0 };
    }
  }
}

export function resetPhaserPlayReady(): void {
  if (typeof window !== "undefined") {
    window.__PHASER_PLAY_READY__ = false;
    delete window.__PHASER_QA_GAME__;
    delete window.__PHASER_QA_CLICKS__;
    clearPhaserQaState();
  }
}

export function setPhaserQaClickHints(hints: QaClickHint[]): void {
  if (typeof window !== "undefined") {
    window.__PHASER_QA_CLICKS__ = hints;
  }
}

export function registerPhaserQaGame(game: import("phaser").Game): void {
  if (typeof window !== "undefined") {
    window.__PHASER_QA_GAME__ = game;
  }
}

export function clearPhaserQaGame(): void {
  if (typeof window !== "undefined") {
    delete window.__PHASER_QA_GAME__;
  }
}

export function schedulePhaserPlayReady(scene: Phaser.Scene, delayMs = 1500, qaPatch?: PhaserQaState): void {
  scene.time.delayedCall(delayMs, () => {
    if (qaPatch) initQaState(qaPatch);
    markPhaserPlayReady();
  });
}
