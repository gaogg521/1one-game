/** 已加载 PNG sprite 的缩放与样品背景透明度 */
export type RuntimeAssetQualityTier = "minimal" | "standard" | "showcase";
export type RuntimeSpriteRole = "player" | "hazard" | "collectible" | "power" | "boss";

export function fitSpriteDisplay(
  obj: Phaser.GameObjects.Image | Phaser.Physics.Arcade.Image,
  targetSize: number,
): void {
  const w = obj.width;
  const h = obj.height;
  if (w <= 0 || h <= 0) return;
  const scale = Math.max(0.1, targetSize / Math.max(w, h));
  obj.setDisplaySize(w * scale, h * scale);
}

export function firstExistingTexture(scene: Phaser.Scene, keys: readonly string[]): string | null {
  for (const key of keys) {
    if (scene.textures.exists(key)) return key;
  }
  return null;
}

/** 运行时背景图可见度下限：用户生成默认不能像淡水印一样消失。 */
export function assetBackgroundAlpha(
  projectId?: string | null,
  qualityTier: RuntimeAssetQualityTier = "standard",
): number {
  const sample = projectId?.startsWith("sample-") ?? false;
  if (qualityTier === "minimal") return sample ? 0.2 : 0.14;
  if (qualityTier === "showcase") return sample ? 0.3 : 0.24;
  return sample ? 0.24 : 0.2;
}

export function visibleSpriteTargetSize(
  role: RuntimeSpriteRole,
  qualityTier: RuntimeAssetQualityTier = "standard",
): number {
  const base: Record<RuntimeSpriteRole, number> = {
    player: 46,
    hazard: 36,
    collectible: 30,
    power: 34,
    boss: 64,
  };
  const scale = qualityTier === "minimal" ? 0.88 : qualityTier === "showcase" ? 1.14 : 1;
  return Math.round(base[role] * scale);
}

/** 样品馆背景略提高可见度，突出程序化/文生图资产 */
export function sampleBackgroundAlpha(projectId?: string | null): number {
  return assetBackgroundAlpha(projectId, "standard");
}
