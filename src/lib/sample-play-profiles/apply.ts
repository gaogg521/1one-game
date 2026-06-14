import type { GameSpec } from "@/lib/game-spec";
import { SAMPLES } from "@/lib/samples";
import { SAMPLE_PLAY_PROFILES } from "@/lib/sample-play-profiles/registry";

export function sampleIdFromProjectId(projectId?: string): string | undefined {
  if (!projectId?.startsWith("sample-")) return undefined;
  return projectId.slice("sample-".length);
}

/** 规范化 prompt 用于与样品馆文本精确匹配 */
export function normalizePromptForProfileMatch(prompt: string): string {
  return prompt.trim().replace(/\s+/g, " ");
}

/** 用户 POST 与某样品 prompt 完全一致时，套用同款 samplePlayProfile（无需 sampleId） */
export function inferSampleIdFromPrompt(prompt: string): string | undefined {
  const norm = normalizePromptForProfileMatch(prompt);
  if (!norm) return undefined;
  const sample = SAMPLES.find((s) => normalizePromptForProfileMatch(s.prompt) === norm);
  return sample?.id;
}

/** 按样品 id 套用 Astrocade 式独立定制（seed / enrich 时调用） */
export function applySamplePlayProfile(
  spec: GameSpec,
  sampleId: string,
  promptHint = "",
): GameSpec {
  const def = SAMPLE_PLAY_PROFILES[sampleId];
  const sample = SAMPLES.find((s) => s.id === sampleId);
  if (!def || !sample) return spec;
  const prompt = promptHint || sample.prompt;
  return def.apply(spec, sample, prompt);
}

/** 试玩时按已烘焙 variantId 重新套用 registry（代码升级后无需改 DB 字段） */
export function reapplySamplePlayProfileByVariant(spec: GameSpec, promptHint = ""): GameSpec {
  const variantId = spec.samplePlayProfile?.variantId;
  if (!variantId) return spec;
  const entry = Object.entries(SAMPLE_PLAY_PROFILES).find(([, d]) => d.variantId === variantId);
  if (!entry) return spec;
  const [sampleId] = entry;
  return applySamplePlayProfile(spec, sampleId, promptHint);
}
