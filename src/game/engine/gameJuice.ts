import Phaser from "phaser";
import { hexToPhaserUint } from "@/lib/cohesive-presentation";

/** 统一屏幕震动强度（与导演强度略挂钩） */
export function juiceShake(
  scene: Phaser.Scene,
  opts?: { durationMs?: number; intensity?: number; intensityScale?: number },
) {
  const scale = opts?.intensityScale ?? 1;
  const duration = opts?.durationMs ?? 140;
  const intensity = (opts?.intensity ?? 0.006) * scale;
  scene.cameras.main.shake(duration, intensity);
}

export function juiceFlash(
  scene: Phaser.Scene,
  rgb: { r: number; g: number; b: number },
  opts?: { durationMs?: number },
) {
  scene.cameras.main.flash(opts?.durationMs ?? 90, rgb.r, rgb.g, rgb.b, false);
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
  for (let i = 0; i < count; i += 1) {
    const dot = scene.add.circle(x, y, 2 + rng() * 4, c, 0.92);
    dot.setDepth(55);
    const ang = rng() * Math.PI * 2;
    const dist = 22 + rng() * 38;
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(ang) * dist,
      y: y + Math.sin(ang) * dist,
      alpha: 0,
      scale: 0.15,
      duration: 260 + rng() * 140,
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
    y: y - 32,
    alpha: 0,
    duration: 720,
    ease: "Quad.Out",
    onComplete: () => t.destroy(),
  });
}

export function themeParticleHex(spec: { theme: { particleTint?: string; collectibleColor?: string } }): string {
  return spec.theme.particleTint ?? spec.theme.collectibleColor ?? "#a8e6cf";
}
