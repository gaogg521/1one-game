import { llmJson } from "@/lib/llm";
import {
  buildPrereadExcerpt,
  fetchComicCharacterRoster,
  rosterFromNovelMeta,
  type ComicCharacterRoster,
} from "@/lib/comic-character-roster";
import type { NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";

export type ComicPlotDigest = {
  version: 1;
  summary: string;
  emotionalArc: string;
  keyProps: string;
};

export type ComicPrereadPack = {
  plotDigest: ComicPlotDigest;
  characterRoster: ComicCharacterRoster;
};

const DIGEST_SCHEMA = {
  name: "comic_plot_digest",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      emotionalArc: { type: "string" },
      keyProps: { type: "string" },
    },
    required: ["summary", "emotionalArc", "keyProps"],
  },
};

export async function fetchComicPlotDigest(params: {
  model: string;
  novelTitle: string;
  contentExcerpt: string;
}): Promise<ComicPlotDigest | null> {
  const result = await llmJson({
    model: params.model,
    system: `你是漫画改编责编。请先通读全文节选，再输出剧情精读包 JSON。
禁止编造节选中没有的情节；summary 覆盖起承转合；emotionalArc 写情绪曲线；keyProps 列关键道具与场景。`,
    user: `书名：${params.novelTitle}

【全文节选】
${params.contentExcerpt.slice(0, 20000)}

输出 JSON。`,
    jsonSchema: DIGEST_SCHEMA,
    temperature: 0.35,
    mode: "json_schema",
    timeoutMs: 90_000,
  });

  if (!result.ok || !result.raw || typeof result.raw !== "object") return null;
  const raw = result.raw as { summary?: string; emotionalArc?: string; keyProps?: string };
  if (!raw.summary?.trim()) return null;
  return {
    version: 1,
    summary: raw.summary.trim().slice(0, 1200),
    emotionalArc: String(raw.emotionalArc ?? "").trim().slice(0, 400),
    keyProps: String(raw.keyProps ?? "").trim().slice(0, 400),
  };
}

export function formatPlotDigestForPrompt(digest: ComicPlotDigest): string {
  return `【全书剧情精读】
${digest.summary}

情绪弧线：${digest.emotionalArc}
关键道具/场景：${digest.keyProps}`;
}

/** 全书精读：剧情摘要 + 人设卡（优先用户/圣经，否则 LLM 提取） */
export async function buildComicPrereadPack(params: {
  model: string;
  novelTitle: string;
  novelSummary: string;
  novelContent: string;
  novelMeta: NovelGenerationMeta | null;
  userRoster?: ComicCharacterRoster | null;
}): Promise<ComicPrereadPack | null> {
  const excerpt = buildPrereadExcerpt(params.novelContent);
  const digest = await fetchComicPlotDigest({
    model: params.model,
    novelTitle: params.novelTitle,
    contentExcerpt: excerpt,
  });
  if (!digest) return null;

  let roster =
    params.userRoster?.characters.length
      ? params.userRoster
      : rosterFromNovelMeta(params.novelMeta);

  if (!roster?.characters.length) {
    roster =
      (await fetchComicCharacterRoster({
        model: params.model,
        novelTitle: params.novelTitle,
        novelSummary: params.novelSummary,
        contentExcerpt: excerpt,
      })) ?? null;
  }

  if (!roster) return null;
  return { plotDigest: digest, characterRoster: roster };
}
