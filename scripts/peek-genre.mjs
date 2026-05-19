import { PrismaClient } from "@prisma/client";
import { inferStoryGenre } from "../src/lib/cover-genre.ts";
const p = new PrismaClient();
const n = await p.novel.findUnique({ where: { id: "cmpawu0hx0008bxbbfkehkiy1" } });
const g = inferStoryGenre({
  title: n.title,
  summary: n.summary,
  prompt: n.prompt,
  contentSnippet: n.content.slice(0, 1200),
});
console.log("genre", g);
const t = `${n.title} ${n.summary} ${n.content.slice(0, 5000)}`;
for (const kw of ["科幻", "赛博", "星际", "未来", "机器人", "太空", "末世", "机甲", "千亿", "继承人"]) {
  if (t.includes(kw)) console.log("has", kw);
}
await p.$disconnect();
