/** Scene 向 Playwright 暴露可断言的运行时状态（金币/分数/种植等） */
export type PhaserQaState = Record<string, number | string | boolean>;

declare global {
  interface Window {
    __PHASER_QA_STATE__?: PhaserQaState;
  }
}

export function setPhaserQaState(patch: PhaserQaState): void {
  if (typeof window === "undefined") return;
  window.__PHASER_QA_STATE__ = { ...(window.__PHASER_QA_STATE__ ?? {}), ...patch };
}

export function initQaState(patch: PhaserQaState = {}): void {
  setPhaserQaState({ qaTouches: 0, ...patch });
}

export function bumpQaTouch(delta = 1): void {
  if (typeof window === "undefined") return;
  const prev = window.__PHASER_QA_STATE__?.qaTouches;
  const n = (typeof prev === "number" ? prev : 0) + delta;
  setPhaserQaState({ qaTouches: n });
}

export function clearPhaserQaState(): void {
  if (typeof window === "undefined") return;
  delete window.__PHASER_QA_STATE__;
}
