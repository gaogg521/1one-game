/**
 * 验证《不小心穿越到雍正四爷党》封面题材与 prompt
 * npx tsx scripts/qa-novel-cover-yongzheng.ts
 */
import { buildCoverPrompt } from "@/lib/cover-generation";
import {
  inferCoverGenre,
  inferStoryGenre,
  resolveNovelCoverGenre,
} from "@/lib/cover-genre";
import { getNovelGenreTag, buildNovelStoredPrompt } from "@/lib/novel-genre-tags";

const TITLE = "不小心穿越到雍正四爷党";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("❌", msg);
    process.exit(1);
  }
  console.log("✅", msg);
}

const tag = getNovelGenreTag("transmigration")!;
const storedPrompt = buildNovelStoredPrompt(TITLE, tag);

const fromTitle = inferCoverGenre(TITLE, "", "");
assert(fromTitle === "transmigration", `书名推断为穿越（得 ${fromTitle}）`);

const urbanSnip =
  "林晨是现代都市白领，在CBD写字楼加班，总裁宴会上被羞辱，突然一道金光将他卷入时空裂缝……";
const oldInfer = inferStoryGenre({
  title: TITLE,
  summary: urbanSnip.slice(0, 80),
  prompt: storedPrompt,
  contentSnippet: urbanSnip,
});

const resolved = resolveNovelCoverGenre({
  title: TITLE,
  summary: urbanSnip.slice(0, 80),
  prompt: storedPrompt,
  contentSnippet: urbanSnip,
  genreTagCoverGenre: tag.coverGenre,
});

assert(resolved === "transmigration", `resolveNovelCoverGenre 保持穿越（得 ${resolved}）`);
console.log("ℹ️  旧 inferStoryGenre（仅正文）=", oldInfer, "（若 urban 说明此前易被误判）");

const prompt = buildCoverPrompt({
  title: TITLE,
  summary: "现代青年意外卷入九子夺嫡，成为四爷党谋士。",
  storyHint: storedPrompt,
  genre: resolved,
  type: "novel",
});

assert(/modern Chinese protagonist/i.test(prompt), "prompt 含现代人像要求");
assert(/Yongzheng|Qing dynasty/i.test(prompt), "prompt 含雍正/清代宫廷");
assert(!/urban web novel cover, contemporary China: luxury CBD only/i.test(prompt), "prompt 非纯都市封面");

console.log("\n--- 封面文生图 prompt（节选）---\n");
console.log(prompt.slice(0, 900));
console.log("\n…\n");
console.log("qa-novel-cover-yongzheng OK");
