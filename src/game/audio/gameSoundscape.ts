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

/** 旋律琶音器：五声音阶，按 section 切换模式 */
class MelodicArpeggiator {
  private cleanups: SoundscapeCleanup[] = [];
  private stepInterval: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private readonly scale: number[];
  private readonly rootHz: number;
  private readonly bpm: number;
  private readonly masterGain: GainNode;
  private active = false;
  private pattern: number[] = [0, 2, 4, 2, 1, 3, 5, 3]; // 默认琶音模式

  constructor(
    private readonly ctx: AudioContext,
    private readonly destination: AudioNode,
    profile: MusicProfile,
    rootHz: number,
  ) {
    this.scale = getScaleForProfile(profile);
    this.rootHz = rootHz;
    this.bpm = bpmForProfile(profile);
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(destination);
  }

  start() {
    if (this.active) return;
    this.active = true;
    const stepMs = (60 / this.bpm / 2) * 1000; // 8分音符
    this.stepInterval = setInterval(() => this.tick(), stepMs);
  }

  stop() {
    this.active = false;
    if (this.stepInterval) {
      clearInterval(this.stepInterval);
      this.stepInterval = null;
    }
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  /** 设置琶音模式 */
  setPattern(pattern: number[]) {
    this.pattern = pattern.slice();
    this.step = 0;
  }

  /** 设置旋律强度 0-1 */
  setIntensity(intensity: number) {
    const now = this.ctx.currentTime;
    const target = Math.max(0, Math.min(1, intensity)) * 0.28;
    this.masterGain.gain.setTargetAtTime(target, now, 0.4);
  }

  private tick() {
    if (!this.active) return;
    const idx = this.pattern[this.step % this.pattern.length] ?? 0;
    const octave = Math.floor(this.step / this.pattern.length) % 2;
    const mul = this.scale[idx % this.scale.length]! * (octave === 0 ? 1 : 2);
    const freq = this.rootHz * mul;
    this.playNote(freq);
    this.step += 1;
  }

  private playNote(freq: number) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    // 轻微 detune 增加厚度
    osc.detune.setValueAtTime((Math.random() - 0.5) * 8, t);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.32);

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
  private melodicArp: MelodicArpeggiator | null = null;

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
    // Melody layer: tension > 0.4 时旋律出现，> 0.7 时旋律更密集
    this.melodicArp?.setIntensity(t > 0.4 ? (t - 0.4) / 0.6 : 0);

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

    // 更新琶音模式
    if (this.melodicArp) {
      const patterns: Record<MusicSection, number[]> = {
        intro: [0, 2, 4, 2],
        build: [0, 2, 4, 5, 4, 2],
        drop: [0, 3, 5, 3, 1, 4, 6, 4],
        climax: [0, 2, 3, 5, 4, 6, 5, 3, 1, 2],
        victory: [0, 2, 4, 5, 4, 2, 0, 1, 2],
        defeat: [0, 1, 0, 1],
      };
      this.melodicArp.setPattern(patterns[section] ?? patterns.intro);
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
      // 琶音加速
      this.melodicArp?.setIntensity(0.85);
    } else if (type === "danger") {
      // Slow, heavy, low
      this.lfoOsc.frequency.linearRampToValueAtTime(0.06, now + 1.5);
      this.filterNode.frequency.linearRampToValueAtTime(800, now + 1.5);
      this.masterGain.gain.linearRampToValueAtTime(0.035, now + 1.5);
      this.drumSequencer?.setIntensity(0.3);
      this.melodicArp?.setIntensity(0);
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
    } else if (type === "restore") {
      this.setTension(this.currentTension);
    }
  }

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

    this.melodicArp = new MelodicArpeggiator(ctx, filter, this.profile, this.rootHz);
    this.melodicArp.start();
    this.melodicArp.setIntensity(0); // 开场静音

    void this.tryTemplateBgmLoop(ctx, master);

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
    this.drumSequencer?.dispose();
    this.drumSequencer = null;
    this.melodicArp?.dispose();
    this.melodicArp = null;
    for (let i = this.cleanups.length - 1; i >= 0; i -= 1) {
      this.cleanups[i]!();
    }
    this.cleanups.length = 0;
    this.masterGain = null;
    this.filterNode = null;
    this.lfoOsc = null;
    this.lfoGain = null;
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
