/**
 * Phase 2：运行时资产槽位（与 GameSpec.theme 解耦，支持生成图/参考图/回退）
 */
import {
  ASSET_MANIFEST_SCHEMA_VERSION,
  type AssetManifestV1,
} from "@/lib/orchestration/asset-manifest";

export const RUNTIME_ASSET_SCHEMA_VERSION = 3 as const;

export type AssetSlotKind = "background" | "player" | "enemy" | "collectible" | "tileset" | "ui";

export type RuntimeAssetSlot = {
  slot: AssetSlotKind;
  url: string;
  source: "generated" | "reference" | "theme_fallback";
  /** Durable production metadata. Optional while reading legacy manifests. */
  metadata?: {
    semanticRole: string;
    mediaType: "image" | "audio" | "model_3d";
    subtype: string;
    prompt?: string;
    aspectRatio?: string;
    compression?: string;
    revision: number;
  };
};

export type AssetManifestV2 = AssetManifestV1 & {
  runtimeSchema?: typeof RUNTIME_ASSET_SCHEMA_VERSION;
  slots?: RuntimeAssetSlot[];
};

export type RuntimeAssetBundle = {
  backgroundUrl: string | null;
  spriteBaseUrl: string | null;
  slots: RuntimeAssetSlot[];
  manifest: AssetManifestV2 | null;
};

export function upgradeAssetManifest(m: AssetManifestV1 | AssetManifestV2): AssetManifestV2 {
  return {
    ...m,
    runtimeSchema: RUNTIME_ASSET_SCHEMA_VERSION,
    slots: "slots" in m && m.slots ? m.slots : [],
  };
}

/** 从 projectId / 背景 URL / manifest 解析独立运行时资产包 */
export function resolveRuntimeAssets(opts: {
  projectId?: string | null;
  backgroundUrl?: string | null;
  manifest?: AssetManifestV1 | AssetManifestV2 | null;
  themeBackground?: string;
}): RuntimeAssetBundle {
  const manifest = opts.manifest ? upgradeAssetManifest(opts.manifest) : null;
  const spriteBaseUrl = opts.projectId ? `/game-sprites/${opts.projectId}` : null;
  const slots: RuntimeAssetSlot[] = [...(manifest?.slots ?? [])];

  const bgFromManifest = slots.find((s) => s.slot === "background")?.url ?? null;
  const backgroundUrl = opts.backgroundUrl ?? bgFromManifest ?? null;

  if (!backgroundUrl && opts.themeBackground && !slots.some((s) => s.slot === "background")) {
    slots.push({
      slot: "background",
      url: opts.themeBackground,
      source: "theme_fallback",
    });
  }

  if (spriteBaseUrl && !slots.some((s) => s.slot === "player")) {
    slots.push({ slot: "player", url: `${spriteBaseUrl}/player.png`, source: "generated" });
  }

  return { backgroundUrl, spriteBaseUrl, slots, manifest };
}

export function slotUrl(bundle: RuntimeAssetBundle, slot: AssetSlotKind): string | null {
  return bundle.slots.find((s) => s.slot === slot)?.url ?? null;
}

export function buildRuntimeAssetManifest(opts: {
  projectId: string;
  backgroundUrl?: string | null;
  referenceItems?: AssetManifestV1["items"];
  spriteUrls?: Array<{ kind: string; url: string | null | undefined }>;
}): AssetManifestV2 {
  const slots: RuntimeAssetSlot[] = [];
  if (opts.backgroundUrl) {
    slots.push({
      slot: "background",
      url: opts.backgroundUrl,
      source: "generated",
      metadata: {
        semanticRole: "playfield_environment",
        mediaType: "image",
        subtype: "background",
        aspectRatio: "9:16",
        compression: "web_optimized",
        revision: 1,
      },
    });
  }

  const kindToSlot: Record<string, AssetSlotKind> = {
    player: "player",
    hazard: "enemy",
    gem: "collectible",
    power: "ui",
    boss: "enemy",
  };

  for (const s of opts.spriteUrls ?? []) {
    if (!s.url) continue;
    const slot = kindToSlot[s.kind];
    if (!slot || slots.some((x) => x.slot === slot)) continue;
    slots.push({
      slot,
      url: s.url,
      source: "generated",
      metadata: {
        semanticRole: slot === "enemy" ? `gameplay_${s.kind}` : `gameplay_${slot}`,
        mediaType: "image",
        subtype: "sprite",
        aspectRatio: "1:1",
        compression: "transparent_web_asset",
        revision: 1,
      },
    });
  }

  if (!slots.some((s) => s.slot === "player")) {
    slots.push({
      slot: "player",
      url: `/game-sprites/${opts.projectId}/player.png`,
      source: "generated",
      metadata: {
        semanticRole: "gameplay_player",
        mediaType: "image",
        subtype: "sprite",
        aspectRatio: "1:1",
        compression: "transparent_web_asset",
        revision: 1,
      },
    });
  }

  return {
    schemaVersion: ASSET_MANIFEST_SCHEMA_VERSION,
    revision: 1,
    createdAt: Date.now(),
    items: opts.referenceItems ?? [],
    runtimeSchema: RUNTIME_ASSET_SCHEMA_VERSION,
    slots,
  };
}
