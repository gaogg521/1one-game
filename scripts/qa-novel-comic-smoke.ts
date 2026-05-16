/**
 * 小说 + 漫画模块冒烟测试
 * 验证： Novel/Comic 创建、列表、删除流程
 * 运行： npx tsx scripts/qa-novel-comic-smoke.ts
 */

import { prisma } from "@/lib/prisma";

async function smoke() {
  const ownerKey = "smoke-test";
  const errors: string[] = [];

  // 1. 创建小说
  const novel = await prisma.novel.create({
    data: {
      ownerKey,
      title: "冒烟测试小说",
      prompt: "测试创意",
      content: "=== 第1章 开篇 ===\n这是测试内容。\n\n=== 第2章 发展 ===\n继续测试。",
      summary: "测试摘要…",
      status: "ready",
    },
  });
  console.log("✅ Novel created:", novel.id);

  // 2. 查询小说列表
  const novels = await prisma.novel.findMany({ where: { ownerKey } });
  if (novels.length === 0) errors.push("Novel 列表查询失败");
  else console.log("✅ Novel list:", novels.length, "items");

  // 3. 创建漫画（关联小说）
  const comic = await prisma.comic.create({
    data: {
      ownerKey,
      novelId: novel.id,
      title: `${novel.title} · 漫画版`,
      prompt: novel.prompt,
      imageUrls: JSON.stringify([
        { caption: "场景1", prompt: "scene 1 prompt" },
        { caption: "场景2", prompt: "scene 2 prompt" },
        { caption: "场景3", prompt: "scene 3 prompt" },
        { caption: "场景4", prompt: "scene 4 prompt" },
      ]),
      status: "ready",
    },
  });
  console.log("✅ Comic created:", comic.id);

  // 4. 查询漫画列表（含关联小说）
  const comics = await prisma.comic.findMany({
    where: { ownerKey },
    include: { novel: { select: { id: true, title: true } } },
  });
  if (comics.length === 0) errors.push("Comic 列表查询失败");
  else if (!comics[0].novel) errors.push("Comic 关联 Novel 查询失败");
  else console.log("✅ Comic list:", comics.length, "items, linked novel:", comics[0].novel.title);

  // 5. 删除漫画
  await prisma.comic.delete({ where: { id: comic.id } });
  console.log("✅ Comic deleted");

  // 6. 删除小说（级联删除验证：漫画应先删，这里再删小说）
  await prisma.novel.delete({ where: { id: novel.id } });
  console.log("✅ Novel deleted");

  // 7. 验证清理
  const remainingNovels = await prisma.novel.count({ where: { ownerKey } });
  const remainingComics = await prisma.comic.count({ where: { ownerKey } });
  if (remainingNovels > 0) errors.push(`Novel 未清理干净: ${remainingNovels}`);
  if (remainingComics > 0) errors.push(`Comic 未清理干净: ${remainingComics}`);
  console.log("✅ Cleanup verified");

  if (errors.length > 0) {
    console.error("\n❌ Smoke test failed:");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  } else {
    console.log("\n🎉 Novel + Comic smoke test passed");
  }
}

smoke().catch((e) => {
  console.error(e);
  process.exit(1);
});
