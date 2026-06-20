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
import { repoPublicPath } from "@/lib/public-path";
import {
  applyCharacterSheetUrlsToRoster,
  collectCharacterSheetUrls,
  type ComicCharacterRoster,
} from "@/lib/comic-character-roster";
import type { ComicDirectorPack } from "@/lib/comic-director-types";

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

/**
 * 检查单个角色参考图 URL 是否可访问。
 * 通过 HEAD 请求验证，带超时保护。
 */
export async function validateCharacterSheetUrl(
  url: string,
  timeoutMs: number = 5000,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("image")) {
      return { ok: false, error: "Not an image MIME type" };
    }

    return { ok: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { ok: false, error: err };
  }
}

/**
 * 并发检查多个角色参考图 URL 的有效性。
 */
export async function validateCharacterSheetUrls(
  roster: ComicCharacterRoster,
  concurrency: number = 4,
  timeoutMs: number = 5000,
): Promise<Map<string, { valid: boolean; error?: string }>> {
  const results = new Map<string, { valid: boolean; error?: string }>();
  const toCheck = roster.characters.filter((c) => c.referenceImageUrl?.trim());

  if (toCheck.length === 0) {
    return results;
  }

  await mapWithConcurrency(toCheck, concurrency, async (char) => {
    const result = await validateCharacterSheetUrl(char.referenceImageUrl!, timeoutMs);
    results.set(char.id, { valid: result.ok, error: result.error });
  });

  return results;
}

/** 角色参考图生成所需的最小信息 */
export type CharSheetSubject = {
  id: string;
  name: string;
  /** 外貌+服饰描述（中文或英文均可，拼入文生图 prompt） */
  visualDesc: string;
};

const SHEET_DIR = repoPublicPath("comic-char-sheets");

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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  // P1 修复：promise 先 resolve 时 clearTimeout，避免泄漏 timer + unhandled rejection
  let timerId: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => { if (timerId) clearTimeout(timerId); }),
    new Promise<T>((_, reject) => {
      timerId = setTimeout(() => reject(new Error(`${label} 超时（${Math.round(ms / 1000)}s）`)), ms);
    }),
  ]);
}

export async function generateCharacterSheets(params: {
  subjects: CharSheetSubject[];
  stylePreset: ComicStylePresetId;
  comicKey: string;
  maxCharacters?: number;
  uiLocale?: AppLocale;
  /** 跳过文生图（QA / 降级） */
  skip?: boolean;
  /** 单角色参考图超时；默认 PRODUCT.comic.charSheetTimeoutMs */
  timeoutMs?: number;
}): Promise<CharSheetResult[]> {
  const locale = params.uiLocale ?? "zh-Hans";
  const ag = (key: string, p?: Record<string, string | number | undefined | null>) =>
    assetGenMessage(locale, key, p);

  if (params.skip) {
    return params.subjects.map((c) => ({
      characterId: c.id,
      name: c.name,
      url: null,
      error: "skipped",
    }));
  }

  const availability = getImageGenAvailability();
  if (!availability.ok) {
    return params.subjects.map((c) => ({
      characterId: c.id,
      name: c.name,
      url: null,
      error: availability.message,
    }));
  }

  const perCharTimeoutMs = params.timeoutMs ?? PRODUCT.comic.charSheetTimeoutMs ?? 180_000;
  const chars = params.subjects.slice(0, params.maxCharacters ?? 6);
  const concurrency = Math.min(
    getComicPanelGenConcurrency(),
    PRODUCT.comic.charSheetConcurrency ?? 4,
  );

  ensureDir();

  return mapWithConcurrency(chars, concurrency, async (char) => {
    const sheetPath = path.join(/*turbopackIgnore: true*/ SHEET_DIR, `${params.comicKey}-${char.id}.png`);
    const publicUrl = `/comic-char-sheets/${params.comicKey}-${char.id}.png`;
    if (fs.existsSync(/*turbopackIgnore: true*/ sheetPath)) {
      console.info(`[char-sheet] 复用缓存 ${char.id}`);
      return { characterId: char.id, name: char.name, url: publicUrl };
    }

    const prompt = buildCharSheetPrompt(char.name, char.visualDesc, params.stylePreset);
    console.info(`[char-sheet] 生成 ${char.id} (${char.name})…`);

    try {
      const gen = generateImageDetailed(prompt, {
        size: "1024x1024",
        quality: "standard",
        timeoutMs: perCharTimeoutMs,
      });
      const result = await withTimeout(gen, perCharTimeoutMs + 5_000, char.name);

      if (!result.ok || !result.url) {
        return {
          characterId: char.id,
          name: char.name,
          url: null,
          error: result.error ?? ag("generateFailed"),
        };
      }

      // P1 修复：fetch 加 30s 超时，防图床挂起永久阻塞
      const fetchController = new AbortController();
      const fetchTimer = setTimeout(() => fetchController.abort(), 30_000);
      let res: Response;
      try {
        res = await fetch(result.url, { signal: fetchController.signal });
      } catch (fetchErr) {
        return {
          characterId: char.id,
          name: char.name,
          url: null,
          error: `download timeout/failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`,
        };
      } finally {
        clearTimeout(fetchTimer);
      }
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

/** 配图阶段按需生成角色参考图（分镜入库时不阻塞）。 */
export async function ensureComicCharacterSheetsForRender(params: {
  comicKey: string;
  stylePreset: ComicStylePresetId;
  roster?: ComicCharacterRoster | null;
  director?: ComicDirectorPack | null;
  existingUrls?: string[];
  uiLocale?: AppLocale;
  timeoutMs?: number;
}): Promise<{ urls: string[]; roster?: ComicCharacterRoster | null }> {
  let roster = params.roster ?? null;
  const cached = collectCharacterSheetUrls(roster);
  const urls = new Set([...(params.existingUrls?.filter(Boolean) ?? []), ...cached]);

  const charSubjects =
    params.director?.characters?.length
      ? params.director.characters.map((c) => ({
          id: c.id,
          name: c.name,
          visualDesc: [c.appearanceEn, c.outfitEn, c.hairEn].filter(Boolean).join(", "),
        }))
      : roster?.characters
          ?.filter((c) => !c.referenceImageUrl?.trim())
          .map((c) => ({
            id: c.id,
            name: c.name,
            visualDesc: [c.appearanceZh, c.outfitZh, c.notes].filter(Boolean).join(", "),
          })) ?? [];

  const needGenerate = charSubjects.filter((s) => !urls.has(`/comic-char-sheets/${params.comicKey}-${s.id}.png`));
  if (needGenerate.length === 0) {
    return { urls: [...urls], roster };
  }

  const sheets = await generateCharacterSheets({
    subjects: needGenerate,
    stylePreset: params.stylePreset,
    comicKey: params.comicKey,
    uiLocale: params.uiLocale,
    timeoutMs: params.timeoutMs,
  });
  if (roster && sheets.some((s) => s.url)) {
    roster = applyCharacterSheetUrlsToRoster(roster, sheets);
  }
  for (const sheet of sheets) {
    if (sheet.url) urls.add(sheet.url);
  }
  return { urls: [...urls], roster };
}
