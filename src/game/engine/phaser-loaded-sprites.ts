/** 已加载 PNG sprite 的缩放与样品背景透明度 */
export function fitSpriteDisplay(
  obj: Phaser.GameObjects.Image | Phaser.Physics.Arcade.Image,
  targetSize: number,
): void {
  const w = obj.width;
  const h = obj.height;
  if (w <= 0 || h <= 0) return;
  const scale = targetSize / Math.max(w, h);
  obj.setDisplaySize(w * scale, h * scale);
}

export function firstExistingTexture(scene: Phaser.Scene, keys: readonly string[]): string | null {
  for (const key of keys) {
    if (scene.textures.exists(key)) return key;
  }
  return null;
}

/** 样品馆背景略提高可见度，突出程序化/文生图资产 */
export function sampleBackgroundAlpha(projectId?: string | null): number {
  return projectId?.startsWith("sample-") ? 0.24 : 0.1;
}
