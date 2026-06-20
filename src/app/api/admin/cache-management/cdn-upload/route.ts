import { requireSuperAdmin } from "@/lib/auth/admin";
import { NextResponse } from "next/server";
import { uploadCharacterSheetToCdn, getCdnConfig, verifyCdnUrl } from "@/lib/comic-character-sheet-cdn";
import fs from "fs";

export type CdnUploadRequest = {
  characterIds: string[];
  comicKey: string;
};

export type CdnUploadResponse = {
  success: boolean;
  uploaded: number;
  failed: number;
  results: Array<{
    characterId: string;
    success: boolean;
    cdnUrl?: string;
    error?: string;
  }>;
};

/**
 * 批量上传参考图到 CDN
 * POST /api/admin/cache-management/cdn-upload
 */
export async function POST(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = (await req.json()) as CdnUploadRequest | undefined;
    const characterIds = body?.characterIds ?? [];
    const comicKey = body?.comicKey ?? "";

    if (characterIds.length === 0) {
      return NextResponse.json({ error: "No character IDs provided" }, { status: 400 });
    }

    if (!comicKey.trim()) {
      return NextResponse.json({ error: "No comic key provided" }, { status: 400 });
    }

    const cdnConfig = getCdnConfig();
    const storeDir = (() => {
      const homeDir = process.env.HOME || process.env.USERPROFILE || "/tmp";
      return require("path").join(homeDir, ".cache", "open-game", "comic-char-sheets");
    })();

    const results: CdnUploadResponse["results"] = [];
    let uploaded = 0;
    let failed = 0;

    for (const characterId of characterIds) {
      const localPath = require("path").join(storeDir, `${comicKey}-${characterId}.jpg`);

      if (!fs.existsSync(localPath)) {
        results.push({
          characterId,
          success: false,
          error: "Local file not found",
        });
        failed++;
        continue;
      }

      // 上传到 CDN
      const uploadResult = await uploadCharacterSheetToCdn(
        localPath,
        characterId,
        comicKey,
        cdnConfig
      );

      if (uploadResult.success && uploadResult.cdnUrl) {
        // 验证 CDN URL 可达性
        const verifyResult = await verifyCdnUrl(uploadResult.cdnUrl);
        if (verifyResult.valid) {
          results.push({
            characterId,
            success: true,
            cdnUrl: uploadResult.cdnUrl,
          });
          uploaded++;
        } else {
          results.push({
            characterId,
            success: false,
            error: `CDN verification failed: ${verifyResult.error}`,
          });
          failed++;
        }
      } else {
        results.push({
          characterId,
          success: false,
          error: uploadResult.error ?? "Upload failed",
        });
        failed++;
      }
    }

    console.info(
      `[cdn-upload] CDN 上传完成：${comicKey} 成功 ${uploaded} / 失败 ${failed}`
    );

    return NextResponse.json({
      success: failed === 0,
      uploaded,
      failed,
      results,
    } as CdnUploadResponse);
  } catch (e) {
    console.error("[cdn-upload] CDN 上传失败:", e);
    return NextResponse.json(
      { error: "CDN upload failed", details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

/**
 * 检查 CDN 配置状态
 * GET /api/admin/cache-management/cdn-upload
 */
export async function GET(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const cdnConfig = getCdnConfig();

    return NextResponse.json({
      provider: cdnConfig.provider,
      endpoint: cdnConfig.endpoint,
      enabled: !!cdnConfig.endpoint,
      ttlSeconds: cdnConfig.ttlSeconds,
      maxRetries: cdnConfig.maxRetries,
    });
  } catch (e) {
    console.error("[cdn-upload] 获取 CDN 配置失败:", e);
    return NextResponse.json(
      { error: "Failed to get CDN config" },
      { status: 500 }
    );
  }
}
