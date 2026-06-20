import { getSharedAudioContext, resumeSharedAudioContext } from "@/game/audio/audio-context";
import type { MusicProfile } from "@/lib/cohesive-presentation";
import type { GameSpec } from "@/lib/game-spec";
import { resolveTemplateBgmUrl, templateBpmBias } from "@/lib/game-bgm-presets";

type SoundscapeCleanup = () => void;

export type GameSoundscapeOptions = {
  /** 明亮方块户外风（我的世界等）：更清晰的铺底与慢速五声音阶 */
  blocky?: boolean;
  /** Phase D：模板 BGM 槽 + procedural BPM 微调 */
  templateId?: GameSpec["templateId"];
  /** 项目 ID，用于拉取 LLM 降级 BGM 音符序列 */
  projectId?: string;
};

export type MusicSection = "intro" | "build" | "drop" | "climax" | "victory" | "defeat";

function profileBaseGain(profile: MusicProfile, blocky: boolean): number {
  if (blocky) return 0.072;
  if (profile === "minimal") return 0.028;
  if (profile === "organic") return 0.058;
  if (profile === "neon") return 0.062;
  return 0.060;
}

/** 五声音阶乘数（相对根音） */
const PENTATONIC_MAJOR = [1, 1.125, 1.25, 1.5, 1.667, 2, 2.25];
const PENTATONIC_MINOR = [1, 1.2, 1.25, 1.5, 1.8, 2, 2.4];
const CYBER_SCALE = [1, 1.125, 1.26, 1.5, 1.68, 2, 2.25];
const MINIMAL_INTERVALS = [1, 1.5, 2];

function getScaleForProfile(profile: MusicProfile): number[] {
  if (profile === "neon") return CYBER_SCALE;
  if (profile === "minimal") return MINIMAL_INTERVALS;
  if (profile === "organic") return PENTATONIC_MAJOR;
  return PENTATONIC_MINOR;
}

function bpmForProfile(profile: MusicProfile, templateBias = 0): number {
  const base =
    profile === "neon" ? 124 : profile === "pulse" ? 108 : profile === "organic" ? 88 : profile === "minimal" ? 72 : 96;
  return Math.max(60, Math.min(140, base + templateBias));
}

/** 程序化鼓点音序器 */
class DrumSequencer {
  private cleanups: SoundscapeCleanup[] = [];
  private stepInterval: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private readonly bpm: number;
  private readonly masterGain: GainNode;
  private active = false;

  constructor(
    private readonly ctx: AudioContext,
    private readonly destination: AudioNode,
    profile: MusicProfile,
    templateBias = 0,
  ) {
    this.bpm = bpmForProfile(profile, templateBias);
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(destination);
  }

  start() {
    if (this.active) return;
    this.active = true;
    const stepMs = (60 / this.bpm / 4) * 1000; // 16分音符
    this.stepInterval = setInterval(() => this.tick(), stepMs);
  }

  stop() {
    this.active = false;
    if (this.stepInterval) {
      clearInterval(this.stepInterval);
      this.stepInterval = null;
    }
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  /** 设置鼓点强度 0-1；0=静音，1=完整鼓组 */
  setIntensity(intensity: number) {
    const now = this.ctx.currentTime;
    const target = Math.max(0, Math.min(1, intensity)) * 0.35;
    this.masterGain.gain.setTargetAtTime(target, now, 0.3);
  }

  private tick() {
    if (!this.active) return;
    const s = this.step;
    const beat = s % 16;

    // Kick: 第0、4、10拍（变奏）
    if (beat === 0 || beat === 4 || beat === 10) {
      this.playKick();
    }
    // Snare: 第4、12拍
    if (beat === 4 || beat === 12) {
      this.playSnare();
    }
    // Hi-hat: 偶数拍，第14拍开镲
    if (beat % 2 === 0) {
      this.playHiHat(beat === 14 || beat === 6 ? "open" : "closed");
    }
    // 额外打击乐: climax 时第2、6、10、14拍加入 rimshot
    if (this.masterGain.gain.value > 0.22 && (beat === 2 || beat === 6 || beat === 10 || beat === 14)) {
      this.playRim();
    }

    this.step = s + 1;
  }

  private playKick() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.start(t);
    osc.stop(t + 0.2);

    this.cleanups.push(() => {
      try { osc.disconnect(); gain.disconnect(); } catch { /* ignore */ }
    });
  }

  private playSnare() {
    const t = this.ctx.currentTime;
    // Noise burst
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.15);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = 1 - i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * env * env;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const ng = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1200;

    noise.connect(filter);
    filter.connect(ng);
    ng.connect(this.masterGain);

    ng.gain.setValueAtTime(0.42, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    noise.start(t);
    noise.stop(t + 0.16);

    // Body tone
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    og.gain.setValueAtTime(0.18, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.12);

    this.cleanups.push(() => {
      try { noise.disconnect(); filter.disconnect(); ng.disconnect(); osc.disconnect(); og.disconnect(); } catch { /* ignore */ }
    });
  }

