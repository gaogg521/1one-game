/** 已加载 PNG/SVG sprite 的缩放与样品背景透明度 */
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

/**
 * 加载 SVG（优先）+ PNG（回退）到场景预加载队列。
 * SVG 由文本 LLM 生成，比图片 API 快 10x；PNG 由图片 API 生成，不可用时场景回退几何体。
 */
/**
 * 加载 SVG（_svg 后缀）和 PNG（_png 后缀）到队列。
 * 使用独立后缀避免与场景内 aliasMap 冲突；场景 create 阶段用 bestSpriteKey / applySpritesOverAliasMap 整合。
 */
export function preloadSpriteSet(
  scene: Phaser.Scene,
  projectId: string,
  kinds: ReadonlyArray<"player" | "hazard" | "gem" | "power" | "boss"> = [
    "player",
    "hazard",
    "gem",
    "power",
    "boss",
  ],
): void {
  const base = `/game-sprites/${projectId}`;
  const keyMap: Record<string, string> = {
    player: "texPlayer",
    hazard: "texHazard",
    gem: "texGem",
    power: "texPower",
    boss: "texBoss",
  };
  for (const kind of kinds) {
    const key = keyMap[kind];
    if (!key) continue;
    // Use _png / _svg suffixes so they don't collide with aliasMap target keys
    scene.load.image(`${key}_png`, `${base}/${kind}.png`);
    scene.load.svg(`${key}_svg`, `${base}/${kind}.svg`, { width: 64, height: 64 });
  }
}

/**
 * 在场景 create() 的 aliasMap 之后调用：用 SVG > PNG 覆盖程序化纹理。
 * 此函数是 SVG Sprite 注入的核心——无需修改各场景的 sprites 使用代码。
 */
export function applySpritesOverAliasMap(
  scene: Phaser.Scene,
  keys: ReadonlyArray<string> = ["texPlayer", "texHazard", "texGem", "texPower", "texBoss"],
): void {
  for (const key of keys) {
    const svgKey = `${key}_svg`;
    const pngKey = `${key}_png`;
    const srcKey = scene.textures.exists(svgKey)
      ? svgKey
      : scene.textures.exists(pngKey)
        ? pngKey
        : null;
    if (!srcKey) continue;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const src = scene.textures.get(srcKey).getSourceImage();
    if (src instanceof HTMLCanvasElement) scene.textures.addCanvas(key, src);
    else if (src instanceof HTMLImageElement) scene.textures.addImage(key, src);
  }
}

/** Resolve best available sprite texture key (after aliasMap): SVG > PNG > procedural-in-base-key */
export function bestSpriteKey(
  scene: Phaser.Scene,
  kind: "player" | "hazard" | "gem" | "power" | "boss",
): string | null {
  const keyMap: Record<string, string> = {
    player: "texPlayer",
    hazard: "texHazard",
    gem: "texGem",
    power: "texPower",
    boss: "texBoss",
  };
  const base = keyMap[kind];
  if (!base) return null;
  // Check _svg and _png suffixes; base key may be procedural (set by aliasMap)
  return firstExistingTexture(scene, [`${base}_svg`, `${base}_png`, base]);
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
