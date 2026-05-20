import type Phaser from "phaser";

/** 顶栏 HUD 文案：避免与标题叠字，并尽量对齐像素网格减少发糊 */
export function styleHudText(obj: Phaser.GameObjects.Text): Phaser.GameObjects.Text {
  obj.setResolution(Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2));
  if ("setRoundPixels" in obj) {
    (obj as Phaser.GameObjects.Text & { setRoundPixels: (v: boolean) => void }).setRoundPixels(true);
  }
  return obj;
}
