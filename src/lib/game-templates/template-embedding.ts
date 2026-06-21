/**
 * Embedding 语义匹配 —— 三层模板路由的第二层（C 层）。
 *
 * A 层（关键词正则）未命中时触发：把用户 prompt 向量化，与预计算的 60 模板语义向量
 * 算余弦相似度，返回 top1。若 top1 相似度 < CONFIDENCE_THRESHOLD 则交由 B 层（LLM 分类）。
 *
 * 预计算向量存在 src/lib/game-templates/template-embeddings.json，
 * 由 scripts/precompute-template-embeddings.ts 生成。
 *
 * 注意：本层需要 OPENAI_BASE_URL 网关支持 /v1/embeddings 且注册了 embedding 模型。
 * 当前 LiteLLM 网关未注册 embedding 模型，本层会静默返回 null（交由 B 层 LLM 兜底）。
 * 若将来网关支持 embedding，运行 scripts/precompute-template-embeddings.ts 生成 JSON 即可自动启用。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { GAME_TEMPLATE_DEFINITIONS } from "@/lib/game-templates/definitions";
import { getTemplateBriefOverride } from "@/lib/creative-brief/template-brief-overrides";
import { detectTemplateFromPrompt } from "@/lib/template-selector";
import { classifyTemplateByLlm } from "@/lib/game-templates/llm-classify";
import type { GameTemplateId } from "@/lib/game-templates/registry";

const EMBEDDINGS_FILE = path.join(process.cwd(), "src/lib/game-templates/template-embeddings.json");
const CONFIDENCE_THRESHOLD = 0.55;

type EmbeddingRecord = {
  templateId: string;
  text: string;
  embedding: number[];
};

let cache: EmbeddingRecord[] | null = null;

async function loadEmbeddings(): Promise<EmbeddingRecord[]> {
  if (cache) return cache;
  try {
    const raw = await readFile(EMBEDDINGS_FILE, "utf8");
    cache = JSON.parse(raw) as EmbeddingRecord[];
    return cache;
  } catch {
    return [];
  }
}

/** 调 LiteLLM/OpenAI 兼容的 embeddings 端点 */
async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "").replace(/\/$/, "");
  if (!apiKey || !baseUrl) return null;
  const model = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
  try {
    const res = await fetch(`${baseUrl}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(process.env.OPENAI_EXTRA_HEADERS_JSON ? JSON.parse(process.env.OPENAI_EXTRA_HEADERS_JSON) : {}),
      },
      body: JSON.stringify({ model, input: text.slice(0, 8000) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type EmbeddingMatchResult = {
  templateId: GameTemplateId | null;
  confidence: number;
  source: "embedding";
  topScores: Array<{ templateId: string; score: number }>;
};

/**
 * C 层：用 embedding 语义匹配用户 prompt 到模板。
 * 调用方应先跑 A 层（detectTemplateFromPrompt），A 返回 null 时再调本函数。
 */
export async function matchTemplateByEmbedding(prompt: string): Promise<EmbeddingMatchResult> {
  const records = await loadEmbeddings();
  if (records.length === 0) {
    return { templateId: null, confidence: 0, source: "embedding", topScores: [] };
  }
  const userVec = await embedText(prompt.trim());
  if (!userVec) {
    return { templateId: null, confidence: 0, source: "embedding", topScores: [] };
  }
  const scored = records
    .map((r) => ({ templateId: r.templateId, score: cosineSimilarity(userVec, r.embedding) }))
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  const confidence = top?.score ?? 0;
  const matched = confidence >= CONFIDENCE_THRESHOLD && top ? (top.templateId as GameTemplateId) : null;
  return {
    templateId: matched,
    confidence,
    source: "embedding",
    topScores: scored.slice(0, 5),
  };
}

/**
 * 三层瀑布总入口：A（关键词）→ C（embedding）→ B（LLM 分类）→ null。
 * 返回 { templateId, source, confidence }。
 *
 * 正常情况 A 命中（零延迟）；A 未命中走 C（~200ms，需 embedding API）；C 低置信走 B（~1-2s LLM）。
 */
export async function resolveTemplateSemantic(prompt: string): Promise<{
  templateId: GameTemplateId | null;
  source: "keyword" | "embedding" | "llm" | "none";
  confidence: number;
  embeddingTopScores?: Array<{ templateId: string; score: number }>;
  llmRaw?: string;
  llmReason?: string;
}> {
  // A 层：关键词正则（零延迟，覆盖精确/常见说法）
  const keywordHit = detectTemplateFromPrompt(prompt);
  if (keywordHit) {
    return { templateId: keywordHit, source: "keyword", confidence: 1 };
  }
  // C 层：embedding 语义匹配（需网关支持 /v1/embeddings；当前网关无 embedding 模型则静默跳过）
  const emb = await matchTemplateByEmbedding(prompt);
  if (emb.templateId) {
    return {
      templateId: emb.templateId,
      source: "embedding",
      confidence: emb.confidence,
      embeddingTopScores: emb.topScores,
    };
  }
  // B 层：LLM 分类兜底（任意自然语言 → 60 模板 ID）
  const llm = await classifyTemplateByLlm(prompt);
  if (llm.templateId) {
    return {
      templateId: llm.templateId,
      source: "llm",
      confidence: 0.8,
      llmRaw: llm.raw,
    };
  }
  return {
    templateId: null,
    source: "none",
    confidence: emb.confidence,
    embeddingTopScores: emb.topScores,
    llmReason: llm.reason,
  };
}

/** 构建某模板的语义文档（供预计算 embedding 用） */
export function buildTemplateSemanticText(templateId: string): string {
  const def = GAME_TEMPLATE_DEFINITIONS.find((d) => d.id === templateId);
  const ov = getTemplateBriefOverride(templateId as GameTemplateId);
  const parts: string[] = [];
  if (def) {
    parts.push(`模板: ${def.id}`);
    parts.push(`副标题: ${def.defaultSubtitle}`);
    parts.push(`玩法摘要: ${def.llmSummary}`);
  }
  if (ov) {
    parts.push(`世界观: ${ov.world}`);
    parts.push(`场景: ${ov.scenes.join(", ")}`);
    parts.push(`单位: ${ov.units.join(", ")}`);
    if (ov.playableLoop) {
      parts.push(`玩法: ${ov.playableLoop.verb} → ${ov.playableLoop.objective}`);
      parts.push(`反馈: ${ov.playableLoop.feedback}`);
    }
    parts.push(`提示: ${ov.gameplayHints.join("; ")}`);
  }
  return parts.join("\n");
}
