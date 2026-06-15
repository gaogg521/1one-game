/**
 * 导入 export-literary-samples 生成的 manifest + public 资源到当前 DATABASE_URL。
 *
 *   npx tsx scripts/import-literary-samples.ts --in ./data/literary-samples-bundle
 */
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

type Manifest = {
  version: number;
  ownerKey: string;
  novels: Array<Record<string, unknown>>;
  comics: Array<Record<string, unknown>>;
  files: string[];
};

async function main(): Promise<void> {
  const inArg = process.argv.indexOf("--in");
  const inDir = path.resolve(
    inArg >= 0 && process.argv[inArg + 1] ? process.argv[inArg + 1] : "data/literary-samples-bundle",
  );
  const repoRoot = process.cwd();
  const raw = await fs.readFile(path.join(inDir, "manifest.json"), "utf8");
  const manifest = JSON.parse(raw) as Manifest;

  let novelUpsert = 0;
  for (const row of manifest.novels) {
    const id = String(row.id);
    const data = {
      ownerKey: String(row.ownerKey ?? manifest.ownerKey),
      visibility: String(row.visibility ?? "public"),
      featured: Boolean(row.featured),
      shareCode: row.shareCode != null ? String(row.shareCode) : null,
      title: String(row.title),
      prompt: String(row.prompt),
      content: String(row.content),
      summary: row.summary != null ? String(row.summary) : null,
      lengthTier: row.lengthTier != null ? String(row.lengthTier) : "medium",
      generationMetaJson: row.generationMetaJson != null ? String(row.generationMetaJson) : null,
      creativeBriefJson: row.creativeBriefJson != null ? String(row.creativeBriefJson) : null,
      characterRosterJson: row.characterRosterJson != null ? String(row.characterRosterJson) : null,
      status: String(row.status ?? "ready"),
      coverPath: row.coverPath != null ? String(row.coverPath) : null,
      playCount: Number(row.playCount ?? 0),
      likeCount: Number(row.likeCount ?? 0),
      createdAt: row.createdAt ? new Date(String(row.createdAt)) : undefined,
      updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : undefined,
    };
    await prisma.novel.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
    novelUpsert++;
  }

  let comicUpsert = 0;
  for (const row of manifest.comics) {
    const id = String(row.id);
    const data = {
      ownerKey: String(row.ownerKey ?? manifest.ownerKey),
      visibility: String(row.visibility ?? "public"),
      featured: Boolean(row.featured),
      novelId: row.novelId != null ? String(row.novelId) : null,
      shareCode: row.shareCode != null ? String(row.shareCode) : null,
      title: String(row.title),
      prompt: String(row.prompt),
      imageUrls: String(row.imageUrls ?? "[]"),
      creativeBriefJson: row.creativeBriefJson != null ? String(row.creativeBriefJson) : null,
      status: String(row.status ?? "ready"),
      coverPath: row.coverPath != null ? String(row.coverPath) : null,
      likeCount: Number(row.likeCount ?? 0),
      createdAt: row.createdAt ? new Date(String(row.createdAt)) : undefined,
      updatedAt: row.updatedAt ? new Date(String(row.updatedAt)) : undefined,
    };
    await prisma.comic.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
    comicUpsert++;
  }

  let fileCopied = 0;
  for (const rel of manifest.files) {
    const src = path.join(inDir, "public", rel);
    const dest = path.join(repoRoot, "public", rel);
    try {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(src, dest);
      fileCopied++;
    } catch {
      console.warn("[warn] skip file:", rel);
    }
  }

  console.log(
    `[import-literary-samples] novels=${novelUpsert} comics=${comicUpsert} files=${fileCopied} owner=${manifest.ownerKey}`,
  );
}

main()
  .catch((e) => {
    console.error("[FAIL]", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
