/**
 * songliao-regression-artifacts 离线断言
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildFullMediumSummary,
  listCachedComicRefs,
  resolveCachedComicId,
  resolveCachedMediumNovelId,
  resolveSongliaoSummaryAlias,
} from "@/lib/qa/songliao-regression-artifacts";

const OUT = path.join(process.cwd(), "qa-output", "songliao-regression");

function main() {
  delete process.env.QA_COMIC_RESUME_ID;
  assert.equal(
    resolveSongliaoSummaryAlias({
      skipComic: true,
      skipPanels: false,
      tiers: ["short", "medium", "long", "children"],
      comicPages: 8,
    }),
    "novels-4tier-summary.json",
  );
  assert.equal(
    resolveSongliaoSummaryAlias({
      skipComic: false,
      skipPanels: true,
      tiers: ["medium"],
      comicPages: 8,
    }),
    "storyboard-summary.json",
  );

  const built = buildFullMediumSummary({
    at: "t",
    title: "x",
    pass: true,
    panelRenderMode: "lib",
    novels: [{ tier: "medium", novelId: "n1" }],
    comic: { comicId: "c1", pages: 8, panels: 32, withImage: 32, pipeline: "light", ms: 500000, panelStreamMs: 200000 },
    urls: {},
  });
  assert.equal(built.mediumNovelId, "n1");
  assert.equal((built.comic as { storyboardMs: number }).storyboardMs, 300000);

  if (fs.existsSync(OUT)) {
    const refs = listCachedComicRefs();
    if (refs.length > 0) {
      const id = resolveCachedComicId({ ignoreEnv: true });
      assert.ok(id, "cached comic");
      const picked = refs.find((r) => r.comicId === id)!;
      const incomplete = refs.find((r) => r.panels > 0 && r.withImage < r.panels);
      if (incomplete) {
        assert.equal(id, incomplete.comicId, "应优先缺配图漫画");
      }
      console.log(`  resolveCachedComicId → ${id} (${picked.withImage}/${picked.panels})`);
    }
    const novelId = resolveCachedMediumNovelId();
    if (novelId) console.log(`  resolveCachedMediumNovelId → ${novelId}`);
  }

  console.log("qa:songliao-artifacts: ok");
}

main();
