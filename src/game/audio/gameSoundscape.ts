import { getSharedAudioContext, resumeSharedAudioContext } from "@/game/audio/audio-context";
import type { MusicProfile } from "@/lib/cohesive-presentation";

type SoundscapeCleanup = () => void;

/**
 * 与主题一致的轻量程序化铺底（无外部音频素材）。
 * - 与用户蜂鸣共用 AudioContext；
 * - 尊重 prefers-reduced-motion（不播放铺底）；
 * - 支持动态紧张度 setTension() 与事件 triggerEvent() 响应游戏状态。
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

  // Current dynamic state
  private currentTension: number;
  private tensionTarget: number;
  private tensionRampId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly profile: MusicProfile,
    private readonly rootHz: number,
    private readonly intensity: number,
  ) {
    this.currentTension = intensity;
    this.tensionTarget = intensity;
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
    const base =
      this.profile === "minimal" ? 0.028 : this.profile === "organic" ? 0.048 : this.profile === "neon" ? 0.058 : 0.052;
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

    this.currentTension = t;
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
    } else if (type === "danger") {
      // Slow, heavy, low
      this.lfoOsc.frequency.linearRampToValueAtTime(0.06, now + 1.5);
      this.filterNode.frequency.linearRampToValueAtTime(800, now + 1.5);
      this.masterGain.gain.linearRampToValueAtTime(0.035, now + 1.5);
    } else if (type === "victory") {
      // Bright fast sweep
      this.filterNode.frequency.cancelScheduledValues(now);
      this.filterNode.frequency.setValueAtTime(this.filterNode.frequency.value, now);
      this.filterNode.frequency.linearRampToValueAtTime(6000, now + 0.4);
      this.filterNode.frequency.linearRampToValueAtTime(3500, now + 1.2);
      this.masterGain.gain.linearRampToValueAtTime(0.08, now + 0.3);
      this.lfoOsc.frequency.linearRampToValueAtTime(0.5, now + 0.3);
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

    const master = ctx.createGain();
    const lvl = Math.min(1, Math.max(0, this.intensity));
    const base =
      this.profile === "minimal" ? 0.028 : this.profile === "organic" ? 0.048 : this.profile === "neon" ? 0.058 : 0.052;
    master.gain.setValueAtTime(base * (0.72 + lvl * 0.22), ctx.currentTime);
    master.connect(ctx.destination);
    this.masterGain = master;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.setValueAtTime(this.profile === "neon" ? 1.1 : 0.707, ctx.currentTime);
    filter.frequency.setValueAtTime(this.profile === "neon" ? 3200 + lvl * 800 : 2200 + lvl * 600, ctx.currentTime);
    filter.connect(master);
    this.filterNode = filter;

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

    // neon：极简琶音移位
    if (this.profile === "neon") {
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
    if (this.tensionRampId !== null) {
      clearInterval(this.tensionRampId);
      this.tensionRampId = null;
    }
    if (this.arpSteps != null) {
      window.clearInterval(this.arpSteps);
      this.arpSteps = null;
    }
    for (let i = this.cleanups.length - 1; i >= 0; i -= 1) {
      this.cleanups[i]!();
    }
    this.cleanups.length = 0;
    this.masterGain = null;
    this.filterNode = null;
    this.lfoOsc = null;
    this.lfoGain = null;
  }
}
