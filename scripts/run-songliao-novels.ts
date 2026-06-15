/**
 * 宋辽四档小说回归（跳过漫画）
 * npm run qa:songliao:novels
 */
import { applyLiteraryQaDatabaseUrl, clearLeakedLiteraryQaEnv } from "@/lib/database-url";

async function main() {
  applyLiteraryQaDatabaseUrl();
  clearLeakedLiteraryQaEnv("novels");
  process.env.QA_SKIP_COMIC = "1";
  if (!process.env.QA_NOVEL_TIERS?.trim()) {
    process.env.QA_NOVEL_TIERS = "short,medium,long,children";
  }
  await import("./qa-songliao-literary-regression");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
