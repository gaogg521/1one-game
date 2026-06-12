/**
 * 短篇「先提纲、后写作」真实 LLM 端到端试写
 * 运行：npx tsx scripts/qa-novel-planned-short-e2e.ts
 */
import "dotenv/config";
import { assessNovelCompleteness } from "@/lib/novel-completeness";
import { parseNovelChapters } from "@/lib/novel-chapters";
import { getNovelStyleTextModelCascade } from "@/lib/llm";
import { novelMinAcceptChars } from "@/lib/novel-generate-config";
import { streamPlannedNovelBody } from "@/lib/novel-planned-generate";
import { planNovelScope } from "@/lib/novel-scope-plan";

const PROMPT = "明朝第一位锦衣卫在雨夜客栈识破竹影陷阱，三日内还都城清白。";
const TITLE = "雨夜锦衣";

async function main() {
  const scope = planNovelScope("short");
  console.log("scope:", scope);

  const cascade = getNovelStyleTextModelCascade();
  const model = cascade[0];
  if (!model) throw new Error("无可用小说模型");

  const steps: string[] = [];
  const t0 = Date.now();
  const result = await streamPlannedNovelBody({
    model,
    promptTrim: PROMPT,
    titleTrim: TITLE,
    lengthTier: "short",
    emit: (ev) => {
      const step = typeof ev.step === "string" ? ev.step : "";
      if (["bible_start", "bible_ready", "chapter_plan_start", "chapter_plan_ready", "completion_pass"].includes(step)) {
        steps.push(step);
        console.log(`[${step}]`, (ev as { message?: string }).message ?? "");
      }
    },
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const chapters = parseNovelChapters(result.content);
  const completeness = assessNovelCompleteness(
    result.content,
    "short",
    undefined,
    PROMPT,
    result.pipelineMeta.chapterPlan,
  );
  const minAccept = novelMinAcceptChars("short");

  console.log("\n--- 结果 ---");
  console.log("耗时(s):", elapsed);
  console.log("模型:", model);
  console.log("流程步骤:", steps.join(" → "));
  console.log("规划章数:", result.pipelineMeta.chapterPlan.chapters.length);
  console.log("写成章数:", chapters.length);
  console.log("正文字数:", result.content.length, `(最低 ${minAccept})`);
  console.log("完整性:", completeness.ok ? "通过" : `失败：${completeness.reason}`);
  console.log("末章标题:", chapters.at(-1)?.title);
  console.log("\n--- 正文预览（前 400 字）---\n");
  console.log(result.content.slice(0, 400));
  console.log("\n--- 正文预览（末 300 字）---\n");
  console.log(result.content.slice(-300));

  if (!steps.includes("chapter_plan_ready")) {
    throw new Error("未执行章提纲规划");
  }
  if (result.content.length < minAccept) {
    throw new Error(`正文过短：${result.content.length} < ${minAccept}`);
  }
  if (!completeness.ok) {
    throw new Error(`完整性未通过：${completeness.reason}`);
  }
  if (chapters.length < result.pipelineMeta.chapterPlan.chapters.length) {
    throw new Error("写成章数少于提纲章数");
  }
  if (result.content.includes("已达本篇幅")) {
    throw new Error("仍出现触顶截断收束句");
  }

  console.log("\nqa-novel-planned-short-e2e: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
