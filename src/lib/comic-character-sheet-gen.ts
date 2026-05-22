/**
 * 漫画角色参考图生成（Character Sheet First 架构）。
 * 每个角色先生成参考图，用于后续分镜配图的风格锚定 → 角色跨格一致。
 */
import fs from "fs";
import path from "path";
import type { ComicStylePresetId } from "@/lib/comic-style-presets";
import { getComicStylePreset } from "@/lib/comic-style-presets";
import { generateImageDetailed } from "@/lib/image-generation";
import { getImageGenAvailability } from "@/lib/image-generation";

/** 角色参考图生成所需的最小信息 */
export type CharSheetSubject = {
  id: string;
  name: string;
  /** 外貌+服饰描述（中文或英文均可，拼入文生图 prompt） */
  visualDesc: string;
};

const SHEET_DIR = path.join(process.cwd(), "public", "comic-char-sheets");

function ensureDir() {
  if (!fs.existsSync(SHEET_DIR)) fs.mkdirSync(SHEET_DIR, { recursive: true });
}

function buildCharSheetPrompt(
  name: string,
  desc: string,
  stylePreset: ComicStylePresetId,
): string {
  const style = getComicStylePreset(stylePreset);
  return [
    `Character design reference sheet for "${name}": ${desc}`,
    `Full body, front view, clean background`,
    `${style.promptEn}, character turn-around style, consistent proportions`,
    `Suitable as reference for generating the same character in different scenes and poses`,
    `NO text, NO speech bubbles, NO UI elements`,
  ].join(". ");
}

export type CharSheetResult = {
  characterId: string;
  name: string;
  url: string | null;
  error?: string;
};

export async function generateCharacterSheets(params: {
  subjects: CharSheetSubject[];
  stylePreset: ComicStylePresetId;
  comicKey: string;
  maxCharacters?: number;
}): Promise<CharSheetResult[]> {
  const availability = getImageGenAvailability();
  if (!availability.ok) {
    return params.subjects.map((c) => ({
      characterId: c.id,
      name: c.name,
      url: null,
      error: availability.message,
    }));
  }

  const chars = params.subjects.slice(0, params.maxCharacters ?? 6);
  const results: CharSheetResult[] = [];

  ensureDir();

  for (const char of chars) {
    const sheetPath = path.join(SHEET_DIR, `${params.comicKey}-${char.id}.png`);
    const publicUrl = `/comic-char-sheets/${params.comicKey}-${char.id}.png`;
    // 已有缓存则跳过
    if (fs.existsSync(sheetPath)) {
      console.info(`[char-sheet] 复用缓存 ${char.id}`);
      results.push({ characterId: char.id, name: char.name, url: publicUrl });
      continue;
    }

    const prompt = buildCharSheetPrompt(char.name, char.visualDesc, params.stylePreset);
    console.info(`[char-sheet] 生成 ${char.id} (${char.name})…`);

    try {
      const result = await generateImageDetailed(prompt, {
        size: "1024x1024",
        quality: "standard",
      });

      if (!result.ok || !result.url) {
        results.push({
          characterId: char.id,
          name: char.name,
          url: null,
          error: result.error ?? "生成失败",
        });
        continue;
      }

      const res = await fetch(result.url);
      if (!res.ok) {
        results.push({ characterId: char.id, name: char.name, url: null, error: `下载失败 HTTP ${res.status}` });
        continue;
      }

      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(sheetPath, buf);
      console.info(`[char-sheet] ${char.id} 已保存 ${sheetPath}`);
      results.push({ characterId: char.id, name: char.name, url: publicUrl });
    } catch (e) {
      results.push({
        characterId: char.id,
        name: char.name,
        url: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return results;
}
