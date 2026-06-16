import Phaser from "phaser";
import { hexToPhaserUint, hexToRgb, type CohesivePresentation } from "@/lib/cohesive-presentation";

export type SharedJuiceStyle = {
  shakeScale: number;
  shakeDurationScale: number;
  burstScale: number;
  burstDurationScale: number;
  floaterLift: number;
  flashDurationScale: number;
  flashBoost: number;
};

const DEFAULT_SHARED_JUICE_STYLE: SharedJuiceStyle = {
  shakeScale: 1,
  shakeDurationScale: 1,
  burstScale: 1,
  burstDurationScale: 1,
  floaterLift: 1,
  flashDurationScale: 1,
  flashBoost: 1,
};

let sharedJuiceStyle = { ...DEFAULT_SHARED_JUICE_STYLE };

export type JuiceSemanticKind = "pickup" | "hit" | "combo" | "boss" | "win" | "fail";

export type JuicePreset = {
  burstCount: number;
  shakeDurationMs: number;
  shakeIntensity: number;
  flashDurationMs: number;
  flashRgb: { r: number; g: number; b: number };
  floaterPrefix?: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function brightenRgb(rgb: { r: number; g: number; b: number }, boost: number): { r: number; g: number; b: number } {
  const u = Math.max(0.7, Math.min(1.35, boost));
  return {
    r: Math.round(clamp(rgb.r * u, 0, 255)),
    g: Math.round(clamp(rgb.g * u, 0, 255)),
    b: Math.round(clamp(rgb.b * u, 0, 255)),
  };
}

export function resolveSharedJuiceStyle(
  p: Pick<CohesivePresentation, "contrastLevel" | "bleepTemperament" | "qualityTier">,
): SharedJuiceStyle {
  const contrastMap: Record<CohesivePresentation["contrastLevel"], SharedJuiceStyle> = {
    low: { shakeScale: 1.14, shakeDurationScale: 1.12, burstScale: 1.18, burstDurationScale: 1.08, floaterLift: 1.08, flashDurationScale: 1.1, flashBoost: 1.08 },
    medium: { shakeScale: 1, shakeDurationScale: 1, burstScale: 1, burstDurationScale: 1, floaterLift: 1, flashDurationScale: 1, flashBoost: 1 },
    high: { shakeScale: 0.92, shakeDurationScale: 0.96, burstScale: 0.92, burstDurationScale: 0.95, floaterLift: 0.96, flashDurationScale: 0.92, flashBoost: 0.96 },
  };
  const tierMap: Record<CohesivePresentation["qualityTier"], Pick<SharedJuiceStyle, "shakeScale" | "burstScale" | "floaterLift" | "flashBoost">> = {
    minimal: { shakeScale: 0.72, burstScale: 0.68, floaterLift: 0.82, flashBoost: 0.84 },
    standard: { shakeScale: 1.08, burstScale: 1.16, floaterLift: 1.06, flashBoost: 1.08 },
    showcase: { shakeScale: 1.24, burstScale: 1.42, floaterLift: 1.16, flashBoost: 1.22 },
  };
  const base = contrastMap[p.contrastLevel];
  const tier = tierMap[p.qualityTier];
  const temper = clamp(p.bleepTemperament, 0.65, 1.45);
  const temperamentBias = 0.88 + (temper - 1) * 0.22;
  return {
    shakeScale: clamp(base.shakeScale * temperamentBias * tier.shakeScale, 0.62, 1.55),
    shakeDurationScale: clamp(base.shakeDurationScale * (0.94 + (temper - 1) * 0.12), 0.85, 1.2),
    burstScale: clamp(base.burstScale * (0.92 + (temper - 1) * 0.18) * tier.burstScale, 0.56, 1.8),
    burstDurationScale: clamp(base.burstDurationScale * (0.95 + (temper - 1) * 0.1), 0.84, 1.18),
    floaterLift: clamp(base.floaterLift * (0.96 + (temper - 1) * 0.12) * tier.floaterLift, 0.72, 1.35),
    flashDurationScale: clamp(base.flashDurationScale * (0.92 + (temper - 1) * 0.08), 0.82, 1.16),
    flashBoost: clamp(base.flashBoost * (1.02 + (temper - 1) * 0.18) * tier.flashBoost, 0.7, 1.55),
  };
}

export function setSharedJuiceStyleFromPresentation(
  presentation: Pick<CohesivePresentation, "contrastLevel" | "bleepTemperament" | "qualityTier">,
): void {
  sharedJuiceStyle = resolveSharedJuiceStyle(presentation);
}

export function resolveJuicePreset(kind: JuiceSemanticKind, opts?: { combo?: number; large?: boolean }): JuicePreset {
  const combo = Math.max(1, opts?.combo ?? 1);
  const large = Boolean(opts?.large);
  switch (kind) {
    case "pickup":
      return {
        burstCount: large ? 16 : 10,
        shakeDurationMs: 70,
        shakeIntensity: 0.0025,
        flashDurationMs: 75,
        flashRgb: { r: 170, g: 220, b: 255 },
      };
    case "hit":
      return {
        burstCount: large ? 22 : 14,
        shakeDurationMs: 120,
        shakeIntensity: 0.006,
        flashDurationMs: 110,
        flashRgb: { r: 255, g: 105, b: 90 },
      };
    case "combo":
      return {
        burstCount: Math.min(34, 12 + combo * 3),
        shakeDurationMs: Math.min(220, 95 + combo * 18),
        shakeIntensity: Math.min(0.016, 0.004 + combo * 0.0016),
        flashDurationMs: Math.min(170, 80 + combo * 12),
        flashRgb: { r: 255, g: 206, b: 80 },
        floaterPrefix: "x",
      };
    case "boss":
      return {
        burstCount: large ? 44 : 30,
        shakeDurationMs: 260,
        shakeIntensity: 0.017,
        flashDurationMs: 190,
        flashRgb: { r: 255, g: 130, b: 60 },
      };
    case "win":
      return {
        burstCount: 36,
        shakeDurationMs: 280,
        shakeIntensity: 0.012,
        flashDurationMs: 220,
        flashRgb: { r: 130, g: 255, b: 185 },
      };
    case "fail":
      return {
        burstCount: 18,
        shakeDurationMs: 220,
        shakeIntensity: 0.014,
        flashDurationMs: 190,
        flashRgb: { r: 255, g: 72, b: 72 },
      };
  }
}

/** 统一屏幕震动强度（与导演强度略挂钩） */
export function juiceShake(
  scene: Phaser.Scene,
  opts?: { durationMs?: number; intensity?: number; intensityScale?: number },
) {
  const scale = (opts?.intensityScale ?? 1) * sharedJuiceStyle.shakeScale;
  const duration = (opts?.durationMs ?? 140) * sharedJuiceStyle.shakeDurationScale;
  const intensity = (opts?.intensity ?? 0.006) * scale;
  scene.cameras.main.shake(duration, intensity);
}

export function juiceFlash(
  scene: Phaser.Scene,
  rgb: { r: number; g: number; b: number },
  opts?: { durationMs?: number },
) {
  const boosted = brightenRgb(rgb, sharedJuiceStyle.flashBoost);
  scene.cameras.main.flash((opts?.durationMs ?? 90) * sharedJuiceStyle.flashDurationScale, boosted.r, boosted.g, boosted.b, false);
}

/** 收集/击杀等位置的粒子爆散 */
export function juiceBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  colorHex: string,
  count = 10,
  rng: () => number = Math.random,
) {
  const c = hexToPhaserUint(colorHex) ?? 0xffffff;
  const actualCount = Math.max(1, Math.round(count * sharedJuiceStyle.burstScale));
  for (let i = 0; i < actualCount; i += 1) {
    const dot = scene.add.circle(x, y, (2 + rng() * 4) * sharedJuiceStyle.burstScale, c, 0.92);
    dot.setDepth(55);
    const ang = rng() * Math.PI * 2;
    const dist = (22 + rng() * 38) * sharedJuiceStyle.burstScale;
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(ang) * dist,
      y: y + Math.sin(ang) * dist,
      alpha: 0,
      scale: 0.15,
      duration: (260 + rng() * 140) * sharedJuiceStyle.burstDurationScale,
      ease: "Quad.Out",
      onComplete: () => dot.destroy(),
    });
  }
}

