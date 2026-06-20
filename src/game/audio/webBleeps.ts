/**
 * 程序化 SFX 包：
 * 在原有 5 种基础蜂鸣（pickup / hit / win / fire / explode）之上做"多层合成 + 失真 + 短滤波 + 反射尾"升级，
 * 并新增 boss / level-up / shield / laser / death / power 等更丰富的事件音色。
 *
 * 仍然完全程序化，无需任何 wav 资源；
 * 但听感比纯单 osc bleep 厚得多（带噪声层、双 osc 谐波、滤波包络、短反射）。
 *
 * 由 cohesive-presentation.bleepTemperament 给主旋律 osc 加 ±20% 微调（保留原行为）；
 * 由 setSfxPack(style) 选择 5 套调色（neon / organic / pulse / minimal / blocky），影响波形偏好与混响量。
 */

import { getSharedAudioContext } from "@/game/audio/audio-context";

let bleepTemperament = 1;
let sfxPack:
  | "arcade"
  | "neon"
  | "organic"
  | "pulse"
  | "minimal"
  | "blocky"
  | "chime"
  | "whistle"
  | "shuffle"
  | "impact"
  | "laser"
  | "drone" = "arcade";

export function setBleepTemperament(mult: number): void {
  if (!Number.isFinite(mult)) return;
  bleepTemperament = Math.min(1.45, Math.max(0.65, mult));
}

/** 与 cohesive-presentation 的 musicProfile / assetStyle 协同 */
export function setSfxPack(pack: typeof sfxPack): void {
  sfxPack = pack;
}

export type BleepKind =
  | "pickup"
  | "hit"
  | "win"
  | "fire"
  | "explode"
  | "boss"
  | "levelUp"
  | "shield"
  | "laser"
  | "death"
  | "power";

// ─── 基础帮助 ─────────────────────────────────────────────────────

function pickWave(): OscillatorType {
  switch (sfxPack) {
    case "neon":
    case "pulse":
      return "sawtooth";
    case "organic":
      return "sine";
    case "minimal":
      return "sine";
    case "blocky":
      return "square";
    // 6 个新 pack（对应 rhythm/sports/card/fighting/moba/horror）
    case "chime": // 节奏音游：清脆铃声
    case "whistle": // 体育：哨声感
      return "triangle";
    case "shuffle": // 卡牌：柔和翻牌
      return "sine";
    case "impact": // 格斗：厚重打击
    case "laser": // MOBA：科幻激光
      return "sawtooth";
    case "drone": // 恐怖：低沉氛围
      return "sawtooth";
    default:
      return "triangle";
  }
}

function reverbAmount(): number {
  switch (sfxPack) {
    case "neon":
    case "pulse":
      return 0.22;
    case "minimal":
      return 0.04;
    case "chime": // 音游需要干净短反射
      return 0.18;
    case "whistle": // 体育哨声短促
      return 0.08;
    case "shuffle": // 卡牌翻动极短
      return 0.05;
    case "impact": // 格斗打击偏干
      return 0.10;
    case "laser": // MOBA 激光需要空间感
      return 0.20;
    case "drone": // 恐怖氛围长尾
      return 0.45;
    default:
      return 0.12;
  }
}

/** 噪声 buffer */
function makeNoise(ctx: AudioContext, dur: number, kind: "white" | "pink" = "white"): AudioBuffer {
  const size = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buf.getChannelData(0);
  if (kind === "white") {
    for (let i = 0; i < size; i += 1) {
      const env = 1 - i / size;
      data[i] = (Math.random() * 2 - 1) * env;
    }
  } else {
    // pink-ish: 1-pole 低通
    let last = 0;
    for (let i = 0; i < size; i += 1) {
      const env = 1 - i / size;
      const white = Math.random() * 2 - 1;
      last = last * 0.93 + white * 0.07;
      data[i] = last * 4 * env;
    }
  }
  return buf;
}

/**
 * 短反射尾（最便宜的"空间感"）：将信号通过 1 个 delay + lowpass + 衰减 mix 回去。
 * 它不是真正的 convolver IR reverb，但能让 sfx 不再"贴脸干"。
 */
function withTail(
  ctx: AudioContext,
  sourceConnect: (dest: AudioNode) => void,
  mix: number,
  delayMs = 90,
): void {
  const dryMix = ctx.createGain();
  const wetMix = ctx.createGain();
  const delay = ctx.createDelay();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2200;
  dryMix.gain.value = 1;
  wetMix.gain.value = mix;
  delay.delayTime.value = delayMs / 1000;
  sourceConnect(dryMix);
  sourceConnect(delay);
  delay.connect(filter);
  filter.connect(wetMix);
  dryMix.connect(ctx.destination);
  wetMix.connect(ctx.destination);
}

// ─── 主 API ───────────────────────────────────────────────────────

