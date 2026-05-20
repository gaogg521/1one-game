/** 轻量 Web Audio 蜂鸣，无需素材文件；首次交互前可能被浏览器静音，resume 在调用处处理。 */

import { getSharedAudioContext } from "@/game/audio/audio-context";

/** 依据主题微调音高系数（通常为 0.82–1.18），由 Presentation 会话级设置。 */
let bleepTemperament = 1;

export function setBleepTemperament(mult: number): void {
  if (!Number.isFinite(mult)) return;
  bleepTemperament = Math.min(1.45, Math.max(0.65, mult));
}

export type BleepKind = "pickup" | "hit" | "win" | "fire" | "explode";

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

  if (kind === "fire") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(920 * t, now);
    osc.frequency.exponentialRampToValueAtTime(420 * t, now + 0.05);
    gain.gain.setValueAtTime(0.028, now);
    gain.gain.exponentialRampToValueAtTime(0.0006, now + 0.07);
    osc.start(now);
    osc.stop(now + 0.075);
    return;
  }

  if (kind === "explode") {
    const dur = 0.22;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const noise = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      const env = 1 - i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * env * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.11, now);
    ng.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    const boom = ctx.createOscillator();
    boom.type = "sine";
    boom.frequency.setValueAtTime(110 * t, now);
    boom.frequency.exponentialRampToValueAtTime(48 * t, now + 0.12);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.09, now);
    bg.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);
    src.connect(ng);
    ng.connect(ctx.destination);
    boom.connect(bg);
    bg.connect(ctx.destination);
    src.start(now);
    boom.start(now);
    src.stop(now + dur);
    boom.stop(now + 0.17);
    return;
  }

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
    osc.frequency.setValueAtTime(180 * t, now);
    osc.frequency.exponentialRampToValueAtTime(55 * t, now + 0.16);
    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.22);
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(320 * t, now);
    osc2.frequency.exponentialRampToValueAtTime(90 * t, now + 0.12);
    g2.gain.setValueAtTime(0.035, now);
    g2.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);
    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.2);
    osc.start(now);
    osc.stop(now + 0.23);
  } else {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(523 * t, now);
    osc.frequency.setValueAtTime(784 * t, now + 0.08);
    osc.frequency.setValueAtTime(1046 * t, now + 0.16);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.36);
  }
}
