import { NextResponse } from "next/server";
import {
  listLocalCaches,
  validateAndUpdateCacheEntry,
  recordCharacterSheetCache,
  cleanupExpiredCaches,
  DEFAULT_CONFIG,
} from "@/lib/comic-character-sheet-cache-ttl";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("x-cron-secret") === secret;
}

/**
 * 定期验证参考图 URL 可达性 — 每 7 天执行
 * 检查缓存条目是否需要验证、执行 URL HEAD 请求、更新有效性状态、清理过期条目。
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const entries = listLocalCaches();
    if (entries.length === 0) {
      return NextResponse.json({
        ok: true,
        totalEntries: 0,
        validated: 0,
        invalidated: 0,
        cleaned: 0,
      });
    }

    let validated = 0;
    let invalidated = 0;

    // 验证需要重新检查的条目
    for (const entry of entries) {
      if (DEFAULT_CONFIG.validateIntervalMs > 0) {
        const lastValidated = new Date(entry.lastValidatedAt).getTime();
        const now = Date.now();
        if (now - lastValidated <= DEFAULT_CONFIG.validateIntervalMs) {
          continue; // 不需要验证，跳过
        }
      }

      // 执行 URL 验证
      const updated = await validateAndUpdateCacheEntry(entry, DEFAULT_CONFIG.validationTimeoutMs);
      recordCharacterSheetCache(updated, { saveLocal: true });

      if (updated.valid && !entry.valid) {
        // 从无效恢复到有效（罕见）
        validated++;
      } else if (!updated.valid && entry.valid) {
        // 从有效变为无效
        invalidated++;
      } else if (updated.valid) {
        // 仍然有效但验证了一遍
        validated++;
      }
    }

    // 清理过期条目
    const activeEntries = cleanupExpiredCaches(entries, DEFAULT_CONFIG);
    const cleaned = entries.length - activeEntries.length;

    console.info(
      `[cron] 参考图验证完成：总 ${entries.length} 条目 / 验证 ${validated} / 失效 ${invalidated} / 清理 ${cleaned}`,
    );

    return NextResponse.json({
      ok: true,
      totalEntries: entries.length,
      validated,
      invalidated,
      cleaned,
    });
  } catch (e) {
    console.error("[cron] 参考图验证失败:", e);
    return NextResponse.json(
      { error: "Validation job failed", details: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