export function playBleep(kind: BleepKind): void {
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const t = bleepTemperament;
  const now = ctx.currentTime;
  const pitch = 0.94 + (t - 1) * 0.26;
  const env = 0.94 + (1 - Math.min(1.2, t)) * 0.08;
  const mainWave = pickWave();
  const rv = reverbAmount();

  switch (kind) {
    case "fire": {
      // 短促的"砰" + 噪声尖
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(940 * pitch, now);
      o.frequency.exponentialRampToValueAtTime(420 * pitch, now + 0.05);
      g.gain.setValueAtTime(0.035 * env, now);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 0.08 * env);
      o.connect(g);
      withTail(ctx, (dest) => g.connect(dest), rv * 0.4, 50);
      o.start(now);
      o.stop(now + 0.085);
      // 噪声小尖
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = makeNoise(ctx, 0.04);
      const ng = ctx.createGain();
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 2400;
      ng.gain.setValueAtTime(0.022, now);
      ng.gain.exponentialRampToValueAtTime(0.0006, now + 0.04);
      noiseSrc.connect(hp);
      hp.connect(ng);
      ng.connect(ctx.destination);
      noiseSrc.start(now);
      noiseSrc.stop(now + 0.05);
      return;
    }

    case "explode": {
      const dur = 0.32;
      // 噪声爆裂
      const noiseBuf = makeNoise(ctx, dur, "pink");
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.13, now);
      ng.gain.exponentialRampToValueAtTime(0.0006, now + dur);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(2800, now);
      lp.frequency.exponentialRampToValueAtTime(400, now + dur);
      noise.connect(lp);
      lp.connect(ng);
      withTail(ctx, (dest) => ng.connect(dest), rv * 0.8, 110);
      noise.start(now);
      noise.stop(now + dur);
      // 低频"轰"
      const boom = ctx.createOscillator();
      boom.type = "sine";
      boom.frequency.setValueAtTime(140 * t, now);
      boom.frequency.exponentialRampToValueAtTime(38 * t, now + 0.18);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.1, now);
      bg.gain.exponentialRampToValueAtTime(0.0006, now + 0.22);
      boom.connect(bg);
      bg.connect(ctx.destination);
      boom.start(now);
      boom.stop(now + 0.24);
      return;
    }

    case "pickup": {
      // 上升的二音 chime
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = sfxPack === "blocky" ? "square" : "sine";
      o.frequency.setValueAtTime(680 * pitch, now);
      o.frequency.exponentialRampToValueAtTime(1180 * pitch, now + 0.08);
      g.gain.setValueAtTime(0.05 * env, now);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 0.14 * env);
      o.connect(g);
      withTail(ctx, (dest) => g.connect(dest), rv, 80);
      o.start(now);
      o.stop(now + 0.16);
      // 高谐波加亮
      const h = ctx.createOscillator();
      const hg = ctx.createGain();
      h.type = "triangle";
      h.frequency.setValueAtTime(1180 * pitch, now);
      h.frequency.setValueAtTime(1480 * pitch, now + 0.06);
      hg.gain.setValueAtTime(0.024 * env, now);
      hg.gain.exponentialRampToValueAtTime(0.0006, now + 0.1 * env);
      h.connect(hg);
      hg.connect(ctx.destination);
      h.start(now);
      h.stop(now + 0.12);
      return;
    }

    case "hit": {
      // 失真音色：短促低音 + 噪声 click
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = sfxPack === "neon" || sfxPack === "pulse" ? "sawtooth" : "square";
      o.frequency.setValueAtTime(220 * pitch, now);
      o.frequency.exponentialRampToValueAtTime(58 * pitch, now + 0.14);
      g.gain.setValueAtTime(0.08 * env, now);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 0.18 * env);
      // 简单 wave-shaper 做轻失真
      const ws = ctx.createWaveShaper();
      const curve = new Float32Array(257);
      for (let i = 0; i < 257; i += 1) {
        const x = (i - 128) / 128;
        curve[i] = Math.tanh(x * 2.6) * 0.95;
      }
      ws.curve = curve;
      o.connect(ws);
      ws.connect(g);
      withTail(ctx, (dest) => g.connect(dest), rv * 0.6, 70);
      o.start(now);
      o.stop(now + 0.2);

      // 高频 click
      const click = ctx.createBufferSource();
      click.buffer = makeNoise(ctx, 0.025);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.045, now);
      cg.gain.exponentialRampToValueAtTime(0.0006, now + 0.03);
      const cf = ctx.createBiquadFilter();
      cf.type = "highpass";
      cf.frequency.value = 3000;
      click.connect(cf);
      cf.connect(cg);
      cg.connect(ctx.destination);
      click.start(now);
      click.stop(now + 0.035);
      return;
    }

    case "win": {
      // 上行三连音 + 银铃
      const freqs = [523, 784, 1046, 1318];
      const wave: OscillatorType = sfxPack === "blocky" ? "square" : "triangle";
      for (let i = 0; i < freqs.length; i += 1) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = wave;
        o.frequency.setValueAtTime(freqs[i]! * pitch, now + i * 0.08);
        g.gain.setValueAtTime(0.045 * env, now + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.0006, now + i * 0.08 + 0.22);
        o.connect(g);
        withTail(ctx, (dest) => g.connect(dest), rv, 90);
        o.start(now + i * 0.08);
        o.stop(now + i * 0.08 + 0.24);
      }
      return;
    }

    case "boss": {
      // 低沉滑音 + 噪声底
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(120, now);
      o.frequency.exponentialRampToValueAtTime(38, now + 0.6);
      g.gain.setValueAtTime(0.09, now);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 0.65);
      o.connect(g);
      withTail(ctx, (dest) => g.connect(dest), rv * 1.4, 140);
      o.start(now);
      o.stop(now + 0.7);
      // 风声噪音
      const noise = ctx.createBufferSource();
      noise.buffer = makeNoise(ctx, 0.5, "pink");
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.06, now);
      ng.gain.exponentialRampToValueAtTime(0.0006, now + 0.5);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 800;
      bp.Q.value = 1.5;
      noise.connect(bp);
      bp.connect(ng);
      ng.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.5);
      return;
    }

    case "levelUp": {
      // 三连快速上升
      for (let i = 0; i < 5; i += 1) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = mainWave;
        const f = 440 * Math.pow(1.25, i);
        o.frequency.setValueAtTime(f * pitch, now + i * 0.05);
        g.gain.setValueAtTime(0.04 * env, now + i * 0.05);
        g.gain.exponentialRampToValueAtTime(0.0006, now + i * 0.05 + 0.14);
        o.connect(g);
        withTail(ctx, (dest) => g.connect(dest), rv, 80);
        o.start(now + i * 0.05);
        o.stop(now + i * 0.05 + 0.16);
      }
      return;
    }

    case "shield": {
      // 充能音
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(260 * pitch, now);
      o.frequency.exponentialRampToValueAtTime(620 * pitch, now + 0.32);
      g.gain.setValueAtTime(0.045, now);
      g.gain.setValueAtTime(0.06, now + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 0.36);
      o.connect(g);
      withTail(ctx, (dest) => g.connect(dest), rv * 1.2, 110);
      o.start(now);
      o.stop(now + 0.4);
      // 二次谐波
      const h = ctx.createOscillator();
      const hg = ctx.createGain();
      h.type = "triangle";
      h.frequency.setValueAtTime(520 * pitch, now);
      h.frequency.exponentialRampToValueAtTime(1240 * pitch, now + 0.32);
      hg.gain.setValueAtTime(0.018, now);
      hg.gain.exponentialRampToValueAtTime(0.0006, now + 0.36);
      h.connect(hg);
      hg.connect(ctx.destination);
      h.start(now);
      h.stop(now + 0.4);
      return;
    }

    case "laser": {
      // 长扫频
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(2400 * pitch, now);
      o.frequency.exponentialRampToValueAtTime(640 * pitch, now + 0.4);
      g.gain.setValueAtTime(0.04, now);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 0.4);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(3600, now);
      lp.frequency.exponentialRampToValueAtTime(800, now + 0.4);
      o.connect(lp);
      lp.connect(g);
      withTail(ctx, (dest) => g.connect(dest), rv * 1.4, 120);
      o.start(now);
      o.stop(now + 0.42);
      return;
    }

    case "death": {
      // 下降滑音 + 失真低音
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(440 * pitch, now);
      o.frequency.exponentialRampToValueAtTime(60 * pitch, now + 0.5);
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 0.55);
      const ws = ctx.createWaveShaper();
      const curve = new Float32Array(257);
      for (let i = 0; i < 257; i += 1) {
        const x = (i - 128) / 128;
        curve[i] = Math.tanh(x * 3.5) * 0.95;
      }
      ws.curve = curve;
      o.connect(ws);
      ws.connect(g);
      withTail(ctx, (dest) => g.connect(dest), rv * 1.5, 160);
      o.start(now);
      o.stop(now + 0.6);
      return;
    }

    case "power": {
      // 上行扫频 + 颤音
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(420 * pitch, now);
      o.frequency.linearRampToValueAtTime(880 * pitch, now + 0.18);
      g.gain.setValueAtTime(0.055, now);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 0.26);
      // 颤音 LFO
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 7;
      lfoG.gain.value = 18;
      lfo.connect(lfoG);
      lfoG.connect(o.frequency);
      o.connect(g);
      withTail(ctx, (dest) => g.connect(dest), rv, 90);
      lfo.start(now);
      o.start(now);
      lfo.stop(now + 0.28);
      o.stop(now + 0.28);
      return;
    }
  }
}
