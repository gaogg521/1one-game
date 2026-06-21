/**
 * LLM 模板分类 —— 三层模板路由的第三层（B 层）。
 *
 * A 层（关键词）+ C 层（embedding）都未命中时触发：让 LLM 从 60 个模板 ID 里选一个。
 * 走 LiteLLM/OpenAI 兼容 chat completions，用快速模型（OPENAI_MODEL 或指定 TEMPLATE_CLASSIFY_MODEL）。
 *
 * 超时 8s，失败返回 null（交回上层走 general-arcade 兜底）。
 */
import { GAME_TEMPLATE_DEFINITIONS } from "@/lib/game-templates/definitions";
import { getTemplateBriefOverride } from "@/lib/creative-brief/template-brief-overrides";
import type { GameTemplateId } from "@/lib/game-templates/registry";
import { isGameTemplateId } from "@/lib/game-templates/registry";

const TIMEOUT_MS = 8000;

function buildCatalog(): string {
  return GAME_TEMPLATE_DEFINITIONS.map((d) => {
    const ov = getTemplateBriefOverride(d.id as GameTemplateId);
    const loop = ov?.playableLoop ? ` | 玩法: ${ov.playableLoop.verb}→${ov.playableLoop.objective}` : "";
    return `${d.id}: ${d.llmSummary}${loop}`;
  }).join("\n");
}

const CATALOG_CACHE = buildCatalog();

export type LlmClassifyResult = {
  templateId: GameTemplateId | null;
  source: "llm";
  raw?: string;
  reason?: string;
};

export async function classifyTemplateByLlm(prompt: string): Promise<LlmClassifyResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL ?? "").replace(/\/$/, "");
  if (!apiKey || !baseUrl) {
    return { templateId: null, source: "llm", reason: "missing API key/base url" };
  }
  const model = process.env.TEMPLATE_CLASSIFY_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.2";
  const system = `你是游戏模板分类器。根据用户的一句话创意，从下列模板 ID 里选最匹配的一个。
只输出模板 ID（一个英文短横线小写字符串），不要输出任何其他内容。

可用模板：
${CATALOG_CACHE}

输出格式：纯 ID，如 "fruit-ninja" 或 "towerDefense"。若实在无法匹配输出 "auto"。`;

  const user = `用户创意：${prompt.trim().slice(0, 500)}\n\n最匹配的模板 ID：`;

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(process.env.OPENAI_EXTRA_HEADERS_JSON ? JSON.parse(process.env.OPENAI_EXTRA_HEADERS_JSON) : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_completion_tokens: 20,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      return { templateId: null, source: "llm", reason: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (data.choices?.[0]?.message?.content ?? "").trim();
    // 提取第一个像模板 ID 的 token
    const m = raw.match(/"?([a-z][a-z0-9-]+)"?/i);
    const candidate = m?.[1]?.toLowerCase() ?? raw.toLowerCase();
    if (candidate === "auto" || !candidate) {
      return { templateId: null, source: "llm", raw, reason: "llm returned auto" };
    }
    if (isGameTemplateId(candidate)) {
      return { templateId: candidate, source: "llm", raw };
    }
    return { templateId: null, source: "llm", raw, reason: `${candidate} not a valid templateId` };
  } catch (e) {
    return { templateId: null, source: "llm", reason: (e as Error).message };
  }
}
