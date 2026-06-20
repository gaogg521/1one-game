import type Phaser from "phaser";

/** 顶栏 HUD 文案：避免与标题叠字，并尽量对齐像素网格减少发糊 */
export function styleHudText(obj: Phaser.GameObjects.Text, opts?: { shadow?: boolean }): Phaser.GameObjects.Text {
  obj.setResolution(Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2));
  if ("setRoundPixels" in obj) {
    (obj as Phaser.GameObjects.Text & { setRoundPixels: (v: boolean) => void }).setRoundPixels(true);
  }
  if (opts?.shadow) {
    obj.setShadow(1, 1, "rgba(0,0,0,0.55)", 2, false, true);
  }
  return obj;
}

/** 顶栏副标题：长世界观句留在 Goal 面板，避免与标题/Banner 叠字发糊 */
export function hudTopSubtitleText(subtitle?: string | null, maxLen = 28): string | null {
  const s = subtitle?.trim();
  if (!s || s.length > maxLen) return null;
  return s;
}
