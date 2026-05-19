/**
 * 查看漫画配图进度：node scripts/inspect-comic-panels.mjs <comicId>
 */
import { PrismaClient } from "@prisma/client";

const id = process.argv[2];
if (!id) {
  console.error("用法: node scripts/inspect-comic-panels.mjs <comicId>");
  process.exit(1);
}
if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const prisma = new PrismaClient();

function parseDoc(imageUrls) {
  try {
    const raw = JSON.parse(imageUrls);
    if (raw?.pages && Array.isArray(raw.pages)) {
      return { format: 2, pages: raw.pages };
    }
    if (Array.isArray(raw)) {
      return { format: 1, pages: [{ page: 1, panels: raw }] };
    }
  } catch {
    /* ignore */
  }
  return { format: 0, pages: [] };
}

try {
  const row = await prisma.comic.findUnique({ where: { id } });
  if (!row) {
    console.log("未找到漫画:", id);
    process.exit(1);
  }
  const doc = parseDoc(row.imageUrls);
  let total = 0;
  let withImage = 0;
  const missing = [];
  for (const p of doc.pages) {
    for (let i = 0; i < (p.panels ?? []).length; i++) {
      const panel = p.panels[i];
      total += 1;
      const has = Boolean(panel?.imageUrl?.trim());
      if (has) withImage += 1;
      else {
        missing.push(`第${p.page ?? "?"}页-格${i + 1} ${panel?.caption?.slice(0, 20) ?? ""}`);
      }
    }
  }
  console.log("标题:", row.title);
  console.log("status:", row.status);
  console.log("updatedAt:", row.updatedAt.toISOString());
  console.log(`配图: ${withImage}/${total} 格`);
  if (missing.length > 0 && missing.length <= 12) {
    console.log("缺图格子:", missing.join("\n  "));
  } else if (missing.length > 12) {
    console.log("缺图格子: 前5项\n  ", missing.slice(0, 5).join("\n  "), `\n  ... 另有 ${missing.length - 5} 格`);
  }
} finally {
  await prisma.$disconnect();
}
