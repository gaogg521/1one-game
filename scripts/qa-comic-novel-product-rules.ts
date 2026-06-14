import assert from "node:assert/strict";

import { resolveComicPipelineMode, validateComicPipelineRequest } from "@/lib/comic-pipeline-mode";
import {
  COMIC_COVER_MAX_HEIGHT_PX,
  NOVEL_COVER_MAX_HEIGHT_PX,
  comicCoverDetailFrameClass,
} from "@/lib/cover-display-sizes";
import {
  selectBlueprintBeatsForChunk,
  type ComicAdaptationBlueprint,
} from "@/lib/comic-adaptation-blueprint";
import {
  assignSourceSegmentIndicesToPages,
  comicPagesAreAllPlaceholders,
  enrichPagesFromNovelSegments,
} from "@/lib/comic-dialogue-extract";
import { buildComicSystemPrompt, softenPanelCaptionForImageGen } from "@/lib/comic-generate-config";
import { resolveComicLayoutId } from "@/lib/comic-layout";
import { inferStoryGenre } from "@/lib/cover-genre";
import { assessNovelCompleteness } from "@/lib/novel-completeness";
import { buildNovelUserMessage, getNovelSystemPrompt, novelMinAcceptChars } from "@/lib/novel-generate-config";
import { splitNovelIntoSegments } from "@/lib/comic-storyboard-segments";

