import type { GameSpec } from "@/lib/game-spec";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import { inferSampleIdFromPrompt } from "@/lib/sample-play-profiles/apply";
import { sampleProjectId } from "@/lib/sample-gallery";
import { SAMPLES } from "@/lib/samples";

/** 用户/PM 视角：当前作品是否享有「与样品馆同款」体验 */
export type SampleParityUserInfo = {
  variantId: string;
  sampleTitle: string;
  samplePlayPath: string;
  sceneName: string;
  /** prompt 与样品 canonical 对齐（用户 Story 1） */
  promptAligned: boolean;
  /** duplicate / clone 继承 profile（用户 Story 2） */
  fromProfile: boolean;
};

export function resolveSampleParityUserInfo(
  spec: GameSpec,
  promptHint = "",
): SampleParityUserInfo | null {
  const variantId = spec.samplePlayProfile?.variantId;
  if (!variantId) return null;
  const sample = SAMPLES.find((s) => s.id === variantId);
  if (!sample) return null;
  const hint = (promptHint || spec.labels?.subtitle || spec.title || "").trim();
  return {
    variantId,
    sampleTitle: sample.title,
    samplePlayPath: `/play/${sampleProjectId(variantId)}`,
    sceneName: expectedPhaserSceneName(spec),
    promptAligned: inferSampleIdFromPrompt(hint) === variantId,
    fromProfile: true,
  };
}
