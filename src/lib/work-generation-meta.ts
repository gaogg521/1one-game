/** 作品生成出处：只存服务商与模型 ID，不含 prompt / 密钥。 */

export type WorkGenerationProvenance = {
  generationProvider: string | null;
  generationModel: string | null;
};

const PROVIDER_MAX = 120;
const MODEL_MAX = 240;
const MOCK_MODEL = "mock";
export const KERNEL_GENERATION_PROVIDER = "kernel";

export function isMockGenerationModel(model: string | null | undefined): boolean {
  return (model ?? "").trim().toLowerCase() === MOCK_MODEL;
}

export function isLikelyLlmModelId(model: string | null | undefined): boolean {
  const m = (model ?? "").trim().toLowerCase();
  if (!m || m === MOCK_MODEL || m === KERNEL_GENERATION_PROVIDER) return false;
  if (m.includes(".") || m.includes("/") || m.includes(":")) return true;
  return /^(gpt|o[1-9]|claude|gemini|doubao|ep-|deepseek|qwen|grok|mistral|llama)/i.test(m);
}

export function isKernelGeneration(
  provider?: string | null,
  model?: string | null,
): boolean {
  if (isLikelyLlmModelId(model)) return false;
  const p = (provider ?? "").trim().toLowerCase();
  const m = (model ?? "").trim().toLowerCase();
  return p === KERNEL_GENERATION_PROVIDER || m === KERNEL_GENERATION_PROVIDER;
}

/** 内核路径记下的模板 ID；纯 "kernel" 时返回空。 */
export function kernelGenerationTemplate(
  provider?: string | null,
  model?: string | null,
): string {
  if (!isKernelGeneration(provider, model)) return "";
  const m = (model ?? "").trim();
  if (!m || m.toLowerCase() === KERNEL_GENERATION_PROVIDER) return "";
  return m;
}

export function normalizeWorkGenerationProvenance(input: {
  provider?: string | null;
  model?: string | null;
  fallback?: boolean;
}): WorkGenerationProvenance {
  const generationProvider = (input.provider ?? "").trim().slice(0, PROVIDER_MAX) || null;
  let generationModel = (input.model ?? "").trim().slice(0, MODEL_MAX) || null;
  if (!generationModel && input.fallback) generationModel = MOCK_MODEL;
  return { generationProvider, generationModel };
}

export function parseWorkGenerationFromUnknown(body: unknown): WorkGenerationProvenance {
  if (!body || typeof body !== "object") {
    return { generationProvider: null, generationModel: null };
  }
  const root = body as Record<string, unknown>;
  const debug =
    root.debug && typeof root.debug === "object" && !Array.isArray(root.debug)
      ? (root.debug as Record<string, unknown>)
      : null;
  const source = pickString(root.source) ?? pickString(debug?.source);
  const templateHint = pickString(debug?.templateHint);
  const kernelFallback = debug?.kernelFallback === true;
  let provider =
    pickString(root.generationProvider) ??
    pickString(debug?.provider) ??
    pickString(root.provider);
  let model =
    pickString(root.generationModel) ??
    pickString(debug?.model) ??
    pickString(debug?.enhanceModel) ??
    pickString(debug?.draftModel) ??
    pickString(root.model);
  // 采到真实模型就记模型。不要用 source=kernel 把 LLM 调用伪装成「内核编译」。
  if (isLikelyLlmModelId(model)) {
    if ((provider ?? "").toLowerCase() === KERNEL_GENERATION_PROVIDER) {
      provider = undefined;
    }
  } else if (source === "kernel" || (kernelFallback && !model)) {
    provider = provider ?? KERNEL_GENERATION_PROVIDER;
    model =
      model ??
      (templateHint && templateHint.toLowerCase() !== "auto" ? templateHint : undefined) ??
      KERNEL_GENERATION_PROVIDER;
  }
  return normalizeWorkGenerationProvenance({
    provider,
    model,
    fallback: debug?.fallback === true || root.fallback === true || source === "mock",
  });
}

export function formatWorkGenerationLabel(
  provider?: string | null,
  model?: string | null,
): string {
  const p = (provider ?? "").trim();
  const m = (model ?? "").trim();
  if (p && m) return `${p} · ${m}`;
  return m || p;
}

function pickString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t || undefined;
}
