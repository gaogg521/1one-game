/**
 * 长篇漫画导演流水线离线检查：npx tsx scripts/qa-comic-director-pipeline.ts
 */
import { shouldUseLongComicPipeline } from "@/lib/comic-generate-config";
import { shouldSkipComicBriefExpand } from "@/lib/comic-standalone-pipeline";
import { fallbackComicDirectorPack } from "@/lib/comic-director";
import { applyShotPlanToPages } from "@/lib/comic-shot-plan";
import { checkComicPanelsConsistency } from "@/lib/comic-panel-consistency";
import type { ComicPage } from "@/lib/comic-format";

console.log("[OK] shouldUseLong(16, long):", shouldUseLongComicPipeline(16, "long"));
console.log("[OK] shouldUseLong(8, medium):", shouldUseLongComicPipeline(8, "medium"));
console.log("[OK] shouldUseLong(12, medium):", shouldUseLongComicPipeline(12, "medium"));
console.log("[OK] shouldUseLong(9, medium):", shouldUseLongComicPipeline(9, "medium"));
console.log(
  "[OK] skip brief from_novel:",
  shouldSkipComicBriefExpand({
    sourceMode: "from_novel",
    actualNovelId: "n1",
    hasBriefRevision: false,
    skipStandaloneBrief: false,
  }),
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
console.log("[OK] shot prompt length:", planned[0]!.panels[0]!.prompt.length);
console.log("[OK] consistency:", report.ok, "issues:", report.issues.length);

if (!planned[0]!.panels[0]!.prompt.includes("Illustration only")) {
  console.error("[FAIL] missing no-text suffix");
  process.exit(1);
}

console.log("[OK] qa-comic-director-pipeline");