export function juiceFloater(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  colorCss: string,
) {
  const t = scene.add.text(x, y, text, {
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",
    color: colorCss,
  });
  t.setOrigin(0.5);
  t.setDepth(60);
  scene.tweens.add({
    targets: t,
    y: y - 32 * sharedJuiceStyle.floaterLift,
    alpha: 0,
    duration: 720 * sharedJuiceStyle.burstDurationScale,
    ease: "Quad.Out",
    onComplete: () => t.destroy(),
  });
}

export function juiceSemantic(
  scene: Phaser.Scene,
  kind: JuiceSemanticKind,
  params: {
    x: number;
    y: number;
    colorHex: string;
    text?: string;
    textColorCss?: string;
    rng?: () => number;
    combo?: number;
    large?: boolean;
  },
) {
  const preset = resolveJuicePreset(kind, { combo: params.combo, large: params.large });
  juiceBurst(scene, params.x, params.y, params.colorHex, preset.burstCount, params.rng);
  juiceShake(scene, { durationMs: preset.shakeDurationMs, intensity: preset.shakeIntensity });
  juiceFlash(scene, preset.flashRgb, { durationMs: preset.flashDurationMs });
  if (params.text) {
    const prefix = preset.floaterPrefix ?? "";
    juiceFloater(scene, params.x, params.y - 14, `${prefix}${params.text}`, params.textColorCss ?? "#ffffff");
  }
}

export function juicePickup(scene: Phaser.Scene, params: Parameters<typeof juiceSemantic>[2]) {
  juiceSemantic(scene, "pickup", params);
}

export function juiceHit(scene: Phaser.Scene, params: Parameters<typeof juiceSemantic>[2]) {
  juiceSemantic(scene, "hit", params);
}

export function juiceCombo(scene: Phaser.Scene, params: Parameters<typeof juiceSemantic>[2]) {
  juiceSemantic(scene, "combo", params);
}

export function juiceBoss(scene: Phaser.Scene, params: Parameters<typeof juiceSemantic>[2]) {
  juiceSemantic(scene, "boss", params);
}

export function juiceWin(scene: Phaser.Scene, params: Parameters<typeof juiceSemantic>[2]) {
  juiceSemantic(scene, "win", params);
}

export function juiceFail(scene: Phaser.Scene, params: Parameters<typeof juiceSemantic>[2]) {
  juiceSemantic(scene, "fail", params);
}

export function themeParticleHex(spec: { theme: { particleTint?: string; collectibleColor?: string } }): string {
  return spec.theme.particleTint ?? spec.theme.collectibleColor ?? "#a8e6cf";
}