  private playHiHat(type: "open" | "closed") {
    const t = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * (type === "open" ? 0.3 : 0.06));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7500;
    const ng = this.ctx.createGain();

    noise.connect(filter);
    filter.connect(ng);
    ng.connect(this.masterGain);

    const dur = type === "open" ? 0.22 : 0.04;
    ng.gain.setValueAtTime(type === "open" ? 0.28 : 0.18, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.start(t);
    noise.stop(t + dur + 0.02);

    this.cleanups.push(() => {
      try { noise.disconnect(); filter.disconnect(); ng.disconnect(); } catch { /* ignore */ }
    });
  }

  private playRim() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(3200, t);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.04);

    this.cleanups.push(() => {
      try { osc.disconnect(); gain.disconnect(); } catch { /* ignore */ }
    });
  }

  dispose() {
    this.stop();
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
    try { this.masterGain.disconnect(); } catch { /* ignore */ }
  }
}

// ─── Chord Progression Engine ────────────────────────────────────────────────

/** [root, third, fifth] — multipliers relative to rootHz */
type ChordTriad = readonly [number, number, number];

/** Per-profile 4-chord progressions (just intonation ratios) */
const CHORD_PROGRESSIONS: Record<string, ChordTriad[]> = {
  neon:    [[1, 1.26, 1.5], [1.125, 1.414, 1.682], [1.5, 1.89, 2.25], [1.26, 1.587, 1.89]],
  organic: [[1, 1.25, 1.5], [1.333, 1.667, 2],     [1.5, 1.875, 2.25], [0.889, 1.125, 1.333]],
  pulse:   [[1, 1.2, 1.5],  [1.333, 1.6, 2],        [1.5, 1.8, 2.25],   [1.667, 2, 2.5]],
  minimal: [[1, 1.5, 2],    [1.333, 2, 2.667],       [1.5, 2.25, 3],     [1, 1.5, 2]],
  default: [[1, 1.25, 1.5], [1.333, 1.667, 2],       [1.5, 1.875, 2.25], [1.667, 2.083, 2.5]],
};

class ChordEngine {
  private chordIdx = 0;
  private onChangeCb: (() => void) | null = null;
  private readonly progression: ChordTriad[];

  constructor(profile: MusicProfile) {
    this.progression = CHORD_PROGRESSIONS[profile] ?? CHORD_PROGRESSIONS.default!;
  }

  onChordChange(cb: () => void) { this.onChangeCb = cb; }

  advance(): ChordTriad {
    this.chordIdx = (this.chordIdx + 1) % this.progression.length;
    this.onChangeCb?.();
    return this.current();
  }

  current(): ChordTriad {
    return this.progression[this.chordIdx] ?? this.progression[0]!;
  }
}

// ─── Bass Line ───────────────────────────────────────────────────────────────

class BassLine {
  private cleanups: SoundscapeCleanup[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private chord: ChordTriad = [1, 1.25, 1.5];
  private readonly masterGain: GainNode;
  private active = false;
  private beat = 0;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    private readonly rootHz: number,
    private readonly bpm: number,
  ) {
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(destination);
  }

  start() {
    if (this.active) return;
    this.active = true;
    const beatMs = (60 / this.bpm) * 1000;
    this.timer = setInterval(() => {
      if (!this.active) return;
      if (this.beat % 4 === 0) this.pluck(this.beat % 8 === 0 ? 1 : 0.6);
      this.beat = (this.beat + 1) % 16;
    }, beatMs);
  }

  stop() {
    this.active = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
  }

  updateChord(chord: ChordTriad) { this.chord = chord; }

  setIntensity(v: number) {
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.5, this.ctx.currentTime, 0.4);
  }

  private pluck(vel: number) {
    const t = this.ctx.currentTime;
    const freq = this.rootHz * this.chord[0] * 0.5; // one octave below root
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.setTargetAtTime(freq * 0.978, t + 0.03, 0.07);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
    osc.connect(g); g.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.52);
    this.cleanups.push(() => { try { osc.disconnect(); g.disconnect(); } catch { /**/ } });
  }

  dispose() {
    this.stop();
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
    try { this.masterGain.disconnect(); } catch { /**/ }
  }
}

// ─── Chord Pad ───────────────────────────────────────────────────────────────

