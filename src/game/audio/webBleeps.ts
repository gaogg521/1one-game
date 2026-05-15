/** 轻量 Web Audio 蜂鸣，无需素材文件；首次交互前可能被浏览器静音，resume 在调用处处理。 */

import { getSharedAudioContext } from "@/game/audio/audio-context";

/** 依据主题微调音高系数（通常为 0.82–1.18），由 Presentation 会话级设置。 */
let bleepTemperament = 1;

export function setBleepTemperament(mult: number): void {
  if (!Number.isFinite(mult)) return;
  bleepTemperament = Math.min(1.45, Math.max(0.65, mult));
}

export type BleepKind = "pickup" | "hit" | "win";

export function playBleep(kind: BleepKind): void {
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume();
  }

  const t = bleepTemperament;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (kind === "pickup") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(740 * t, now);
    osc.frequency.exponentialRampToValueAtTime(1180 * t, now + 0.07);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.11);
    osc.start(now);
    osc.stop(now + 0.12);
  } else if (kind === "hit") {
    osc.type = "square";
    osc.frequency.setValueAtTime(140 * t, now);
    osc.frequency.exponentialRampToValueAtTime(70 * t, now + 0.14);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.21);
  } else {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(523 * t, now);
    osc.frequency.setValueAtTime(784 * t, now + 0.08);
    osc.frequency.setValueAtTime(1046 * t, now + 0.16);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.36);
  }
}
