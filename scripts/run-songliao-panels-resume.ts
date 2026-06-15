/**
 * 对已有漫画补跑 lib 配图
 * npm run qa:songliao:panels-resume
 */
import { applyLiteraryQaDatabaseUrl, clearLeakedLiteraryQaEnv } from "@/lib/database-url";
import {
  listCachedComicRefs,
  resolveCachedComicId,
} from "@/lib/qa/songliao-regression-artifacts";

async function main() {
  applyLiteraryQaDatabaseUrl();
  clearLeakedLiteraryQaEnv("panels-resume");
  if (!process.env.QA_PANEL_RENDER_MODE?.trim()) process.env.QA_PANEL_RENDER_MODE = "lib";

  const refs = listCachedComicRefs();
  const comicId = resolveCachedComicId({ ignoreEnv: true });
  if (!comicId) {
    throw new Error("未找到 QA_COMIC_RESUME_ID，且 qa-output/songliao-regression 无缓存 comicId");
  }
  const picked = refs.find((r) => r.comicId === comicId);
  console.log(
    `[panels-resume] comicId=${comicId}` +
      (picked
        ? ` (${picked.withImage}/${picked.panels} 来自 ${picked.source})`
        : ""),
  );

  process.env.QA_COMIC_RESUME_ID = comicId;
  await import("./qa-songliao-literary-regression");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
