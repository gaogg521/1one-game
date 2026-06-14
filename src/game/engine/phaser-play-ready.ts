declare global {
  interface Window {
    __PHASER_PLAY_READY__?: boolean;
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
  }
}

export function schedulePhaserPlayReady(scene: Phaser.Scene, delayMs = 1500): void {
  scene.time.delayedCall(delayMs, () => markPhaserPlayReady());
}
