import fs from "node:fs/promises";
import path from "node:path";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import { classifyReferencePayloads } from "@/lib/reference-classify";

export type GodotReferencesManifest = {
  items: Array<{ ordinal: number; purpose: string; path: string }>;
  classified: {
    background: string | null;
    protagonist: string | null;
    monsters: string[];
    towerSkins: string[];
  };
};

export type GodotReferenceBuildSummary = {
  imageCount: number;
  hasBackground: boolean;
  monsterCount: number;
  towerSkinCount: number;
  hasProtagonist: boolean;
};

export function summarizeGodotReferenceManifest(
  manifest: GodotReferencesManifest | null,
): GodotReferenceBuildSummary {
  if (!manifest) {
    return {
      imageCount: 0,
      hasBackground: false,
      monsterCount: 0,
      towerSkinCount: 0,
      hasProtagonist: false,
    };
  }
  const c = manifest.classified;
  return {
    imageCount: manifest.items.length,
    hasBackground: Boolean(c.background),
    monsterCount: c.monsters.length,
    towerSkinCount: c.towerSkins.length,
    hasProtagonist: Boolean(c.protagonist),
  };
}

function decodeDataUrl(dataUrl: string): Buffer {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m?.[2]) throw new Error("无效的 data URL");
  return Buffer.from(m[2], "base64");
}

/** 将浏览器参考图写入 Godot 工程 spec/，供运行时加载 */
export async function writeGodotReferenceAssets(
  workRoot: string,
  payloads: RuntimeReferencePayload[] | undefined,
): Promise<GodotReferencesManifest | null> {
  if (!payloads?.length) return null;

  const refsDir = path.join(workRoot, "spec", "refs");
  await fs.mkdir(refsDir, { recursive: true });

  const items: GodotReferencesManifest["items"] = [];
  for (const p of payloads.slice(0, 8)) {
    if (!p.dataUrl?.startsWith("data:")) continue;
    try {
      const buf = decodeDataUrl(p.dataUrl);
      const rel = `spec/refs/ref_${p.ordinal}.png`;
      await fs.writeFile(path.join(workRoot, rel.replace(/\//g, path.sep)), buf);
      items.push({
        ordinal: p.ordinal,
        purpose: p.purpose ?? "",
        path: `res://${rel.replace(/\\/g, "/")}`,
      });
    } catch {
      /* 单张失败不阻断导出 */
    }
  }

  if (!items.length) return null;

  const classifiedRaw = classifyReferencePayloads(payloads);
  const pathFor = (ord: number | null) =>
    ord == null ? null : (items.find((i) => i.ordinal === ord)?.path ?? null);

  const manifest: GodotReferencesManifest = {
    items,
    classified: {
      background: pathFor(classifiedRaw.backgroundOrdinal),
      protagonist: pathFor(classifiedRaw.protagonistOrdinal),
      monsters: classifiedRaw.monsterOrdinals
        .map((o) => pathFor(o))
        .filter((x): x is string => !!x),
      towerSkins: classifiedRaw.towerSkinOrdinals
        .map((o) => pathFor(o))
        .filter((x): x is string => !!x),
    },
  };

  await fs.writeFile(
    path.join(workRoot, "spec", "references.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  return manifest;
}
