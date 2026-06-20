/**
 * 漫画角色参考图缓存 TTL 管理
 * 管理参考图 URL 生命周期、定期验证可达性、自动清理过期缓存
 */

import fs from "fs";
import path from "path";

export type CharacterSheetCacheEntry = {
  characterId: string;
  comicKey: string;
  url: string;
  generatedAt: string; // ISO 8601
  lastValidatedAt: string;
  valid: boolean;
  localPath?: string;
};

export type CharacterSheetCacheTTLConfig = {
  /** 缓存有效期（毫秒），默认 30 天 */
  ttlMs: number;
  /** 验证间隔（毫秒），默认 7 天 */
  validateIntervalMs: number;
  /** 最大本地缓存文件数，超过则按时间清理 */
  maxLocalFiles: number;
  /** 验证超时（毫秒），默认 5000ms */
  validationTimeoutMs: number;
};

export const DEFAULT_CONFIG: CharacterSheetCacheTTLConfig = {
  ttlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  validateIntervalMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxLocalFiles: 1000,
  validationTimeoutMs: 5000,
};

function getCacheStorePath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "/tmp";
  return path.join(homeDir, ".cache", "open-game", "comic-char-sheets");
}

function ensureCacheDir(): void {
  const dir = getCacheStorePath();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 检查缓存条目是否已过期
 */
export function isCacheEntryExpired(entry: CharacterSheetCacheEntry, config: CharacterSheetCacheTTLConfig): boolean {
  const generatedTime = new Date(entry.generatedAt).getTime();
  const now = Date.now();
  return now - generatedTime > config.ttlMs;
}

/**
 * 检查缓存条目是否需要重新验证
 */
export function needsValidation(entry: CharacterSheetCacheEntry, config: CharacterSheetCacheTTLConfig): boolean {
  if (!entry.valid) return true;
  const lastValidated = new Date(entry.lastValidatedAt).getTime();
  const now = Date.now();
  return now - lastValidated > config.validateIntervalMs;
}

/**
 * 记录缓存条目（可选保存到本地文件）
 */
export function recordCharacterSheetCache(
  entry: CharacterSheetCacheEntry,
  options?: { saveLocal?: boolean; localStorePath?: string },
): void {
  if (!options?.saveLocal) return;

  ensureCacheDir();
  const storeDir = options.localStorePath || getCacheStorePath();
  const metaFile = path.join(storeDir, `${entry.comicKey}-${entry.characterId}.json`);

  try {
    fs.writeFileSync(metaFile, JSON.stringify(entry, null, 2), "utf-8");
  } catch (e) {
    console.error(`[char-sheet-cache] 记录缓存元数据失败 ${metaFile}:`, e);
  }
}

/**
 * 读取缓存条目
 */
export function loadCharacterSheetCache(
  comicKey: string,
  characterId: string,
  options?: { localStorePath?: string },
): CharacterSheetCacheEntry | null {
  const storeDir = options?.localStorePath || getCacheStorePath();
  const metaFile = path.join(storeDir, `${comicKey}-${characterId}.json`);

  if (!fs.existsSync(metaFile)) return null;

  try {
    const content = fs.readFileSync(metaFile, "utf-8");
    return JSON.parse(content) as CharacterSheetCacheEntry;
  } catch (e) {
    console.error(`[char-sheet-cache] 读取缓存元数据失败 ${metaFile}:`, e);
    return null;
  }
}

/**
 * 验证 URL 可达性并更新缓存条目
 */
export async function validateAndUpdateCacheEntry(
  entry: CharacterSheetCacheEntry,
  timeoutMs: number = 5000,
): Promise<CharacterSheetCacheEntry> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(entry.url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    const valid = response.ok && (response.headers.get("content-type")?.includes("image") ?? false);
    return {
      ...entry,
      valid,
      lastValidatedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.warn(`[char-sheet-cache] URL 验证失败 ${entry.url}:`, e instanceof Error ? e.message : String(e));
    return {
      ...entry,
      valid: false,
      lastValidatedAt: new Date().toISOString(),
    };
  }
}

/**
 * 清理过期缓存条目
 */
export function cleanupExpiredCaches(
  entries: CharacterSheetCacheEntry[],
  config: CharacterSheetCacheTTLConfig,
): CharacterSheetCacheEntry[] {
  return entries.filter((e) => !isCacheEntryExpired(e, config));
}

/**
 * 清理本地缓存文件（按时间倒序，保留最新的 maxLocalFiles 个）
 */
export function cleanupLocalCacheFiles(options?: {
  maxLocalFiles?: number;
  localStorePath?: string;
}): { removed: number; remaining: number } {
  const maxFiles = options?.maxLocalFiles ?? DEFAULT_CONFIG.maxLocalFiles;
  const storeDir = options?.localStorePath || getCacheStorePath();

  if (!fs.existsSync(storeDir)) return { removed: 0, remaining: 0 };

  try {
    const files = fs.readdirSync(storeDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({
        name: f,
        path: path.join(storeDir, f),
        mtime: fs.statSync(path.join(storeDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    const toRemove = files.slice(maxFiles);
    for (const file of toRemove) {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        console.error(`[char-sheet-cache] 删除缓存文件失败 ${file.path}:`, e);
      }
    }

    return { removed: toRemove.length, remaining: Math.min(files.length - toRemove.length, maxFiles) };
  } catch (e) {
    console.error(`[char-sheet-cache] 清理本地缓存失败:`, e);
    return { removed: 0, remaining: 0 };
  }
}

/**
 * 列出所有本地缓存条目
 */
export function listLocalCaches(options?: {
  localStorePath?: string;
}): CharacterSheetCacheEntry[] {
  const storeDir = options?.localStorePath || getCacheStorePath();

  if (!fs.existsSync(storeDir)) return [];

  try {
    const files = fs.readdirSync(storeDir).filter((f) => f.endsWith(".json"));
    const entries: CharacterSheetCacheEntry[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(storeDir, file), "utf-8");
        entries.push(JSON.parse(content));
      } catch (e) {
        console.warn(`[char-sheet-cache] 跳过无效的缓存文件 ${file}`);
      }
    }

    return entries;
  } catch (e) {
    console.error(`[char-sheet-cache] 列出本地缓存失败:`, e);
    return [];
  }
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(options?: {
  localStorePath?: string;
}): {
  totalEntries: number;
  validEntries: number;
  invalidEntries: number;
  expiredEntries: number;
  totalSizeBytes: number;
} {
  const entries = listLocalCaches(options);
  const config = DEFAULT_CONFIG;

  let totalSize = 0;
  const storeDir = options?.localStorePath || getCacheStorePath();

  for (const entry of entries) {
    if (entry.localPath && fs.existsSync(entry.localPath)) {
      const stat = fs.statSync(entry.localPath);
      totalSize += stat.size;
    }
  }

  return {
    totalEntries: entries.length,
    validEntries: entries.filter((e) => e.valid && !isCacheEntryExpired(e, config)).length,
    invalidEntries: entries.filter((e) => !e.valid).length,
    expiredEntries: entries.filter((e) => isCacheEntryExpired(e, config)).length,
    totalSizeBytes: totalSize,
  };
}