class ChordPad {
  private cleanups: SoundscapeCleanup[] = [];
  private readonly masterGain: GainNode;
  private liveNodes: Array<{ osc: OscillatorNode; g: GainNode }> = [];
  private active = false;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    private readonly rootHz: number,
  ) {
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(destination);
  }

  start(chord: ChordTriad) {
    if (this.active) return;
    this.active = true;
    this.spawnChord(chord, 1.0);
  }

  crossfadeTo(chord: ChordTriad) {
    if (!this.active) return;
    for (const n of this.liveNodes) {
      n.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.28);
      const { osc, g } = n;
      setTimeout(() => { try { osc.stop(); osc.disconnect(); g.disconnect(); } catch { /**/ } }, 1100);
    }
    this.liveNodes = [];
    this.spawnChord(chord, 0.8);
  }

  setIntensity(v: number) {
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.038, this.ctx.currentTime, 0.55);
  }

  private spawnChord(chord: ChordTriad, attackTau: number) {
    const t = this.ctx.currentTime;
    for (const mul of chord) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(this.rootHz * mul, t);
      osc.detune.setValueAtTime((Math.random() - 0.5) * 7, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.setTargetAtTime(1.0, t, attackTau * 0.38);
      osc.connect(g); g.connect(this.masterGain);
      osc.start(t);
      this.liveNodes.push({ osc, g });
      this.cleanups.push(() => { try { osc.stop(); osc.disconnect(); g.disconnect(); } catch { /**/ } });
    }
  }

  dispose() {
    this.active = false;
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
    try { this.masterGain.disconnect(); } catch { /**/ }
  }
}

// ─── Chord-aware Melody ───────────────────────────────────────────────────────

/** 旋律层：基于当前和弦音 + 经过音，按 section 切换模式 */
class ChordMelody {
  private cleanups: SoundscapeCleanup[] = [];
  private stepInterval: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private readonly scale: number[];
  private readonly bpm: number;
  private readonly masterGain: GainNode;
  private active = false;
  private chord: ChordTriad = [1, 1.25, 1.5];
  // pattern values: 0/1/2 = chord root/third/fifth; 3+ = scale passing tones
  private pattern: number[] = [0, 1, 2, 1, 0, 3, 1, 2];

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    profile: MusicProfile,
    private readonly rootHz: number,
  ) {
    this.scale = getScaleForProfile(profile);
    this.bpm = bpmForProfile(profile);
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(destination);
  }

  start() {
    if (this.active) return;
    this.active = true;
    const stepMs = (60 / this.bpm / 2) * 1000; // 8th notes
    this.stepInterval = setInterval(() => this.tick(), stepMs);
  }

  stop() {
    this.active = false;
    if (this.stepInterval) { clearInterval(this.stepInterval); this.stepInterval = null; }
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  setChord(chord: ChordTriad) { this.chord = chord; this.step = 0; }

  setPattern(pattern: number[]) { this.pattern = pattern.slice(); this.step = 0; }

  setIntensity(intensity: number) {
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, intensity)) * 0.24, this.ctx.currentTime, 0.4);
  }

  private tick() {
    if (!this.active) return;
    const patIdx = this.pattern[this.step % this.pattern.length] ?? 0;
    const bar = Math.floor(this.step / this.pattern.length);
    let freq: number;
    if (patIdx < 3) {
      // Chord tone
      const octaveMul = bar % 2 === 0 ? 2 : 4;
      freq = this.rootHz * (this.chord[patIdx] ?? 1) * octaveMul * 0.5;
    } else {
      // Scale passing tone
      const scaleFreq = this.scale[(patIdx - 3) % this.scale.length] ?? 1;
      freq = this.rootHz * scaleFreq * 2;
    }
    this.playNote(freq);
    this.step += 1;
  }

  private playNote(freq: number) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.setValueAtTime((Math.random() - 0.5) * 8, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.13, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g); g.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.34);
    this.cleanups.push(() => { try { osc.disconnect(); g.disconnect(); } catch { /**/ } });
  }

  dispose() {
    this.stop();
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
    try { this.masterGain.disconnect(); } catch { /**/ }
  }
}

