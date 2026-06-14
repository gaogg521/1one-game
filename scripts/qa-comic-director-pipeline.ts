/**
 * 漫画导演/轻量流水线离线检查：npm run qa:comic-director-pipeline
 */
import assert from "node:assert/strict";

import { shouldBuildAdaptationBlueprint } from "@/lib/comic-adaptation-blueprint";
import { shouldUseLongComicPipeline } from "@/lib/comic-generate-config";
import { shouldSkipComicBriefExpand } from "@/lib/comic-standalone-pipeline";
import { fallbackComicDirectorPack } from "@/lib/comic-director";
import { applyShotPlanToPages } from "@/lib/comic-shot-plan";
import { checkComicPanelsConsistency } from "@/lib/comic-panel-consistency";
import type { ComicPage } from "@/lib/comic-format";

assert.equal(shouldUseLongComicPipeline(16, "long"), true, "长篇 16 页应走导演包");
assert.equal(shouldUseLongComicPipeline(8, "medium"), false, "中篇默认 8 页应走轻量");
assert.equal(shouldUseLongComicPipeline(9, "medium"), false, "中篇 9 页仍应走轻量");
assert.equal(shouldUseLongComicPipeline(12, "medium"), true, "中篇 ≥12 页才走导演包");
assert.equal(shouldUseLongComicPipeline(4, "short"), false, "短篇 4 页应走轻量");
assert.equal(shouldUseLongComicPipeline(4, "children"), false, "儿童 4 页应走轻量");

assert.equal(
  shouldSkipComicBriefExpand({
    sourceMode: "from_novel",
    actualNovelId: "n1",
    hasBriefRevision: false,
    skipStandaloneBrief: false,
  }),
  true,
  "from_novel 改编应跳过 Brief 二次扩写",
);
assert.equal(
  shouldSkipComicBriefExpand({
    sourceMode: "from_novel",
    actualNovelId: "n1",
    hasBriefRevision: true,
    skipStandaloneBrief: false,
  }),
  false,
  "用户修订 Brief 时不应跳过",
);

assert.equal(
  shouldBuildAdaptationBlueprint(8000, 2, "medium"),
  false,
  "中篇 <12000 字不应建改编蓝图",
);
assert.equal(
  shouldBuildAdaptationBlueprint(13000, 3, "medium"),
  false,
  "中篇 <4 章不应建改编蓝图",
);
assert.equal(
  shouldBuildAdaptationBlueprint(13000, 4, "medium"),
  true,
  "中篇 ≥12000 字且 ≥4 章才建蓝图",
);
assert.equal(
  shouldBuildAdaptationBlueprint(7000, 2, "short"),
  false,
  "短篇 <3 章不应建蓝图",
);
assert.equal(
  shouldBuildAdaptationBlueprint(7000, 3, "short"),
  true,
  "短篇 ≥6000 字且 ≥3 章可建蓝图",
);

const director = fallbackComicDirectorPack({
  novelTitle: "测试",
  pageCount: 4,
  genre: "urban",
  stylePreset: "chinese_campus",
  novelMeta: null,
});

const pages: ComicPage[] = [
  {
    page: 1,
    panels: [
      {
        scene: 1,
        caption: "你好",
        prompt: "draft",
        characterIds: ["char_1"],
        locationId: "loc_1",
        shotType: "medium",
        sceneDescriptionEn: "protagonist enters office",
      },
    ],
  },
];

const planned = applyShotPlanToPages(pages, director, "urban");
const report = checkComicPanelsConsistency(planned, director);
assert.ok(planned[0]!.panels[0]!.prompt.length > 20, "shot prompt 应有内容");
assert.equal(report.ok, true, "consistency 应通过");
assert.match(planned[0]!.panels[0]!.prompt, /Illustration only/, "应含 no-text suffix");

console.log("[OK] qa-comic-director-pipeline");
