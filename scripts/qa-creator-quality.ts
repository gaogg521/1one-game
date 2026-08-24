import { assessComicCreatorQuality, assessGameCreatorQuality, assessNovelCreatorQuality, withCreatorEngagementQuality } from "../src/lib/creator-quality";
import { assessGameAssetReadiness } from "../src/lib/game-asset-readiness";
import { prepareGameSpecForPersist } from "../src/lib/spec-patch";

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

const plannedNovel = assessNovelCreatorQuality({
  lengthTier: "long",
  prompt: "雨城旅人寻找灯灵的故事",
  content: "=== 第1章 灯火 ===\n\n旅人走进雨城，寻找失落的灯火。".repeat(30),
  generationMeta: {
    version: 1,
    createdAt: new Date().toISOString(),
    segmentCount: 1,
    bible: {
      title: "雨城灯火",
      worldSetting: "被长雨笼罩的旧城，灯火决定居民能否回家。",
      characters: [{ name: "旅人", role: "主角", traits: "执着" }, { name: "灯灵", role: "引路者", traits: "沉静" }],
      coreConflict: "旅人必须在暴雨吞没旧城前找回灯火。",
      endingDirection: "旅人与灯灵带着灯火离开雨城。",
    },
    chapterPlan: { chapters: [
      { num: 1, title: "灯火", summary: "旅人进入雨城寻找失落灯火", phase: "opening", targetChars: 800 },
      { num: 2, title: "钟楼", summary: "旅人追随灯灵前往钟楼", phase: "rising", targetChars: 800 },
      { num: 3, title: "远行", summary: "旅人带着灯灵穿过风暴离开", phase: "resolution", targetChars: 800 },
    ] },
  },
});
assert(plannedNovel.report.verdict !== "ready", "missing planned chapters must not be quality-ready");
assert(plannedNovel.report.evidence.some((item) => item === "story_plan_issue:missing_planned_chapter"), "quality must explain missing plan chapters");

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
  characterRoster: {
    version: 1,
    locked: true,
    characters: [
      { id: "hero", name: "Hero", appearanceZh: "蓝色风衣侦探", outfitZh: "蓝色风衣", referenceImageUrl: "/sheets/hero.png" },
      { id: "friend", name: "Friend", appearanceZh: "红围巾同伴", outfitZh: "红围巾", referenceImageUrl: "/sheets/friend.png" },
    ],
  },
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
assert(inconsistentComic.report.verdict === "blocked", "invalid director bindings must not be publishable");
assert(inconsistentComic.report.evidence.some((item) => item.startsWith("storyboard_unknown_characters:")), "quality must explain unknown character bindings");
assert(inconsistentComic.report.evidence.some((item) => item.startsWith("storyboard_scene_order_regressed:")), "quality must explain scene order regressions");

const incompleteComic = assessComicCreatorQuality(JSON.stringify({ formatVersion: 2, pageCount: 1, pages: [{ page: 1, panels: [] }] }));
assert(incompleteComic.report.verdict === "blocked", "empty storyboard should require quality review");
assert(incompleteComic.report.units?.[0]?.verdict === "blocked", "empty page should require page repair");

const partialComic = assessComicCreatorQuality(JSON.stringify({
  formatVersion: 2,
  pageCount: 1,
  pages: [{ page: 1, panels: [
    { caption: "第一格", prompt: "first panel", imageUrl: "/one.png" },
    { caption: "第二格", prompt: "second panel" },
    { caption: "第三格", prompt: "third panel" },
    { caption: "第四格", prompt: "fourth panel" },
  ] }],
}));
assert(partialComic.report.verdict === "blocked", "partially rendered comic must not be publishable");
assert(partialComic.report.evidence.includes("publication_images_incomplete:1/4"), "partial comic must explain its missing images");

const sourceBoundComic = assessComicCreatorQuality(JSON.stringify({
  formatVersion: 2,
  pageCount: 1,
  pages: [{ page: 1, panels: [
    { caption: "起", prompt: "opening", imageUrl: "/one.png", sourceSegmentIndex: 1 },
    { caption: "承", prompt: "middle", imageUrl: "/two.png", sourceSegmentIndex: 0 },
    { caption: "转", prompt: "turn", imageUrl: "/three.png" },
    { caption: "合", prompt: "ending", imageUrl: "/four.png", sourceSegmentIndex: 99 },
  ] }],
}), { sourceContent: "第一段正文必须足够详细，包含人物在雨夜街头发现线索、决定追查真相以及走向旧钟楼的过程。\n\n第二段正文同样足够详细，包含同伴赶来支援、危机突然升级并一起找到解决办法的完整情节。" });
assert(sourceBoundComic.report.verdict === "blocked", "comic with broken novel bindings must not be publishable");
assert(sourceBoundComic.report.evidence.some((item) => item.startsWith("publication_source_order_regressed:")), "source binding must preserve plot order");
assert(sourceBoundComic.report.evidence.some((item) => item.startsWith("publication_source_binding_missing:")), "every panel needs a source binding");

const gameSpec = prepareGameSpecForPersist(undefined, "霓虹飞船穿过机械舰队");
const missingAssets = assessGameCreatorQuality(gameSpec, null, assessGameAssetReadiness(null));
assert(missingAssets.report.verdict === "blocked", "game without durable visual assets must not publish");
const readyAssets = assessGameCreatorQuality(gameSpec, null, assessGameAssetReadiness({
  backgroundUrl: "/game-bg/qa.png",
  sprites: [{ kind: "player", url: "/game-sprites/qa/player.png" }, { kind: "hazard", url: "/game-sprites/qa/hazard.png" }],
  manifest: { slots: [
    { slot: "background", url: "/game-bg/qa.png" },
    { slot: "player", url: "/game-sprites/qa/player.png" },
    { slot: "enemy", url: "/game-sprites/qa/hazard.png" },
  ] },
}));
assert(readyAssets.report.verdict !== "blocked", "game with durable core assets should retain design quality verdict");

const withEngagement = withCreatorEngagementQuality(comic.report, {
  sampleSize: 10,
  starts: 10,
  firstActionRate: 80,
  firstMinuteRate: 60,
});
assert(withEngagement.score === comic.report.score, "observed signals must not silently recalibrate quality score");
assert(withEngagement.evidence.includes("first_minute_rate:60%"), "observed signals should be visible as evidence");
console.log("[OK] qa-creator-quality");
