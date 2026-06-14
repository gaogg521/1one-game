import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { sampleProjectId } from "@/lib/sample-gallery";
import { inferSampleIdFromPrompt } from "@/lib/sample-play-profiles/apply";
import { SAMPLES } from "@/lib/samples";

/** 创作台尚未生成 spec 时：从 prompt 识别是否对标某款样品 */
export type SampleIntentFromPrompt = {
  variantId: string;
  sampleTitle: string;
  samplePlayPath: string;
};

export function resolveSampleIntentFromPrompt(prompt: string): SampleIntentFromPrompt | null {
  const id = inferSampleIdFromPrompt(prompt.trim());
  if (!id) return null;
  const sample = SAMPLES.find((s) => s.id === id);
  if (!sample) return null;
  return {
    variantId: id,
    sampleTitle: sample.title,
    samplePlayPath: `/play/${sampleProjectId(id)}`,
  };
}

/** 样品馆 → 创作台预填 prompt（用户 Story 1 主入口） */
export function buildCreatePrefillPath(prompt: string, locale?: AppLocale): string {
  const q = `/create?prefill=${encodeURIComponent(prompt.slice(0, 4000))}`;
  return locale ? withLocalePath(q, locale) : q;
}

/** 任意灵感 → 统一入口 /start?prefill=（先推荐载体再进创作页） */
export function buildStartPrefillPath(prompt: string, locale?: AppLocale): string {
  const q = `/start?prefill=${encodeURIComponent(prompt.slice(0, 4000))}`;
  return locale ? withLocalePath(q, locale) : q;
}

/** QA / 深链：从 prefill query 还原 prompt */
export function decodeCreatePrefillParam(raw: string): string {
  try {
    return decodeURIComponent(raw).slice(0, 4000);
  } catch {
    return raw.slice(0, 4000);
  }
}

export function decodeStartPrefillParam(raw: string): string {
  return decodeCreatePrefillParam(raw);
}
