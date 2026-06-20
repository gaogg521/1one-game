/**
 * 漫画导演包版本迁移框架
 * 支持向后兼容 - 旧版本数据自动升级到最新版本
 */

import { COMIC_DIRECTOR_VERSION, type ComicDirectorPack } from "@/lib/comic-director-types";

/**
 * 迁移上下文 - 用于诊断和日志
 */
export type DirectorMigrationContext = {
  fromVersion: number;
  toVersion: number;
  sourceData: unknown;
  migratedData?: unknown;
  errors?: string[];
};

/**
 * 从 v1 到 v2 的迁移（未来的扩展）
 * 预留新增字段的默认值
 */
function migrateDirectorV1toV2(v1Data: any): any {
  return {
    ...v1Data,
    // 未来可能的新字段（现在空缺）
    // consistencyNotesForGeneration: v1Data.consistencyNotesForGeneration ?? "",
    // visualGuidelinesEn: v1Data.visualGuidelinesEn ?? "",
  };
}

/**
 * 迁移函数映射表
 * 每个版本对应一个迁移函数，用于升级到下一个版本
 */
const MIGRATIONS: Record<number, (data: any) => any> = {
  1: (data) => data, // v1 → v1（无需迁移）
  2: migrateDirectorV1toV2, // v1 → v2
};

/**
 * 尝试将原始数据解析为 ComicDirectorPack
 * 用于版本迁移后的验证
 */
function parseComicDirectorPackSafely(data: unknown): ComicDirectorPack | null {
  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;
  // 基础校验 - 只检查必要字段存在
  if (
    !obj.version ||
    !obj.title ||
    !obj.visualStyleEn ||
    !Array.isArray(obj.characters) ||
    !Array.isArray(obj.locations)
  ) {
    return null;
  }

  return data as ComicDirectorPack;
}

/**
 * 执行导演包版本迁移
 * 支持从任何旧版本升级到指定的目标版本
 *
 * @param rawData 原始导演数据（可能是旧版本）
 * @param targetVersion 目标版本（默认为当前最新版本）
 * @returns 迁移后的 ComicDirectorPack，或 null 如果迁移失败
 */
export function migrateComicDirector(
  rawData: unknown,
  targetVersion: number = COMIC_DIRECTOR_VERSION,
): ComicDirectorPack | null {
  if (!rawData || typeof rawData !== "object") {
    return null;
  }

  const obj = rawData as Record<string, unknown>;
  const currentVersion = typeof obj.version === "number" ? obj.version : 1;

  // 如果已是目标版本，直接解析并返回
  if (currentVersion === targetVersion) {
    return parseComicDirectorPackSafely(rawData);
  }

  // 如果源版本高于目标，无法降级
  if (currentVersion > targetVersion) {
    console.error(
      `[director-migration] 源版本 ${currentVersion} > 目标版本 ${targetVersion}，无法降级`,
    );
    return null;
  }

  // 执行链式迁移（v1 → v2 → v3... → targetVersion）
  let migrated: any = rawData;
  for (let v = currentVersion + 1; v <= targetVersion; v++) {
    const migrator = MIGRATIONS[v];
    if (!migrator) {
      console.error(`[director-migration] 无版本 ${v} 的迁移函数`);
      return null;
    }

    try {
      migrated = migrator(migrated);
      console.info(`[director-migration] v${v - 1} → v${v} 迁移成功`);
    } catch (e) {
      console.error(`[director-migration] v${v - 1} → v${v} 迁移失败: ${e}`);
      return null;
    }
  }

  // 最后验证迁移结果
  const result = parseComicDirectorPackSafely(migrated);
  if (!result) {
    console.error(
      `[director-migration] 迁移到 v${targetVersion} 后数据验证失败`,
    );
    return null;
  }

  return result;
}

/**
 * 检查导演数据是否需要迁移
 */
export function needsDirectorMigration(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  const version = typeof obj.version === "number" ? obj.version : 1;
  return version < COMIC_DIRECTOR_VERSION;
}

/**
 * 获取迁移信息摘要（用于日志或诊断）
 */
export function getDirectorMigrationSummary(
  fromVersion: number,
  toVersion: number,
): string {
  if (fromVersion === toVersion) {
    return `director v${fromVersion} (no migration needed)`;
  }
  return `director v${fromVersion} → v${toVersion} (migrated)`;
}
