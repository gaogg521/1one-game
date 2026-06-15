/**
 * 导出本地小说/漫画样例（精选公开作品 + 关联资源）到目录，供 import-literary-samples 导入生产库。
 *
 *   DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/export-literary-samples.ts
 *   npx tsx scripts/export-literary-samples.ts --out ./data/literary-samples-bundle
 */
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export const LITERARY_SAMPLES_OWNER = "__literary-samples__";

const SHOWCASE_TITLE_PATTERNS = [
  "煤山",
  "崇祯",
  "锦衣卫",
  "Jinyiwei",
  "錦衣衛",
  "洪荒",
  "废柴世子",
  "孤剑",
  "千亿继承人",
  "聪明的小老鼠",
  "糯米团",
  "花花草草",
  "愚公",
  "时空",
  "第一章迷雾",
  "核爆",
];

function isShowcaseTitle(title: string): boolean {
  return SHOWCASE_TITLE_PATTERNS.some((p) => title.includes(p));
}

function collectPublicPaths(coverPath: string | null, imageUrlsJson: string | null): string[] {
  const out = new Set<string>();
  if (coverPath?.startsWith("/")) out.add(coverPath.slice(1));
  if (imageUrlsJson) {
    try {
      const urls = JSON.parse(imageUrlsJson) as unknown;
      if (Array.isArray(urls)) {
        for (const u of urls) {
          if (typeof u === "string" && u.startsWith("/")) out.add(u.slice(1));
        }
      }
    } catch {
      /* ignore */
    }
  }
  return [...out];
}

async function main(): Promise<void> {
  const outArg = process.argv.indexOf("--out");
  const outDir = path.resolve(
    outArg >= 0 && process.argv[outArg + 1] ? process.argv[outArg + 1] : "data/literary-samples-bundle",
  );
  const repoRoot = process.cwd();

  const novels = await prisma.novel.findMany({ where: { visibility: "public" } });
  const comics = await prisma.comic.findMany({ where: { visibility: "public" } });

  const novelIds = new Set<string>();
  for (const n of novels) {
    if (n.featured || isShowcaseTitle(n.title)) novelIds.add(n.id);
  }
  const comicIds = new Set<string>();
  for (const c of comics) {
    if (c.featured) {
      comicIds.add(c.id);
      if (c.novelId) novelIds.add(c.novelId);
    }
  }
  for (const c of comics) {
    if (c.novelId && novelIds.has(c.novelId)) comicIds.add(c.id);
  }

  const selNovels = novels.filter((n) => novelIds.has(n.id));
  const selComics = comics.filter((c) => comicIds.has(c.id));

  const files = new Set<string>();
  for (const row of [...selNovels, ...selComics]) {
    for (const f of collectPublicPaths(row.coverPath, "imageUrls" in row ? row.imageUrls : null)) {
      files.add(f);
    }
  }

  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(path.join(outDir, "public"), { recursive: true });

  const copied: string[] = [];
  for (const rel of files) {
    const src = path.join(repoRoot, "public", rel);
    const dest = path.join(outDir, "public", rel);
    try {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(src, dest);
      copied.push(rel);
    } catch {
      console.warn("[warn] missing asset:", rel);
    }
  }

  const manifest = {
    version: 1,
    ownerKey: LITERARY_SAMPLES_OWNER,
    exportedAt: new Date().toISOString(),
    novels: selNovels.map(({ ownerKey: _o, ...rest }) => ({ ...rest, ownerKey: LITERARY_SAMPLES_OWNER })),
    comics: selComics.map(({ ownerKey: _o, ...rest }) => ({ ...rest, ownerKey: LITERARY_SAMPLES_OWNER })),
    files: copied,
  };

  await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  console.log(
    `[export-literary-samples] novels=${selNovels.length} comics=${selComics.length} files=${copied.length} → ${outDir}`,
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
