import fs from "node:fs/promises";
import path from "node:path";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import { classifyReferencePayloads } from "@/lib/reference-classify";

const AI_SPRITE_ORDINAL_BASE = 100; // 与用户上传参考图（0-99）错开，避免文件名冲突

/** 根据游戏模板调整 AI sprite 的 purpose，让分类更符合模板语义（塔防 player.png → 防御塔） */
export function adjustAiSpritePurposesForTemplate(
  payloads: RuntimeReferencePayload[],
  templateId: string,
): RuntimeReferencePayload[] {
  const map: Record<number, string> = {};
  if (templateId === "towerDefense") {
    // player.png 在塔防里是植物/豌豆射手，应被分类为 towerSkin
    map[AI_SPRITE_ORDINAL_BASE] = "防御塔 植物 豌豆射手";
  }
  if (Object.keys(map).length === 0) return payloads;
  return payloads.map((p) => {
    if (map[p.ordinal]) {
      return { ...p, purpose: map[p.ordinal] };
    }
    return p;
  });
}

/** 将已生成的 AI sprite（public/game-sprites/{projectId}）转为 Godot 可用的 RuntimeReferencePayload */
export async function readAiSpritesAsReferencePayloads(
  projectId: string,
  repoRoot: string,
): Promise<RuntimeReferencePayload[]> {
  const spriteDir = path.join(repoRoot, "public", "game-sprites", projectId);
  try {
    await fs.access(spriteDir);
  } catch {
    return [];
  }

  const payloads: RuntimeReferencePayload[] = [];
  const fileMap: Record<string, { purpose: string; ordinal: number }> = {
    "player.png": { purpose: "主角 守护者", ordinal: AI_SPRITE_ORDINAL_BASE },
    "hazard.png": { purpose: "怪物 敌军", ordinal: AI_SPRITE_ORDINAL_BASE + 1 },
    "boss.png": { purpose: "精英 首领", ordinal: AI_SPRITE_ORDINAL_BASE + 2 },
    "gem.png": { purpose: "金币 收集物", ordinal: AI_SPRITE_ORDINAL_BASE + 3 },
    "power.png": { purpose: "能量 补给", ordinal: AI_SPRITE_ORDINAL_BASE + 4 },
  };

  for (const [fileName, meta] of Object.entries(fileMap)) {
    const filePath = path.join(spriteDir, fileName);
    try {
      const buf = await fs.readFile(filePath);
      const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
      payloads.push({ ordinal: meta.ordinal, purpose: meta.purpose, dataUrl });
    } catch {
      /* 文件不存在则跳过，不阻断导出 */
    }
  }

  return payloads;
}

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

  // 双向 fallback：AI 生成的 player.png 在塔防场景下常被分到 protagonist，
  // 但塔也需要皮肤。若一方为空而另一方有值，自动共享，避免默认几何造型。
  if (!manifest.classified.towerSkins.length && manifest.classified.protagonist) {
    manifest.classified.towerSkins = [manifest.classified.protagonist];
  }
  if (!manifest.classified.protagonist && manifest.classified.towerSkins.length) {
    manifest.classified.protagonist = manifest.classified.towerSkins[0];
  }

  await fs.writeFile(
    path.join(workRoot, "spec", "references.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  return manifest;
}
