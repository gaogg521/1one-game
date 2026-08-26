/** 作品生成出处：只存服务商与模型 ID，不含 prompt / 密钥。 */

export type WorkGenerationProvenance = {
  generationProvider: string | null;
  generationModel: string | null;
};

const PROVIDER_MAX = 120;
const MODEL_MAX = 240;
const MOCK_MODEL = "mock";

export function isMockGenerationModel(model: string | null | undefined): boolean {
  return (model ?? "").trim().toLowerCase() === MOCK_MODEL;
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
  return normalizeWorkGenerationProvenance({
    provider:
      pickString(root.generationProvider) ??
      pickString(debug?.provider) ??
      pickString(root.provider),
    model:
      pickString(root.generationModel) ??
      pickString(debug?.model) ??
      pickString(debug?.enhanceModel) ??
      pickString(debug?.draftModel) ??
      pickString(root.model),
    fallback: debug?.fallback === true || root.fallback === true,
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
