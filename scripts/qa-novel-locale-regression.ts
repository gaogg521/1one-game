import assert from "node:assert/strict";
import { buildNovelUserMessage, getNovelSystemPrompt } from "@/lib/novel-generate-config";
import { validateNovelTitleInput } from "@/lib/novel-display";
import { buildNovelBriefSeed, getNovelGenreTag } from "@/lib/novel-genre-tags";
import { parseNovelChapters } from "@/lib/novel-chapters";
import { assessNovelCompleteness } from "@/lib/novel-completeness";
import { chapterBodyForTts, splitTextForTts } from "@/lib/novel-tts";

function main() {
  const englishTitle = "The First Jinyiwei of Ming";
  const titleValidation = validateNovelTitleInput(englishTitle);
  assert.equal(titleValidation.ok, true, "英文标题不应被中文 15 字限制直接拦截");

  const englishPrompt =
    "Write a short wuxia story in English about the first Jinyiwei of the Ming dynasty.";
  const englishSystem = getNovelSystemPrompt("short", undefined, englishPrompt);
  assert.match(englishSystem, /English/i, "英文输入时系统提示词应明确要求输出英文");
  assert.doesNotMatch(
    englishSystem,
    /擅长中文网络小说/,
    "英文输入时不应继续固定要求输出中文网文",
  );

  const englishUser = buildNovelUserMessage(englishPrompt, englishTitle, "short");
  assert.match(englishUser, /English/i, "英文输入时用户提示词应保留英文输出要求");
  assert.doesNotMatch(
    englishUser,
    /请根据以下创意写完整短篇小说正文/,
    "英文输入时不应继续套用中文用户提示模板",
  );

  const wuxia = getNovelGenreTag("wuxia");
  assert.ok(wuxia, "武侠标签应存在");
  const englishSeed = buildNovelBriefSeed("First Jinyiwei", wuxia!, "", undefined, "en");
  assert.match(englishSeed, /Title:/, "英文创意种子应使用英文字段");
  assert.match(englishSeed, /Genre:/, "英文创意种子应使用英文类型字段");
  assert.doesNotMatch(englishSeed, /书名：|类型：/, "英文创意种子不应继续写成中文");

  const englishContent = `=== Chapter 1: Tavern Whispers ===

Rain drummed on the tiles while Shen Lian waited for the messenger. The inn was half empty, yet every shadow felt like a blade. He kept his hand near the hilt and listened for footsteps on the stair. Old debts and older oaths had brought him back to the capital on a night when no honest man should be abroad. The lantern swayed, and a stranger in gray watched him from the corner without speaking.

=== Chapter 2: The Bamboo Trap ===

Steel flashed through the grove, and the conspiracy finally showed its hand. Shen Lian broke the ambush in three moves, but the real enemy was still hiding inside the capital walls. He chased the survivors through wet bamboo until the trail vanished at a sealed gate. By then he understood the plot was larger than one tavern rumor: someone in the palace wanted the first Jinyiwei dead before dawn.

=== Chapter 3: One Night, One Verdict ===

Before dawn, the traitor fell, the innocent were cleared, and peace returned to the capital at last. Shen Lian sheathed his blade and walked into the morning light, knowing the city could breathe again. The emperor's decree was read at noon, and the people learned that justice could arrive in a single night when the right guard stood watch.`;
  const parsed = parseNovelChapters(englishContent, "en");
  assert.equal(parsed.length, 3, "英文 Chapter 标记应能被解析为章节");
  const completeness = assessNovelCompleteness(
    englishContent,
    "short",
    undefined,
    englishPrompt,
    null,
    "en",
  );
  assert.equal(completeness.ok, true, `英文短篇完结正文应通过完整性校验: ${completeness.reason}`);

  const enBody = chapterBodyForTts("First paragraph.\n\nSecond paragraph.", "en");
  assert.doesNotMatch(enBody, /。/, "英文 TTS 正文不应使用中文句号");
  assert.match(enBody, /\. /, "英文 TTS 段落应以英文句号加空格连接");

  const zhBody = chapterBodyForTts("第一段。\n\n第二段", "zh-Hans");
  assert.match(zhBody, /。$/, "中文 TTS 正文应以中文句号结尾");

  const enChunks = splitTextForTts("Hello world. Another sentence here.", "en");
  assert.ok(enChunks.some((c) => c.includes(" ")), "英文 TTS 分片应保留空格");
}

main();
console.log("qa-novel-locale-regression: ok");
