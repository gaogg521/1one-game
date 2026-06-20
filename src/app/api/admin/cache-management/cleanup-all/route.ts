import { requireSuperAdmin } from "@/lib/auth/admin";
import { listLocalCaches } from "@/lib/comic-character-sheet-cache-ttl";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getCacheStorePath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "/tmp";
  return path.join(homeDir, ".cache", "open-game", "comic-char-sheets");
}

export async function POST(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const entries = listLocalCaches();
    const storeDir = getCacheStorePath();
    let cleaned = 0;

    // 删除所有缓存文件
    for (const entry of entries) {
      // 删除元数据文件
      const metaFile = path.join(storeDir, `${entry.comicKey}-${entry.characterId}.json`);
      if (fs.existsSync(metaFile)) {
        try {
          fs.unlinkSync(metaFile);
          cleaned++;
        } catch (e) {
          console.warn(`[cache-management] 删除元数据文件失败 ${metaFile}:`, e);
        }
      }

      // 删除本地缓存文件
      if (entry.localPath && fs.existsSync(entry.localPath)) {
        try {
          fs.unlinkSync(entry.localPath);
        } catch (e) {
          console.warn(`[cache-management] 删除缓存文件失败 ${entry.localPath}:`, e);
        }
      }
    }

    console.info(`[cache-management] 清理所有缓存完成，删除 ${cleaned} 个条目`);
    return NextResponse.json({ cleaned });
  } catch (e) {
    console.error("[cache-management] 清理所有缓存失败:", e);
    return NextResponse.json(
      { error: "Failed to cleanup all caches" },
      { status: 500 }
    );
  }
}
