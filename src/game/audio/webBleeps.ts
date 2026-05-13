/** 轻量 Web Audio 蜂鸣，无需素材文件；首次交互前可能被浏览器静音，resume 在调用处处理。 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export type BleepKind = "pickup" | "hit" | "win";

export function playBleep(kind: BleepKind): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume();
  }

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (kind === "pickup") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.07);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.11);
    osc.start(now);
    osc.stop(now + 0.12);
  } else if (kind === "hit") {
    osc.type = "square";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.14);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.21);
  } else {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.setValueAtTime(784, now + 0.08);
    osc.frequency.setValueAtTime(1046, now + 0.16);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.36);
  }
}
