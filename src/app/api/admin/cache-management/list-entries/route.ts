import { requireSuperAdmin } from "@/lib/auth/admin";
import { listLocalCaches } from "@/lib/comic-character-sheet-cache-ttl";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export type CacheEntryWithStats = {
  characterId: string;
  comicKey: string;
  url: string;
  generatedAt: string;
  lastValidatedAt: string;
  valid: boolean;
  localPath?: string;
  fileSizeBytes?: number;
};

export async function GET(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const entries = listLocalCaches();
    const enrichedEntries: CacheEntryWithStats[] = entries.map((entry) => {
      let fileSizeBytes: number | undefined;
      if (entry.localPath && fs.existsSync(entry.localPath)) {
        try {
          const stat = fs.statSync(entry.localPath);
          fileSizeBytes = stat.size;
        } catch (e) {
          console.warn(`[cache-list] 无法获取文件大小 ${entry.localPath}:`, e);
        }
      }

      return {
        ...entry,
        fileSizeBytes,
      };
    });

    // 按生成时间倒序排列
    enrichedEntries.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

    return NextResponse.json({
      entries: enrichedEntries,
      total: enrichedEntries.length,
    });
  } catch (e) {
    console.error("[cache-list] 列出缓存条目失败:", e);
    return NextResponse.json(
      { error: "Failed to list cache entries" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = (await req.json()) as { characterIds?: string[]; comicKey?: string } | undefined;
    const characterIds = body?.characterIds ?? [];
    const comicKey = body?.comicKey ?? "";

    if (characterIds.length === 0) {
      return NextResponse.json({ error: "No character IDs provided" }, { status: 400 });
    }

    if (!comicKey.trim()) {
      return NextResponse.json({ error: "No comic key provided" }, { status: 400 });
    }

    const entries = listLocalCaches();
    const storeDir = (() => {
      const homeDir = process.env.HOME || process.env.USERPROFILE || "/tmp";
      return path.join(homeDir, ".cache", "open-game", "comic-char-sheets");
    })();

    let deleted = 0;

    for (const characterId of characterIds) {
      const entry = entries.find(
        (e) => e.comicKey === comicKey && e.characterId === characterId
      );

      if (!entry) continue;

      // 删除元数据文件
      const metaFile = path.join(storeDir, `${comicKey}-${characterId}.json`);
      if (fs.existsSync(metaFile)) {
        try {
          fs.unlinkSync(metaFile);
          deleted++;
        } catch (e) {
          console.warn(`[cache-list] 删除元数据文件失败 ${metaFile}:`, e);
        }
      }

      // 删除本地缓存文件
      if (entry.localPath && fs.existsSync(entry.localPath)) {
        try {
          fs.unlinkSync(entry.localPath);
        } catch (e) {
          console.warn(`[cache-list] 删除缓存文件失败 ${entry.localPath}:`, e);
        }
      }
    }

    console.info(
      `[cache-list] 删除缓存条目 ${comicKey}: ${deleted} / ${characterIds.length}`
    );

    return NextResponse.json({ deleted });
  } catch (e) {
    console.error("[cache-list] 删除缓存条目失败:", e);
    return NextResponse.json(
      { error: "Failed to delete cache entries" },
      { status: 500 }
    );
  }
}
