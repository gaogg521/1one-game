declare global {
  interface Window {
    __PHASER_PLAY_READY__?: boolean;
    /** QA：Playwright 读取当前 Phaser Game 实例（scene key / 交互断言） */
    __PHASER_QA_GAME__?: import("phaser").Game;
  }
}

/** QA / 对标截图：Scene 稳定后标记（HudBanner 结束后调用） */
export function markPhaserPlayReady(): void {
  if (typeof window !== "undefined") {
    window.__PHASER_PLAY_READY__ = true;
  }
}

export function resetPhaserPlayReady(): void {
  if (typeof window !== "undefined") {
    window.__PHASER_PLAY_READY__ = false;
    delete window.__PHASER_QA_GAME__;
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

export function schedulePhaserPlayReady(scene: Phaser.Scene, delayMs = 1500): void {
  scene.time.delayedCall(delayMs, () => markPhaserPlayReady());
}
