/**
 * 主流模型厂商模板 — 供 Console 参考 Base URL、协议、示例模型。
 * 用户仍需填入自己的 API Key；Base URL 可按企业 proxy 调整。
 */
import { PRODUCT } from "@/lib/product-config";
import type { LlmProtocol, RuntimeLlmProvider } from "@/lib/runtime-providers";
import { newRuntimeProviderId } from "@/lib/runtime-providers";

export type ProviderTemplateCategory = "enterprise" | "global" | "cn" | "router" | "custom";

export type ProviderTemplate = {
  id: string;
  category: ProviderTemplateCategory;
  name: string;
  vendor: string;
  protocol: LlmProtocol;
  baseUrl: string;
  docsUrl?: string;
  models: string[];
  noteKey: string;
};

const TEXT_MODELS = [
  PRODUCT.models.gamePrimary,
  ...PRODUCT.models.gameFallbacks,
  PRODUCT.models.novelTextPrimary,
  PRODUCT.models.novelTextFallback,
].filter(Boolean);

export function dedupeModels(models: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of models) {
    const t = m.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: "litellm",
    category: "enterprise",
    name: "LiteLLM 企业网关（文本）",
    vendor: "LiteLLM",
    protocol: "openai_compatible",
    baseUrl: "https://litellm-internal.example.com/v1",
    docsUrl: "https://docs.litellm.ai/docs/proxy/quick_start",
    models: TEXT_MODELS,
    noteKey: "litellm",
  },
  {
    id: "litellm_image",
    category: "enterprise",
    name: "LiteLLM 企业网关（文生图）",
    vendor: "LiteLLM",
    protocol: "openai_compatible",
    baseUrl: "https://litellm-internal.example.com/v1",
    docsUrl: "https://docs.litellm.ai/docs/image_generation",
    models: [PRODUCT.models.imageOpenAI, "dall-e-3", "gpt-image-1"],
    noteKey: "litellm_image",
  },
  {
    id: "oneapi",
    category: "enterprise",
    name: "One API / New API 中转",
    vendor: "One API",
    protocol: "openai_compatible",
    baseUrl: "https://your-oneapi.example.com/v1",
    docsUrl: "https://github.com/songquanpeng/one-api",
    models: TEXT_MODELS,
    noteKey: "oneapi",
  },
  {
    id: "openai",
    category: "global",
    name: "OpenAI 官方",
    vendor: "OpenAI",
    protocol: "openai_compatible",
    baseUrl: "https://api.openai.com/v1",
    docsUrl: "https://platform.openai.com/docs/api-reference",
    models: dedupeModels(["gpt-4.1", "gpt-4o", "o3-mini", ...TEXT_MODELS]),
    noteKey: "openai",
  },
  {
    id: "azure_openai",
    category: "global",
    name: "Azure OpenAI",
    vendor: "Microsoft Azure",
    protocol: "openai_compatible",
    baseUrl: "https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT",
    docsUrl: "https://learn.microsoft.com/azure/ai-services/openai/reference",
    models: ["gpt-4o", "gpt-4.1", "o3-mini"],
    noteKey: "azure_openai",
  },
  {
    id: "anthropic",
    category: "global",
    name: "Anthropic Claude",
    vendor: "Anthropic",
    protocol: "anthropic",
    baseUrl: "https://api.anthropic.com",
    docsUrl: "https://docs.anthropic.com/en/api/getting-started",
    models: ["claude-sonnet-4-20250514", "claude-3-7-sonnet-latest", PRODUCT.models.anthropicPrimary],
    noteKey: "anthropic",
  },
  {
    id: "gemini",
    category: "global",
    name: "Google Gemini",
    vendor: "Google",
    protocol: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    models: dedupeModels(["gemini-2.5-pro-preview", "gemini-2.0-flash", PRODUCT.models.imageGemini, PRODUCT.models.geminiPrimary]),
    noteKey: "gemini",
  },
  {
    id: "mistral",
    category: "global",
    name: "Mistral AI",
    vendor: "Mistral",
    protocol: "openai_compatible",
    baseUrl: "https://api.mistral.ai/v1",
    docsUrl: "https://docs.mistral.ai/api/",
    models: ["mistral-large-latest", "mistral-small-latest"],
    noteKey: "mistral",
  },
  {
    id: "groq",
    category: "global",
    name: "Groq",
    vendor: "Groq",
    protocol: "openai_compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    docsUrl: "https://console.groq.com/docs/openai",
    models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
    noteKey: "groq",
  },
  {
    id: "xai",
    category: "global",
    name: "xAI Grok",
    vendor: "xAI",
    protocol: "openai_compatible",
    baseUrl: "https://api.x.ai/v1",
    docsUrl: "https://docs.x.ai/docs",
    models: ["grok-2-latest", "grok-beta"],
    noteKey: "xai",
  },
  {
    id: "openrouter",
    category: "router",
    name: "OpenRouter",
    vendor: "OpenRouter",
    protocol: "openai_compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    docsUrl: "https://openrouter.ai/docs",
    models: ["openai/gpt-4o", "anthropic/claude-sonnet-4", "google/gemini-2.5-pro-preview"],
    noteKey: "openrouter",
  },
  {
    id: "together",
    category: "router",
    name: "Together AI",
    vendor: "Together",
    protocol: "openai_compatible",
    baseUrl: "https://api.together.xyz/v1",
    docsUrl: "https://docs.together.ai/docs/openai-api",
    models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
    noteKey: "together",
  },
  {
    id: "fireworks",
    category: "router",
    name: "Fireworks AI",
    vendor: "Fireworks",
    protocol: "openai_compatible",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    docsUrl: "https://docs.fireworks.ai/tools-sdks/openai-compatibility",
    models: ["accounts/fireworks/models/llama-v3p3-70b-instruct"],
    noteKey: "fireworks",
  },
  {
    id: "deepseek",
    category: "cn",
    name: "DeepSeek",
    vendor: "深度求索",
    protocol: "openai_compatible",
    baseUrl: "https://api.deepseek.com/v1",
    docsUrl: "https://platform.deepseek.com/api-docs",
    models: dedupeModels(["deepseek-chat", "deepseek-reasoner", PRODUCT.models.novelTextPrimary]),
    noteKey: "deepseek",
  },
  {
    id: "moonshot",
    category: "cn",
    name: "Moonshot / Kimi",
    vendor: "月之暗面",
    protocol: "openai_compatible",
    baseUrl: "https://api.moonshot.cn/v1",
    docsUrl: "https://platform.moonshot.cn/docs/api/chat",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "kimi-latest"],
    noteKey: "moonshot",
  },
  {
    id: "dashscope",
    category: "cn",
    name: "阿里云百炼 / 通义",
    vendor: "阿里云",
    protocol: "openai_compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    docsUrl: "https://help.aliyun.com/zh/model-studio/getting-started",
    models: ["qwen-max", "qwen-plus", "qwen-turbo"],
    noteKey: "dashscope",
  },
  {
    id: "zhipu",
    category: "cn",
    name: "智谱 GLM",
    vendor: "智谱 AI",
    protocol: "openai_compatible",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    docsUrl: "https://open.bigmodel.cn/dev/api",
    models: ["glm-4-plus", "glm-4-flash", "glm-4-air"],
    noteKey: "zhipu",
  },
  {
    id: "doubao",
    category: "cn",
    name: "火山方舟 / 豆包",
    vendor: "字节跳动",
    protocol: "openai_compatible",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    docsUrl: "https://www.volcengine.com/docs/82379",
    models: dedupeModels(["doubao-pro-32k", "doubao-lite-32k", PRODUCT.models.novelTextFallback]),
    noteKey: "doubao",
  },
  {
    id: "minimax",
    category: "cn",
    name: "MiniMax",
    vendor: "MiniMax",
    protocol: "openai_compatible",
    baseUrl: "https://api.minimax.chat/v1",
    docsUrl: "https://platform.minimaxi.com/document",
    models: ["abab6.5s-chat", "abab6.5g-chat"],
    noteKey: "minimax",
  },
  {
    id: "siliconflow",
    category: "cn",
    name: "硅基流动 SiliconFlow",
    vendor: "SiliconFlow",
    protocol: "openai_compatible",
    baseUrl: "https://api.siliconflow.cn/v1",
    docsUrl: "https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions",
    models: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct"],
    noteKey: "siliconflow",
  },
  {
    id: "custom",
    category: "custom",
    name: "完全自定义",
    vendor: "Custom",
    protocol: "openai_compatible",
    baseUrl: "",
    models: [],
    noteKey: "custom",
  },
];

