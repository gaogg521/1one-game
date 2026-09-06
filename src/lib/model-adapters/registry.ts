import { IMAGE_ADAPTERS } from "@/lib/model-adapters/image-adapters";
import { TEXT_ADAPTERS } from "@/lib/model-adapters/text-adapters";
import { TTS_ADAPTERS, VIDEO_ADAPTERS } from "@/lib/model-adapters/media-adapters";
import type { Modality, ModalityAdapter } from "@/lib/model-adapters/types";

/**
 * Model → protocol registry.
 *
 * Resolution is by model identity only. Anything that needs an environment
 * flag to pick a protocol is a bug waiting to happen: the flag will be set in
 * the dev server's `.env.local` and absent in a durable worker, and the
 * mismatch shows up as silently degraded output rather than an error.
 */

const BY_MODALITY: Record<Modality, ModalityAdapter[]> = {
  image: IMAGE_ADAPTERS,
  text: TEXT_ADAPTERS,
  tts: TTS_ADAPTERS,
  video: VIDEO_ADAPTERS,
  audio: [],
};

export function resolveAdapter(modality: Modality, model: string): ModalityAdapter | null {
  return BY_MODALITY[modality].find((a) => a.matches(model)) ?? null;
}

export function listAdapters(modality?: Modality): ModalityAdapter[] {
  if (modality) return [...BY_MODALITY[modality]];
  return Object.values(BY_MODALITY).flat();
}

/** Every modality the registry can currently serve, with its protocol summary. */
export function describeRegistry(): Array<{ modality: Modality; adapter: string; protocol: string }> {
  return (Object.keys(BY_MODALITY) as Modality[]).flatMap((modality) =>
    BY_MODALITY[modality].map((a) => ({ modality, adapter: a.id, protocol: a.describe() })),
  );
}

/**
 * Models a modality is known to serve, used by the capability report so a
 * misconfigured route is caught before it degrades output instead of after.
 */
export const KNOWN_GOOD_MODELS: Partial<Record<Modality, string[]>> = {
  image: ["doubao-seedream-5-0-pro", "gpt-image-2", "gemini-3.1-flash-image-preview", "gemini-3-pro-image"],
  text: ["minimax-2-7", "glm-latest", "deepseek-v4-pro"],
};
