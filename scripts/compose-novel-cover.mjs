import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const novelId = process.argv[2];
if (!novelId) {
  console.error("用法: node scripts/compose-novel-cover.mjs <novelId>");
  process.exit(1);
}

const { composeAndPersistNovelCoverFromBackground } = await import("../src/lib/cover-generation.ts");
const { comicCoverFromImageUrls } = await import("../src/lib/comic-display.ts");
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const novel = await prisma.novel.findUnique({ where: { id: novelId } });
if (!novel) {
  console.error("小说不存在");
  process.exit(1);
}

let bg = null;
if (novel.coverPath) {
  bg = novel.coverPath;
  console.log("使用已有封面底图:", bg);
} else {
  const comic = await prisma.comic.findFirst({
    where: { novelId },
    orderBy: { updatedAt: "desc" },
  });
  bg = comic ? comicCoverFromImageUrls(comic.imageUrls) : null;
  console.log("使用漫画首格:", bg);
}

if (!bg) {
  console.error("无可用底图");
  process.exit(1);
}

const coverPath = await composeAndPersistNovelCoverFromBackground(
  novel.id,
  novel.title,
  bg,
  novel.summary ?? undefined,
  novel.prompt,
);
console.log("完成:", coverPath);
await prisma.$disconnect();
