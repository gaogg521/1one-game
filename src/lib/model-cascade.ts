/**
 * OpenClaw / LiteLLM 风格：`litellm/gpt-5.2` → 网关上的 model id `gpt-5.2`
 */
export function normalizeOpenAIModelId(id: string): string {
  const t = id.trim();
  const prefix = "litellm/";
  if (t.toLowerCase().startsWith(prefix)) return t.slice(prefix.length);
  return t;
}

/** 与 OpenClaw agents.defaults.model 主备顺序对齐（未设置 OPENAI_MODEL_FALLBACKS 时使用） */
const DEFAULT_MODEL_FALLBACKS = [
  "kimi-k2-6",
  "gemini-3.1-pro-preview",
  "Doubao-Seed-2-Code",
  "gpt-5-4-mini",
  "qwen-3-6-plus",
  "glm-5-1",
] as const;

/**
 * OPENAI_MODEL：主模型（默认 gpt-5.2，对应 litellm/gpt-5.2）
 * OPENAI_MODEL_FALLBACKS：逗号分隔备用列表；未配置时使用上面默认链
 */
export function getModelCascade(): string[] {
  const primary = normalizeOpenAIModelId(process.env.OPENAI_MODEL?.trim() || "gpt-5.2");
  const raw = process.env.OPENAI_MODEL_FALLBACKS?.trim();
  const fallbacks =
    raw === undefined || raw === ""
      ? [...DEFAULT_MODEL_FALLBACKS]
      : raw
          .split(/[,，]/)
          .map((s) => normalizeOpenAIModelId(s))
          .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of [primary, ...fallbacks]) {
    if (m && !seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}
