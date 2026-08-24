type AssetLike = {
  backgroundUrl?: unknown;
  sprites?: unknown;
  manifest?: { slots?: unknown } | null;
};

export type GameAssetReadiness = {
  ok: boolean;
  evidence: string[];
};

function hasUrl(value: unknown): value is string {
  return typeof value === "string" && value.trim().startsWith("/");
}

/**
 * Publishing relies on the asset artifact written by the durable worker, not
 * a browser-session manifest. This prevents a game whose background or core
 * actors silently fell back to placeholder geometry from being discoverable.
 */
export function assessGameAssetReadiness(raw: unknown): GameAssetReadiness {
  if (!raw || typeof raw !== "object") {
    return { ok: false, evidence: ["publication_asset_manifest_missing"] };
  }
  const asset = raw as AssetLike;
  const sprites = Array.isArray(asset.sprites) ? asset.sprites : [];
  const spriteUrls = new Map(
    sprites
      .filter((entry): entry is { kind?: unknown; url?: unknown } => Boolean(entry && typeof entry === "object"))
      .filter((entry) => typeof entry.kind === "string" && hasUrl(entry.url))
      .map((entry) => [entry.kind as string, entry.url as string]),
  );
  const slots = Array.isArray(asset.manifest?.slots) ? asset.manifest.slots : [];
  const slotNames = new Set(
    slots
      .filter((entry): entry is { slot?: unknown; url?: unknown } => Boolean(entry && typeof entry === "object"))
      .filter((entry) => typeof entry.slot === "string" && hasUrl(entry.url))
      .map((entry) => entry.slot as string),
  );
  const issues: string[] = [];
  if (!hasUrl(asset.backgroundUrl) || !slotNames.has("background")) issues.push("publication_background_asset_missing");
  if (!spriteUrls.has("player") || !slotNames.has("player")) issues.push("publication_player_asset_missing");
  if (!spriteUrls.has("hazard") || !slotNames.has("enemy")) issues.push("publication_enemy_asset_missing");
  return {
    ok: issues.length === 0,
    evidence: [
      `publication_asset_sprites:${spriteUrls.size}`,
      `publication_asset_slots:${slotNames.size}`,
      ...issues,
    ],
  };
}