export type ProviderTemplateId = (typeof PROVIDER_TEMPLATES)[number]["id"];

export const PROVIDER_TEMPLATE_GROUPS: { category: ProviderTemplateCategory; labelKey: string }[] = [
  { category: "enterprise", labelKey: "templateGroupEnterprise" },
  { category: "global", labelKey: "templateGroupGlobal" },
  { category: "cn", labelKey: "templateGroupCn" },
  { category: "router", labelKey: "templateGroupRouter" },
  { category: "custom", labelKey: "templateGroupCustom" },
];

export function templatesInCategory(category: ProviderTemplateCategory): ProviderTemplate[] {
  return PROVIDER_TEMPLATES.filter((t) => t.category === category);
}

export function getProviderTemplate(id: string): ProviderTemplate | undefined {
  return PROVIDER_TEMPLATES.find((t) => t.id === id);
}

export function protocolDisplayKey(protocol: LlmProtocol): string {
  if (protocol === "anthropic") return "protocolAnthropic";
  if (protocol === "gemini") return "protocolGemini";
  return "protocolOpenAI";
}

export function createProviderFromTemplate(templateId: string): RuntimeLlmProvider {
  const tpl = getProviderTemplate(templateId) ?? getProviderTemplate("custom")!;
  return {
    id: newRuntimeProviderId(),
    name: tpl.name,
    protocol: tpl.protocol,
    baseUrl: tpl.baseUrl,
    apiKey: "",
    models: [...tpl.models],
    enabled: true,
  };
}
