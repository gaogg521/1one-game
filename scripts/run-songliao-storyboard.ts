/**
 * 宋辽中篇 8 页漫画分镜（跳过配图，~5min）
 * npm run qa:songliao:storyboard
 */
import { applyLiteraryQaDatabaseUrl, clearLeakedLiteraryQaEnv } from "@/lib/database-url";
import { resolveCachedMediumNovelId } from "@/lib/qa/songliao-regression-artifacts";

async function main() {
  applyLiteraryQaDatabaseUrl();
  clearLeakedLiteraryQaEnv("storyboard");
  process.env.SKIP_COMIC_PANELS = "1";

  const cachedNovel = resolveCachedMediumNovelId();
  if (cachedNovel) {
    process.env.QA_COMIC_NOVEL_ID = cachedNovel;
    process.env.QA_NOVEL_TIERS = "medium";
  } else if (!process.env.QA_NOVEL_TIERS?.trim()) {
    process.env.QA_NOVEL_TIERS = "medium";
  }

  await import("./qa-songliao-literary-regression");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
