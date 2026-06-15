/**
 * 宋辽中篇 8 页小说 + 漫画全量（含 lib 配图）
 * npm run qa:songliao:comic-full
 */
import { applyLiteraryQaDatabaseUrl, clearLeakedLiteraryQaEnv } from "@/lib/database-url";

async function main() {
  applyLiteraryQaDatabaseUrl();
  clearLeakedLiteraryQaEnv("comic-full");
  if (!process.env.QA_PANEL_RENDER_MODE?.trim()) process.env.QA_PANEL_RENDER_MODE = "lib";
  await import("./qa-songliao-literary-regression");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
