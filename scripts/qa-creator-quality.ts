import { assessComicCreatorQuality, assessNovelCreatorQuality, withCreatorEngagementQuality } from "../src/lib/creator-quality";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const novel = assessNovelCreatorQuality({
  lengthTier: "children",
  prompt: "一个小熊和朋友一起找回春天的故事",
  content: `${"小熊在清晨听见花园里传来细小的哭声。它循着声音找到了失去颜色的花朵，于是邀请朋友们一起浇水、唱歌、等待阳光。".repeat(7)}\n\n${"傍晚时，花园重新开满颜色。小熊明白，照顾朋友和耐心等待都会带来温暖的结果。".repeat(3)}`,
});
assert(novel.report.score !== undefined && novel.report.score >= 75, "complete children's novel should be quality-ready");
assert(novel.report.units?.length === 1, "novel quality should include one repairable chapter unit");
assert(novel.report.units?.[0]?.verdict === "ready", "complete chapter should be quality-ready");

const comic = assessComicCreatorQuality(JSON.stringify({
  formatVersion: 3,
  pageCount: 2,
  director: {
    version: 1,
    title: "test",
    visualStyleEn: "cinematic ink and watercolor comic art",
    characters: [
      { id: "hero", name: "Hero", appearanceEn: "young detective in a blue coat", outfitEn: "blue trench coat" },
      { id: "friend", name: "Friend", appearanceEn: "brave friend with a red scarf", outfitEn: "red scarf and boots" },
    ],
    locations: [{ id: "old-town", name: "Old town", descriptionEn: "rainy old town street at night" }],
    pageBeats: [
      { page: 1, progressPercent: 45, mood: "curious", keyEvents: "hero finds the first clue" },
      { page: 2, progressPercent: 100, mood: "hopeful", keyEvents: "the friends resolve the danger" },
    ],
  },
  pipeline: "long_director",
  pages: [
    { page: 1, panels: [
      { scene: 1, caption: "主角发现线索", prompt: "hero finds clue", imageUrl: "/one.png", characterIds: ["hero"], locationId: "old-town", shotType: "wide" },
      { scene: 2, caption: "同伴加入", prompt: "friend arrives", imageUrl: "/two.png", characterIds: ["friend"], locationId: "old-town", shotType: "medium" },
    ] },
    { page: 2, panels: [
      { scene: 3, caption: "危机升级", prompt: "danger rises", imageUrl: "/three.png", characterIds: ["hero", "friend"], locationId: "old-town", shotType: "close" },
      { scene: 4, caption: "共同解决", prompt: "team resolves", imageUrl: "/four.png", characterIds: ["hero", "friend"], locationId: "old-town", shotType: "over_shoulder" },
    ] },
  ],
}));
assert(comic.report.verdict === "ready", "anchored fully rendered comic should be quality-ready");
assert(comic.report.units?.length === 2, "comic quality should include one repairable unit per page");
assert(comic.report.units?.every((unit) => unit.verdict === "ready"), "rendered pages should be quality-ready");

const inconsistentComic = assessComicCreatorQuality(JSON.stringify({
  formatVersion: 3,
  pageCount: 1,
  director: {
    version: 1,
    title: "test",
    visualStyleEn: "cinematic ink and watercolor comic art",
    characters: [
      { id: "hero", name: "Hero", appearanceEn: "young detective in a blue coat", outfitEn: "blue trench coat" },
      { id: "friend", name: "Friend", appearanceEn: "brave friend with a red scarf", outfitEn: "red scarf and boots" },
    ],
    locations: [{ id: "old-town", name: "Old town", descriptionEn: "rainy old town street at night" }],
    pageBeats: [{ page: 1, progressPercent: 100, mood: "tense", keyEvents: "hero faces the danger" }],
  },
  pipeline: "long_director",
  pages: [{ page: 1, panels: [
    { scene: 2, caption: "错误角色", prompt: "unknown hero", imageUrl: "/one.png", characterIds: ["unknown"], locationId: "old-town", shotType: "wide" },
    { scene: 1, caption: "镜头倒退", prompt: "scene regresses", imageUrl: "/two.png", characterIds: ["hero"], locationId: "old-town", shotType: "medium" },
    { scene: 3, caption: "缺少绑定", prompt: "binding missing", imageUrl: "/three.png" },
    { scene: 4, caption: "继续", prompt: "continue", imageUrl: "/four.png", characterIds: ["friend"], locationId: "old-town", shotType: "close" },
  ] }],
}));
assert(inconsistentComic.report.verdict === "needs_polish", "invalid director bindings must not be quality-ready");
assert(inconsistentComic.report.evidence.some((item) => item.startsWith("storyboard_unknown_characters:")), "quality must explain unknown character bindings");
assert(inconsistentComic.report.evidence.some((item) => item.startsWith("storyboard_scene_order_regressed:")), "quality must explain scene order regressions");

const incompleteComic = assessComicCreatorQuality(JSON.stringify({ formatVersion: 2, pageCount: 1, pages: [{ page: 1, panels: [] }] }));
assert(incompleteComic.report.verdict === "blocked", "empty storyboard should require quality review");
assert(incompleteComic.report.units?.[0]?.verdict === "blocked", "empty page should require page repair");

const withEngagement = withCreatorEngagementQuality(comic.report, {
  sampleSize: 10,
  starts: 10,
  firstActionRate: 80,
  firstMinuteRate: 60,
});
assert(withEngagement.score === comic.report.score, "observed signals must not silently recalibrate quality score");
assert(withEngagement.evidence.includes("first_minute_rate:60%"), "observed signals should be visible as evidence");
console.log("[OK] qa-creator-quality");
