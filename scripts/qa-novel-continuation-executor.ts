import { executeNovelContinuation } from "../src/lib/novel-continuation-executor";
import type { NovelGenerationMeta } from "../src/lib/novel-long-pipeline-types";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const meta: NovelGenerationMeta = {
  version: 1,
  bible: {
    title: "测试长篇",
    worldSetting: "测试世界观足够完整，用于验证后台续写的乐观锁边界。",
    characters: [
      { name: "林舟", role: "主角", traits: "冷静果断" },
      { name: "宁夏", role: "同伴", traits: "敏锐坚定" },
    ],
    coreConflict: "两人必须在洪水淹没城镇之前找到失落的水闸钥匙。",
    endingDirection: "他们协作守住城市，也重建彼此的信任。",
  },
  chapterPlan: {
    chapters: [
      { num: 1, title: "雨夜", summary: "暴雨来临，主角发现水闸失控的线索。", phase: "opening" },
      { num: 2, title: "旧桥", summary: "同伴带来钥匙去向，二人在旧桥遇险。", phase: "rising" },
      { num: 3, title: "闸门", summary: "两人打开闸门并面对最终选择。", phase: "resolution" },
    ],
  },
  segmentCount: 0,
  createdAt: "2026-08-23T00:00:00.000Z",
};

const initialUpdatedAt = new Date("2026-08-23T01:00:00.000Z");
const checkpointUpdatedAt = new Date("2026-08-23T01:01:00.000Z");
const baseNovel = {
  id: "qa-novel-continuation",
  ownerKey: "qa-owner",
  title: "测试长篇",
  prompt: "暴雨中的两位伙伴守护城市",
  content: "# 第1章 雨夜\n林舟在雨里发现水闸报警。\n",
  summary: "初始摘要",
  lengthTier: "long",
  updatedAt: initialUpdatedAt,
} as never;

async function runSuccessCase() {
  let finalExpectedUpdatedAt: Date | null = null;
  let persisted = false;
  let mirrored = false;
  const result = await executeNovelContinuation({
    novel: baseNovel,
    meta,
    maxChaptersToWrite: 1,
    polish: false,
    uiLocale: "zh-Hans",
    requestId: "qa-success",
    phase: "novel_continue_job",
    dependencies: {
      models: ["qa-model"],
      providerLabel: "qa-provider",
      continueLong: (async (input) => {
        const content = `${baseNovel.content}\n# 第2章 旧桥\n宁夏带来钥匙的线索，两人冲向旧桥。\n`;
        await input.onSegmentCheckpoint?.({ index: 0, content, meta });
        return { content, pipelineMeta: meta, completeness: { ok: true } } as never;
      }) as never,
      assessCompleteness: (() => ({ ok: true })) as never,
      generateSynopsis: (async () => "新的摘要") as never,
      saveCheckpoint: (async () => ({ updatedAt: checkpointUpdatedAt })) as never,
      updateNovel: async (input) => {
        finalExpectedUpdatedAt = input.expectedUpdatedAt;
        return { ...baseNovel, content: input.content, summary: input.summary, updatedAt: new Date("2026-08-23T01:02:00.000Z") } as never;
      },
      persistMeta: async () => { persisted = true; },
      mirror: async () => {
        mirrored = true;
        return { creativeProjectId: "core-project", creativeRevisionId: "core-revision" };
      },
      log: (() => undefined) as never,
    },
  });
  assert(result.status === "completed", "continuation executor must complete the successful model result");
  assert(finalExpectedUpdatedAt?.getTime() === checkpointUpdatedAt.getTime(), "final write must advance its optimistic version after an owned checkpoint");
  assert(persisted && mirrored, "completed continuation must persist meta and mirror a Core revision");
}

async function runConflictCase() {
  let persisted = false;
  let mirrored = false;
  const result = await executeNovelContinuation({
    novel: baseNovel,
    meta,
    maxChaptersToWrite: 1,
    polish: false,
    uiLocale: "zh-Hans",
    requestId: "qa-conflict",
    phase: "novel_continue_job",
    dependencies: {
      models: ["qa-model"],
      continueLong: (async () => ({ content: `${baseNovel.content}\n新增内容`, pipelineMeta: meta, completeness: { ok: true } })) as never,
      assessCompleteness: (() => ({ ok: true })) as never,
      generateSynopsis: (async () => "新的摘要") as never,
      updateNovel: async () => { throw new Error("author_edit_won"); },
      persistMeta: async () => { persisted = true; },
      mirror: async () => { mirrored = true; return { creativeProjectId: "x", creativeRevisionId: "y" }; },
      log: (() => undefined) as never,
    },
  });
  assert(result.status === "conflict", "a concurrent author edit must surface a conflict");
  assert(!persisted && !mirrored, "a conflict must not write pipeline metadata or create a misleading Core revision");
}

async function main() {
  await runSuccessCase();
  await runConflictCase();
  console.log("[OK] qa-novel-continuation-executor");
}

void main();
