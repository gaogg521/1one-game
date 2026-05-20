/**
 * 实机生成《不小心穿越到雍正四爷党》封面（需 OPENAI_API_KEY）
 * npx tsx scripts/qa-generate-yongzheng-cover.ts
 */
import { generateCover } from "@/lib/cover-generation";

async function main() {
  console.log("正在生成封面（约 30–90 秒）…");
  const path = await generateCover({
    title: "不小心穿越到雍正四爷党",
    summary: "现代青年意外卷入九子夺嫡，成为四爷党谋士。",
    storyHint: "《不小心穿越到雍正四爷党》·穿越",
    genre: "transmigration",
    type: "novel",
  });
  if (!path) {
    console.error("封面生成失败（无 URL）");
    process.exit(1);
  }
  console.log("封面已生成:", path);
  console.log("本地预览: http://localhost:3000" + path);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
