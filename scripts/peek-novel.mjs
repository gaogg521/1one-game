import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") });
const { PrismaClient } = await import("@prisma/client");
const { parseNovelChapters } = await import("../src/lib/novel-chapters.ts");
const { stripLeadingTitleFromBody, normalizeNovelTitle } = await import("../src/lib/novel-display.ts");
const p = new PrismaClient();
const n = await p.novel.findFirst({ where: { title: { contains: "煤山" } }, select: { title: true, content: true, prompt: true } });
if (n) {
  const chs = parseNovelChapters(n.content);
  const strip = [n.title, normalizeNovelTitle(n.title, n.prompt)];
  for (const c of chs.slice(0, 2)) {
    const stripped = stripLeadingTitleFromBody(c.body, strip);
    const paras = stripped.split(/\n\n+/).filter((x) => x.trim());
    console.log(`ch${c.num} body ${c.body.length} -> stripped ${stripped.length} paras ${paras.length}`);
    console.log("first 80 stripped:", stripped.slice(0, 80));
  }
}
await p.$disconnect();
