/**
 * 将宋辽中篇满格漫画标为发现页精选（读 full-medium-summary.json）
 * npm run seed:comic-featured-songliao
 */
import fs from "node:fs";
import path from "node:path";
import { applyLiteraryQaDatabaseUrl } from "@/lib/database-url";
import { seedFeaturedComic } from "@/lib/comic-featured";

const SUMMARY = path.join(process.cwd(), "qa-output", "songliao-regression", "full-medium-summary.json");

async function main() {
  applyLiteraryQaDatabaseUrl();
  if (!fs.existsSync(SUMMARY)) {
    console.error("[FAIL] missing full-medium-summary.json — run qa:songliao:medium-chain first");
    process.exit(1);
  }
  const summary = JSON.parse(fs.readFileSync(SUMMARY, "utf8")) as {
    comicId?: string;
    comic?: { withImage?: number; panels?: number };
    pass?: boolean;
  };
  const comicId = summary.comicId;
  if (!comicId) {
    console.error("[FAIL] no comicId in summary");
    process.exit(1);
  }
  const withImage = summary.comic?.withImage ?? 0;
  const panels = summary.comic?.panels ?? 0;
  if (withImage < panels || panels === 0) {
    console.error(`[FAIL] comic not full (${withImage}/${panels} panels)`);
    process.exit(1);
  }
  const { updated } = await seedFeaturedComic(comicId);
  console.log(`seed:comic-featured-songliao: ${comicId} featured=${updated ? "yes" : "missing-row"}`);
  if (!updated) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
