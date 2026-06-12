/**
 * 漫画角色参考图生成（Character Sheet First 架构）。
 * 每个角色先生成参考图，用于后续分镜配图的风格锚定 → 角色跨格一致。
 */
import fs from "fs";
import path from "path";
import type { ComicStylePresetId } from "@/lib/comic-style-presets";
import { getComicStylePreset } from "@/lib/comic-style-presets";
import { generateImageDetailed, getImageGenAvailability } from "@/lib/image-generation";
import { getComicPanelGenConcurrency } from "@/lib/model-config";
import { PRODUCT } from "@/lib/product-config";
import type { AppLocale } from "@/i18n/routing";
import { assetGenMessage } from "@/lib/i18n/progress-message";

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]!, i);
    }
  }
  const workers = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

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
  uiLocale?: AppLocale;
}): Promise<CharSheetResult[]> {
  const locale = params.uiLocale ?? "zh-Hans";
  const ag = (key: string, p?: Record<string, string | number | undefined | null>) =>
    assetGenMessage(locale, key, p);
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
  const concurrency = Math.min(
    getComicPanelGenConcurrency(),
    PRODUCT.comic.charSheetConcurrency ?? 4,
  );

  ensureDir();

  return mapWithConcurrency(chars, concurrency, async (char) => {
    const sheetPath = path.join(SHEET_DIR, `${params.comicKey}-${char.id}.png`);
    const publicUrl = `/comic-char-sheets/${params.comicKey}-${char.id}.png`;
    if (fs.existsSync(sheetPath)) {
      console.info(`[char-sheet] 复用缓存 ${char.id}`);
      return { characterId: char.id, name: char.name, url: publicUrl };
    }

    const prompt = buildCharSheetPrompt(char.name, char.visualDesc, params.stylePreset);
    console.info(`[char-sheet] 生成 ${char.id} (${char.name})…`);

    try {
      const result = await generateImageDetailed(prompt, {
        size: "1024x1024",
        quality: "standard",
      });

      if (!result.ok || !result.url) {
        return {
          characterId: char.id,
          name: char.name,
          url: null,
          error: result.error ?? ag("generateFailed"),
        };
      }

      const res = await fetch(result.url);
      if (!res.ok) {
        return {
          characterId: char.id,
          name: char.name,
          url: null,
          error: ag("downloadFailedHttp", { status: res.status }),
        };
      }

      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(sheetPath, buf);
      console.info(`[char-sheet] ${char.id} 已保存 ${sheetPath}`);
      return { characterId: char.id, name: char.name, url: publicUrl };
    } catch (e) {
      return {
        characterId: char.id,
        name: char.name,
        url: null,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
}
