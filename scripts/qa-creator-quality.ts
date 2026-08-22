import { assessComicCreatorQuality, assessNovelCreatorQuality } from "../src/lib/creator-quality";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const novel = assessNovelCreatorQuality({
  lengthTier: "children",
  prompt: "一个小熊和朋友一起找回春天的故事",
  content: `${"小熊在清晨听见花园里传来细小的哭声。它循着声音找到了失去颜色的花朵，于是邀请朋友们一起浇水、唱歌、等待阳光。".repeat(7)}\n\n${"傍晚时，花园重新开满颜色。小熊明白，照顾朋友和耐心等待都会带来温暖的结果。".repeat(3)}`,
});
assert(novel.report.score !== undefined && novel.report.score >= 75, "complete children's novel should be quality-ready");

const comic = assessComicCreatorQuality(JSON.stringify({
  formatVersion: 3,
  pageCount: 2,
  director: { title: "test" },
  pages: [
    { page: 1, panels: [
      { caption: "主角发现线索", prompt: "hero finds clue", imageUrl: "/one.png" },
      { caption: "同伴加入", prompt: "friend arrives", imageUrl: "/two.png" },
    ] },
    { page: 2, panels: [
      { caption: "危机升级", prompt: "danger rises", imageUrl: "/three.png" },
      { caption: "共同解决", prompt: "team resolves", imageUrl: "/four.png" },
    ] },
  ],
}));
assert(comic.report.verdict === "ready", "anchored fully rendered comic should be quality-ready");

const incompleteComic = assessComicCreatorQuality(JSON.stringify({ formatVersion: 2, pageCount: 1, pages: [{ page: 1, panels: [] }] }));
assert(incompleteComic.report.verdict === "blocked", "empty storyboard should require quality review");
console.log("[OK] qa-creator-quality");