/** 独奏旋律线：每拍一个音符，带 vibrato 与滑音，比琶音层更突出 */
class LeadMelody {
  private cleanups: SoundscapeCleanup[] = [];
  private stepInterval: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private active = false;
  private readonly masterGain: GainNode;
  private readonly bpm: number;
  private readonly scale: number[];
  private chord: ChordTriad = [1, 1.25, 1.5];
  // motif: relative scale degree indices (0-based)
  private motif: number[] = [0, 2, 4, 3, 2, 0, 1, 4];

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    profile: MusicProfile,
    private readonly rootHz: number,
    templateBias = 0,
  ) {
    this.scale = getScaleForProfile(profile);
    this.bpm = bpmForProfile(profile, templateBias);
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(destination);
  }

  start() {
    if (this.active) return;
    this.active = true;
    // Quarter-note lead (slower, more melodic than chord arpeggio)
    const stepMs = (60 / this.bpm) * 1000;
    this.stepInterval = setInterval(() => this.tick(), stepMs);
  }

  stop() {
    this.active = false;
    if (this.stepInterval) { clearInterval(this.stepInterval); this.stepInterval = null; }
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  }

  setChord(chord: ChordTriad) { this.chord = chord; }
  setMotif(motif: number[]) { this.motif = motif.slice(); this.step = 0; }

  setIntensity(intensity: number) {
    const vol = Math.max(0, Math.min(1, intensity)) * 0.18;
    this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.5);
  }

  private tick() {
    if (!this.active) return;
    const degreeIdx = this.motif[this.step % this.motif.length] ?? 0;
    const scaleMul = this.scale[degreeIdx % this.scale.length] ?? 1;
    // Alternate octaves for variety: every 8 steps go up an octave
    const octave = Math.floor(this.step / 8) % 2 === 0 ? 2 : 4;
    const freq = this.rootHz * scaleMul * octave * 0.5;
    this.playNote(freq);
    this.step += 1;
    void this.chord;
  }

  private playNote(freq: number) {
    const t = this.ctx.currentTime;
    const dur = (60 / this.bpm) * 0.85;

    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    // Vibrato via LFO on detune
    const vib = this.ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vibG = this.ctx.createGain();
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(12, t + dur * 0.4);
    vib.connect(vibG);
    vibG.connect(osc.detune);
    vib.start(t);
    vib.stop(t + dur);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.5, t + 0.04);
    env.gain.setTargetAtTime(0.3, t + 0.04, 0.08);
    env.gain.setTargetAtTime(0.001, t + dur * 0.7, 0.05);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + dur + 0.06);

    this.cleanups.push(() => {
      try { osc.disconnect(); vib.disconnect(); vibG.disconnect(); env.disconnect(); } catch { /**/ }
    });
  }

  dispose() {
    this.stop();
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
    try { this.masterGain.disconnect(); } catch { /**/ }
  }
}

/**
 * 与主题一致的程序化音乐系统（无外部音频素材）。
 * - 分层架构：铺底（drone）+ 鼓点（drums）+ 旋律（melody）
 * - 按章节/阶段动态叠加层次
 * - 击杀/事件时触发音乐 stinger
 * - 尊重 prefers-reduced-motion（不播放铺底）
 */
export class GameSoundscape {
  private cleanups: SoundscapeCleanup[] = [];
  private arpSteps: number | null = null;
  private started = false;

  // Live audio nodes (available after startInteractive)
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private lfoGain: GainNode | null = null;
  private lfoOsc: OscillatorNode | null = null;

  // Drum and melody layers
  private drumSequencer: DrumSequencer | null = null;
  private melodicArp: ChordMelody | null = null;
  private leadMelody: LeadMelody | null = null;
  private chordEngine: ChordEngine | null = null;
  private bassLine: BassLine | null = null;
  private chordPad: ChordPad | null = null;
  private chordTimer: ReturnType<typeof setInterval> | null = null;

  // Current dynamic state
  private currentTension: number;
  private tensionTarget: number;
  private tensionRampId: ReturnType<typeof setInterval> | null = null;
  private currentSection: MusicSection = "intro";
  private templateAudio: HTMLAudioElement | null = null;

  constructor(
    private readonly profile: MusicProfile,
    private readonly rootHz: number,
    private readonly intensity: number,
    private readonly opts: GameSoundscapeOptions = {},
  ) {
    this.currentTension = intensity;
    this.tensionTarget = intensity;
  }

  private get blocky(): boolean {
    return this.opts.blocky === true;
  }

  /**
   * 平滑过渡到新的紧张度（0=平静, 1=极度紧张）。
   * 影响 master 音量、滤波截止频率、LFO 速度。
   */
  setTension(target: number) {
    if (!this.started) return;
    const t = Math.min(1, Math.max(0, target));
    this.tensionTarget = t;

    if (this.tensionRampId !== null) {
      clearInterval(this.tensionRampId);
      this.tensionRampId = null;
    }

    const ctx = getSharedAudioContext();
    if (!ctx || !this.masterGain || !this.filterNode || !this.lfoOsc) return;

    const now = ctx.currentTime;
    const rampTime = 1.2;

    // Master gain
    const base = profileBaseGain(this.profile, this.blocky);
    const targetGain = base * (0.72 + t * 0.28);
    this.masterGain.gain.linearRampToValueAtTime(targetGain, now + rampTime);

    // Filter frequency: higher tension → more high-freq content
    const baseFreq = this.profile === "neon" ? 3200 : 2200;
    const freqTarget = baseFreq + t * 1400;
    this.filterNode.frequency.linearRampToValueAtTime(freqTarget, now + rampTime);

    // LFO speed: higher tension → faster breathing
    const lfoFreq = this.profile === "pulse" ? 0.18 : 0.11;
    const lfoTarget = lfoFreq + t * 0.32;
    this.lfoOsc.frequency.linearRampToValueAtTime(lfoTarget, now + rampTime);

    // Drum layer: tension 越高鼓点越强
    this.drumSequencer?.setIntensity(t);
    // Chord arp: tension > 0.4 时出现
    this.melodicArp?.setIntensity(t > 0.4 ? (t - 0.4) / 0.6 : 0);
    // Lead melody: tension > 0.55 时才出现，比琶音晚一步
    this.leadMelody?.setIntensity(t > 0.55 ? (t - 0.55) / 0.45 * 0.9 : 0);
    // Bass + chord pad: proportional to tension
    this.bassLine?.setIntensity(t);
    this.chordPad?.setIntensity(t * 0.7);

    this.currentTension = t;
  }