function main() {
  assert.equal(resolveComicPipelineMode({}), "standalone");
  assert.equal(resolveComicPipelineMode({ novelId: "n1" }), "from_novel");
  assert.equal(resolveComicPipelineMode({ sourceMode: "from_novel" }), "from_novel");
  assert.equal(
    resolveComicPipelineMode({ sourceMode: "standalone", novelId: "n1" }),
    "standalone",
    "显式 standalone 应忽略 novelId",
  );
  assert.equal(
    resolveComicPipelineMode({ sourceMode: "from_novel", novelId: "" }),
    "from_novel",
    "显式 from_novel 由服务端校验 novelId",
  );

  assert.equal(validateComicPipelineRequest({ sourceMode: "from_novel" }), "novelNotFound");
  assert.equal(validateComicPipelineRequest({ sourceMode: "standalone" }), "needNovelOrContent");
  assert.equal(
    validateComicPipelineRequest({ sourceMode: "standalone", creativePrompt: "赛博朋克探案" }),
    null,
  );
  assert.equal(validateComicPipelineRequest({ sourceMode: "from_novel", novelId: "n1" }), null);

  assert.equal(NOVEL_COVER_MAX_HEIGHT_PX, 350);
  assert.equal(COMIC_COVER_MAX_HEIGHT_PX, 400);
  assert.match(comicCoverDetailFrameClass, /max-h-\[400px\]/);

  assert.equal(
    resolveComicLayoutId({ lengthTier: "medium" }),
    "grid_4",
    "中篇默认四宫格（降低单次分镜 JSON 格数，迭代十八）",
  );
  assert.equal(
    resolveComicLayoutId({ lengthTier: "long" }),
    "grid_8",
    "长篇仍默认八宫格",
  );

  const comicPrompt = buildComicSystemPrompt(4, "historical", "chinese_wuxia", {
    layoutId: "grid_4",
  });
  assert.match(
    comicPrompt,
    /关键情节|关键故事瞬间/,
    "漫画分镜 prompt 应强调关键情节抽取，而不是线性逐段铺格",
  );
  assert.doesNotMatch(
    comicPrompt,
    /1～2 格|1-2 格|逐段改编/,
    "漫画分镜 prompt 不应继续要求约 1 段 1～2 格的线性映射",
  );

  assert.equal(
    inferStoryGenre({
      title: "穿越到煤山的崇祯帝",
      summary: "现代人穿越成崇祯，试图改写明末亡国结局",
      prompt: "穿越 历史 崇祯 明末",
      contentSnippet: "崇祯十七年三月十九日，天色未明，朕却从后世醒来。",
    }),
    "historical",
    "崇祯/明末题材不得再误判成都市",
  );

  assert.ok(
    ["historical", "transmigration"].includes(
      inferStoryGenre({
        title: "我穿成末代皇帝",
        summary: "现代青年穿越回古代王朝",
        prompt: "穿越 皇帝 王朝",
        contentSnippet: "他睁眼便看见龙榻与宫墙，意识到自己穿越了。",
      }),
    ),
    "古代穿越题材至少应落到历史/穿越视觉，而不是都市",
  );

  assert.ok(
    novelMinAcceptChars("short") >= 1000,
    "短篇最小验收字数应足够高，避免几百字半成品直接入库",
  );

  const novelSystem = getNovelSystemPrompt("short");
  assert.match(novelSystem, /结尾|结局/, "小说 system prompt 应明确要求必须写到结尾");

  const novelUser = buildNovelUserMessage("穿越成崇祯后改写煤山结局", "穿越到煤山的崇祯帝", "short");
  assert.match(novelUser, /完整结尾|明确结局|写完/, "小说 user prompt 应强调要把故事写完整并收束");

  assert.equal(
    assessNovelCompleteness(
      "=== 第1章 开端 ===\n\n他穿越了。\n\n=== 第2章 风暴 ===\n\n大军压境，他决定改命。",
      "short",
    ).ok,
    false,
    "只有开端和推进、没有收束的短篇不应被视为完成",
  );

  const novelBody = `=== 第1章 煤山 ===\n崇祯低声道：「朕不能亡于此。」\n\n=== 第2章 破局 ===\n他终于改写了亡国结局，天下重归太平。`;
  const segments = splitNovelIntoSegments(novelBody);
  const pages = assignSourceSegmentIndicesToPages(
    [{ page: 1, panels: [{ caption: "……", prompt: "scene" }, { caption: "……", prompt: "scene2" }] }],
    segments,
  );
  const enriched = enrichPagesFromNovelSegments(pages, segments);
  const firstCaption = enriched[0]!.panels[0]!.caption ?? "";
  const secondCaption = enriched[0]!.panels[1]!.caption ?? "";
  assert.ok(
    !comicPagesAreAllPlaceholders(enriched),
    "占位格经 enrichPagesFromNovelSegments 后不应仍为全占位",
  );
  assert.match(firstCaption, /朕|不能/, "第1格应回填对白");
  assert.match(secondCaption, /改写/, "第2格无对白时应回填旁白");
  assert.doesNotMatch(secondCaption, /第2章/, "旁白回填应 strip 章节标题 boilerplate");

  const blueprint: ComicAdaptationBlueprint = {
    version: 1,
    consistencyLock: "崇祯须保持明制龙袍与煤山场景一致",
    chapters: [
      {
        chapterNum: 1,
        title: "煤山",
        sceneAnchor: "煤山歪脖树",
        keyBeats: ["朕不能亡于此", "决意改命"],
      },
      {
        chapterNum: 2,
        title: "破局",
        sceneAnchor: "京城",
        keyBeats: ["改写结局", "天下太平"],
      },
    ],
  };
  const chunkBeats = selectBlueprintBeatsForChunk({
    blueprint,
    scopedChapterNums: [1, 2],
    chunkStart: 1,
    chunkEnd: 1,
    pageCount: 2,
    panelsPerPage: 4,
  });
  assert.ok(chunkBeats.length >= 2, "改编蓝图应按页块切片输出关键情节");
  assert.match(chunkBeats.join(" "), /朕不能|改命|改写/, "切片应来自章级 keyBeats");

  assert.match(
    softenPanelCaptionForImageGen("崇祯十七年三月十九日，帝自缢煤山。"),
    /象征|侧影/,
    "自缢 caption 应软化为象征性画面描述",
  );

  console.log("qa-comic-novel-product-rules: ok");
}

main();
