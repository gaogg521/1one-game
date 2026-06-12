import assert from "node:assert/strict";

import { buildComicSystemPrompt } from "@/lib/comic-generate-config";
import { resolveComicLayoutId } from "@/lib/comic-layout";
import { inferStoryGenre } from "@/lib/cover-genre";
import { assessNovelCompleteness } from "@/lib/novel-completeness";
import { buildNovelUserMessage, getNovelSystemPrompt, novelMinAcceptChars } from "@/lib/novel-generate-config";

function main() {
  assert.equal(
    resolveComicLayoutId({ lengthTier: "medium" }),
    "grid_8",
    "成人/通用小说默认应切到 8 宫格",
  );

  const comicPrompt = buildComicSystemPrompt(4, "historical", "chinese_wuxia", {
    layoutId: "grid_8",
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

  console.log("qa-comic-novel-product-rules: ok");
}

main();