  /**
   * 按章节切换音乐层次（intro → build → drop → climax → victory/defeat）
   */
  setSection(section: MusicSection) {
    if (!this.started) return;
    this.currentSection = section;

    const ctx = getSharedAudioContext();
    if (!ctx) return;

    // 更新琶音模式（0/1/2=和弦音, 3+=经过音）
    if (this.melodicArp) {
      const patterns: Record<MusicSection, number[]> = {
        intro:   [0, 1, 2, 1],
        build:   [0, 1, 2, 3, 2, 1],
        drop:    [0, 3, 2, 3, 1, 4, 2, 1],
        climax:  [0, 2, 1, 3, 2, 4, 1, 3, 0, 2],
        victory: [0, 2, 1, 2, 0, 3, 1, 2],
        defeat:  [0, 1, 0, 1],
      };
      this.melodicArp.setPattern(patterns[section] ?? patterns.intro);
    }
    // Lead melody motifs per section (scale degree indices)
    if (this.leadMelody) {
      const motifs: Record<MusicSection, number[]> = {
        intro:   [0, 2, 4, 2],
        build:   [0, 2, 4, 3, 2, 0],
        drop:    [4, 3, 2, 0, 1, 3, 4, 2],
        climax:  [0, 4, 3, 5, 4, 2, 1, 3, 0, 4],
        victory: [0, 2, 4, 6, 4, 2, 0, 2],
        defeat:  [4, 2, 1, 0],
      };
      this.leadMelody.setMotif(motifs[section] ?? motifs.intro);
    }

    // 根据章节调整鼓点和铺底
    switch (section) {
      case "intro":
        this.drumSequencer?.setIntensity(0);
        this.setTension(0.25);
        break;
      case "build":
        this.drumSequencer?.setIntensity(0.45);
        this.setTension(0.5);
        break;
      case "drop":
        this.drumSequencer?.setIntensity(0.75);
        this.setTension(0.72);
        break;
      case "climax":
        this.drumSequencer?.setIntensity(1);
        this.setTension(0.92);
        break;
      case "victory":
        this.drumSequencer?.setIntensity(0.35);
        this.triggerEvent("victory");
        break;
      case "defeat":
        this.drumSequencer?.setIntensity(0);
        this.triggerEvent("danger");
        break;
    }
  }

