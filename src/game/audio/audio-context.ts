/** 全站小游戏音频共用一个 AudioContext（环境音与蜂鸣共用，避免多上下文争用输出）。 */

let audioCtx: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function resumeSharedAudioContext(): Promise<void> {
  const ctx = getSharedAudioContext();
  if (!ctx) return Promise.resolve();
  if (ctx.state === "suspended") {
    return ctx.resume().catch(() => {});
  }
  return Promise.resolve();
}