  /** 击杀/收集时短暂的音乐 stinger */
  triggerKillStinger() {
    if (!this.started) return;
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const scale = getScaleForProfile(this.profile);
    const tension = Math.max(0, Math.min(1, this.currentTension));
    const burstCount = tension > 0.72 ? 3 : tension > 0.35 ? 2 : 1;
    const baseIdx = tension > 0.72 ? 4 : 3;
    const interval = this.profile === "minimal" ? 0.07 : this.profile === "neon" ? 0.06 : 0.08;
    for (let i = 0; i < burstCount; i += 1) {
      const idx = baseIdx + i;
      const freq = this.rootHz * (scale[idx] ?? scale[scale.length - 1] ?? 2);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = this.profile === "neon" ? "sawtooth" : tension > 0.7 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, t + i * interval);
      osc.frequency.exponentialRampToValueAtTime(freq * (1.24 + tension * 0.28), t + i * interval + 0.08);
      gain.gain.setValueAtTime(0.075 + tension * 0.018, t + i * interval);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * interval + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + i * interval);
      osc.stop(t + i * interval + 0.16);
      this.cleanups.push(() => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          /* ignore */
        }
      });
    }
  }

  /** 波次/关卡开始时升级音乐 */
  triggerWaveStart(waveIndex: number, totalWaves: number) {
    if (!this.started || totalWaves <= 0) return;
    const ratio = waveIndex / totalWaves;
    if (ratio < 0.25) this.setSection("intro");
    else if (ratio < 0.5) this.setSection("build");
    else if (ratio < 0.75) this.setSection("drop");
    else this.setSection("climax");
  }

  /**
   * 触发特定游戏事件对应的音乐状态：
   * - 'boss': 骤然拔高紧张度，短时冲击滤波
   * - 'danger': 低频沉重感（降调 + 慢 LFO）
   * - 'victory': 亮度提升，快速明亮扫频
   * - 'restore': 恢复到正常 intensity
   */
  triggerEvent(type: "boss" | "danger" | "victory" | "restore") {
    if (!this.started) return;
    const ctx = getSharedAudioContext();
    if (!ctx || !this.filterNode || !this.lfoOsc || !this.masterGain) return;
    const now = ctx.currentTime;

    if (type === "boss") {
      // Sharp cutoff sweep + high tension
      this.filterNode.frequency.cancelScheduledValues(now);
      this.filterNode.frequency.setValueAtTime(this.filterNode.frequency.value, now);
      this.filterNode.frequency.linearRampToValueAtTime(4800, now + 0.3);
      this.filterNode.frequency.linearRampToValueAtTime(1800, now + 1.0);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.1, now + 0.4);
      this.lfoOsc.frequency.setValueAtTime(0.45, now);
      // Boss 时鼓点变密集
      this.drumSequencer?.setIntensity(1);
      this.melodicArp?.setIntensity(0.85);
      this.bassLine?.setIntensity(1);
      this.chordPad?.setIntensity(0.7);
    } else if (type === "danger") {
      // Slow, heavy, low
      this.lfoOsc.frequency.linearRampToValueAtTime(0.06, now + 1.5);
      this.filterNode.frequency.linearRampToValueAtTime(800, now + 1.5);
      this.masterGain.gain.linearRampToValueAtTime(0.035, now + 1.5);
      this.drumSequencer?.setIntensity(0.3);
      this.melodicArp?.setIntensity(0);
      this.bassLine?.setIntensity(0.4);
      this.chordPad?.setIntensity(0.2);
    } else if (type === "victory") {
      // Bright fast sweep
      this.filterNode.frequency.cancelScheduledValues(now);
      this.filterNode.frequency.setValueAtTime(this.filterNode.frequency.value, now);
      this.filterNode.frequency.linearRampToValueAtTime(6000, now + 0.4);
      this.filterNode.frequency.linearRampToValueAtTime(3500, now + 1.2);
      this.masterGain.gain.linearRampToValueAtTime(0.08, now + 0.3);
      this.lfoOsc.frequency.linearRampToValueAtTime(0.5, now + 0.3);
      this.drumSequencer?.setIntensity(0.25);
      this.melodicArp?.setIntensity(0.6);
      this.bassLine?.setIntensity(0.5);
      this.chordPad?.setIntensity(0.5);
    } else if (type === "restore") {
      this.setTension(this.currentTension);
    }
  }

  /** setTension 的别名，供外部场景使用 */
  setIntensity(v: number) { this.setTension(v); }

  /** 在用户首次触控后调用，以满足自动播放策略。 */
  async startInteractive(): Promise<void> {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = getSharedAudioContext();
    if (!ctx) return;
    await resumeSharedAudioContext();
    if (this.cleanups.length > 0) return;

    this.started = true;

    const templateBias = this.opts.templateId ? templateBpmBias(this.opts.templateId) : 0;

    const master = ctx.createGain();
    const lvl = Math.min(1, Math.max(0, this.intensity));
    const base = profileBaseGain(this.profile, this.blocky);
    master.gain.setValueAtTime(base * (0.72 + lvl * 0.22), ctx.currentTime);
    master.connect(ctx.destination);
    this.masterGain = master;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.setValueAtTime(this.profile === "neon" ? 1.1 : 0.707, ctx.currentTime);
    filter.frequency.setValueAtTime(this.profile === "neon" ? 3200 + lvl * 800 : 2200 + lvl * 600, ctx.currentTime);
    filter.connect(master);
    this.filterNode = filter;

    // 初始化鼓点和旋律层（连接到 filter 前）
    this.drumSequencer = new DrumSequencer(ctx, filter, this.profile, templateBias);
    this.drumSequencer.start();
    this.drumSequencer.setIntensity(0); // 开场静音

    this.chordEngine = new ChordEngine(this.profile);
    const bpmFinal = bpmForProfile(this.profile) + templateBias;
    this.bassLine = new BassLine(ctx, filter, this.rootHz, bpmFinal);
    this.bassLine.start();
    this.bassLine.setIntensity(0);

    const initChord = this.chordEngine.current();
    this.chordPad = new ChordPad(ctx, filter, this.rootHz);
    this.chordPad.start(initChord);
    this.chordPad.setIntensity(0);

    this.melodicArp = new ChordMelody(ctx, filter, this.profile, this.rootHz);
    this.melodicArp.setChord(initChord);
    this.melodicArp.start();
    this.melodicArp.setIntensity(0); // 开场静音

    // Lead melody: solo line on top, 0.5 octave above arp
    this.leadMelody = new LeadMelody(ctx, filter, this.profile, this.rootHz * 1.5, templateBias);
    this.leadMelody.setChord(initChord);
    this.leadMelody.start();
    this.leadMelody.setIntensity(0);

    // 按 BPM 推进和弦进行（每 4 拍换一个和弦）
    const beatsPerChord = 4;
    const chordIntervalMs = (60 / (bpmForProfile(this.profile) + templateBias)) * beatsPerChord * 1000;
    this.chordTimer = setInterval(() => {
      const chord = this.chordEngine!.advance();
      this.chordPad?.crossfadeTo(chord);
      this.melodicArp?.setChord(chord);
      this.leadMelody?.setChord(chord);
      this.bassLine?.updateChord(chord);
    }, chordIntervalMs);
    this.cleanups.push(() => {
      if (this.chordTimer !== null) { clearInterval(this.chordTimer); this.chordTimer = null; }
    });

    void this.tryTemplateBgmLoop(ctx, master);
    void this.tryLlmNoteBgm(ctx, master);

    const now = ctx.currentTime;
    const root = this.rootHz;
    const freqs =
      this.profile === "minimal"
        ? [root, root * 1.5]
        : this.profile === "neon"
          ? [root * 1.02, root * 1.26, root * 1.5]
          : [root, root * 1.25, root * 1.5];

    for (let i = 0; i < freqs.length; i += 1) {
      const osc = ctx.createOscillator();
      osc.type = this.profile === "organic" ? "triangle" : "sine";
      const detune = (i - 1) * (this.profile === "neon" ? 9 : 6);
      osc.frequency.setValueAtTime(freqs[i]!, now);
      osc.detune.setValueAtTime(detune, now);
      const g = ctx.createGain();
      const step = 0.14 / freqs.length;
      g.gain.setValueAtTime(step * (this.profile === "minimal" ? 0.55 : 1), now);
      osc.connect(g);
      g.connect(filter);
      osc.start(now);
      this.cleanups.push(() => {
        try { osc.stop(); osc.disconnect(); g.disconnect(); } catch { /* ignore */ }
      });
    }

    // 极轻粉噪增加空间感
    if (this.profile !== "minimal") {
      const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * 0.35;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      noise.loop = true;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(this.profile === "neon" ? 0.012 : 0.008, now);
      noise.connect(ng);
      ng.connect(filter);
      noise.start(now);
      this.cleanups.push(() => {
        try { noise.stop(); noise.disconnect(); ng.disconnect(); } catch { /* ignore */ }
      });
    }

    // 慢速滤波呼吸 LFO
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(this.profile === "pulse" ? 0.18 : 0.11, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(this.profile === "neon" ? 420 : 280, now);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(now);
    this.lfoOsc = lfo;
    this.lfoGain = lfoGain;

    this.cleanups.push(() => {
      try { lfo.stop(); lfo.disconnect(); lfoGain.disconnect(); } catch { /* ignore */ }
    });

    // 方块户外：五声音阶琶音 + 低音铺底（C418 式舒缓冒险感）
    if (this.blocky) {
      const pent = [1, 1.125, 1.25, 1.5, 1.667, 2];
      let step = 0;
      const arpOsc = ctx.createOscillator();
      arpOsc.type = "square";
      arpOsc.frequency.setValueAtTime(root * pent[0]!, now);
      const arpFilter = ctx.createBiquadFilter();
      arpFilter.type = "lowpass";
      arpFilter.frequency.setValueAtTime(2400, now);
      arpFilter.Q.setValueAtTime(0.5, now);
      const ag = ctx.createGain();
      ag.gain.setValueAtTime(0.032, now);
      arpOsc.connect(arpFilter);
      arpFilter.connect(ag);
      ag.connect(filter);
      arpOsc.start(now);

      const bass = ctx.createOscillator();
      bass.type = "triangle";
      bass.frequency.setValueAtTime(root * 0.5, now);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.055, now);
      bass.connect(bg);
      bg.connect(filter);
      bass.start(now);

      const id = window.setInterval(() => {
        step += 1;
        const mul = pent[step % pent.length]!;
        try {
          arpOsc.frequency.setTargetAtTime(root * mul, ctx.currentTime, 0.06);
        } catch {
          /* ignore */
        }
      }, 560);
      this.arpSteps = id;
      this.cleanups.push(() => {
        window.clearInterval(id);
        this.arpSteps = null;
        try {
          arpOsc.stop();
          arpOsc.disconnect();
          arpFilter.disconnect();
          ag.disconnect();
          bass.stop();
          bass.disconnect();
          bg.disconnect();
        } catch {
          /* ignore */
        }
      });
    }

    // neon：极简琶音移位
    if (this.profile === "neon" && !this.blocky) {
      let step = 0;
      const arpOsc = ctx.createOscillator();
      arpOsc.type = "triangle";
      arpOsc.frequency.setValueAtTime(root * (step % 3 === 0 ? 1 : step % 3 === 1 ? 1.25 : 1.5), ctx.currentTime);
      const ag = ctx.createGain();
      ag.gain.setValueAtTime(0.018, ctx.currentTime);
      arpOsc.connect(ag);
      ag.connect(filter);
      arpOsc.start(ctx.currentTime);
      const id = window.setInterval(() => {
        step += 1;
        const mul = step % 4 === 0 ? 1 : step % 4 === 1 ? 1.26 : step % 4 === 2 ? 1.5 : 1.18;
        try { arpOsc.frequency.setTargetAtTime(root * mul, ctx.currentTime, 0.04); } catch { /* ignore */ }
      }, 420);
      this.arpSteps = id;
      this.cleanups.push(() => {
        window.clearInterval(id);
        this.arpSteps = null;
        try { arpOsc.stop(); arpOsc.disconnect(); ag.disconnect(); } catch { /* ignore */ }
      });
    }

    this.cleanups.push(() => {
      try { filter.disconnect(); master.disconnect(); } catch { /* ignore */ }
    });
  }

  dispose(): void {
    this.started = false;
    if (this.templateAudio) {
      try {
        this.templateAudio.pause();
        this.templateAudio.src = "";
      } catch {
        /* ignore */
      }
      this.templateAudio = null;
    }
    if (this.tensionRampId !== null) {
      clearInterval(this.tensionRampId);
      this.tensionRampId = null;
    }
    if (this.arpSteps != null) {
      window.clearInterval(this.arpSteps);
      this.arpSteps = null;
    }
    // Dispose drum and melody layers first
    if (this.chordTimer !== null) { clearInterval(this.chordTimer); this.chordTimer = null; }
    this.drumSequencer?.dispose();
    this.drumSequencer = null;
    this.melodicArp?.dispose();
    this.melodicArp = null;
    this.leadMelody?.dispose();
    this.leadMelody = null;
    this.bassLine?.dispose();
    this.bassLine = null;
    this.chordPad?.dispose();
    this.chordPad = null;
    this.chordEngine = null;
    for (let i = this.cleanups.length - 1; i >= 0; i -= 1) {
      this.cleanups[i]!();
    }
    this.cleanups.length = 0;
    this.masterGain = null;
    this.filterNode = null;
    this.lfoOsc = null;
    this.lfoGain = null;
  }

  /** LLM 降级 BGM：无第三方 API Key 时从服务端拉取音符序列并用 Web Audio 播放 */
  private async tryLlmNoteBgm(ctx: AudioContext, master: GainNode): Promise<void> {
    const pid = this.opts.projectId;
    if (!pid || typeof window === "undefined") return;
    try {
      const res = await fetch(`/api/projects/${pid}/bgm`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) return;
      const body = (await res.json()) as { skip?: boolean; notes?: { bpm: number; notes: Array<{ freq: number; dur: number; vol?: number }> } };
      if (body.skip || !body.notes) return;

      const { bpm, notes } = body.notes;
      const beatSec = 60 / bpm;
      const gain = ctx.createGain();
      gain.gain.value = 0.18;
      gain.connect(master);

      let cancelled = false;
      this.cleanups.push(() => { cancelled = true; gain.disconnect(); });

      // Schedule the sequence in a loop using AudioContext scheduling
      const scheduleLoop = (startTime: number) => {
        if (cancelled) return;
        let t = startTime;
        for (const n of notes) {
          if (cancelled) return;
          const dur = n.dur * beatSec;
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = n.freq;
          const vol = n.vol ?? 0.6;
          env.gain.setValueAtTime(0, t);
          env.gain.linearRampToValueAtTime(vol, t + 0.02);
          env.gain.setValueAtTime(vol, t + dur * 0.7);
          env.gain.linearRampToValueAtTime(0, t + dur * 0.95);
          osc.connect(env);
          env.connect(gain);
          osc.start(t);
          osc.stop(t + dur);
          t += dur;
        }
        // Re-schedule next loop before this one ends
        const loopDur = t - startTime;
        if (!cancelled) {
          const nextId = setTimeout(() => scheduleLoop(startTime + loopDur), (loopDur - 1) * 1000);
          this.cleanups.push(() => clearTimeout(nextId));
        }
      };

      scheduleLoop(ctx.currentTime + 0.1);
    } catch {
      /* ignore, procedural BGM continues */
    }
  }

  /** 若 public/game-bgm/{template}-{profile}.ogg 存在则与 procedural 混音 */
  private async tryTemplateBgmLoop(ctx: AudioContext, master: GainNode): Promise<void> {
    const tid = this.opts.templateId;
    if (!tid || typeof window === "undefined") return;
    const url = resolveTemplateBgmUrl(tid, this.profile);
    try {
      const probe = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(4000) });
      if (!probe.ok) return;
      const audio = new Audio(url);
      audio.loop = true;
      audio.crossOrigin = "anonymous";
      const track = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      gain.gain.value = 0.24;
      track.connect(gain);
      gain.connect(master);
      await audio.play();
      this.templateAudio = audio;
      this.cleanups.push(() => {
        try {
          audio.pause();
          audio.src = "";
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* procedural only */
    }
  }
}
