/**
 * Per-modality protocol adapters.
 *
 * Different vendors behind the same gateway speak different protocols for the
 * same modality: Seedream image generation lives on `/api/seedream/v1/...`
 * with its own payload, Gemini image models answer on `/v1/chat/completions`
 * and return the image inside the message content, and only the GPT image
 * family speaks the OpenAI `/v1/images/generations` shape. Treating them all
 * as "OpenAI compatible" is what silently degraded every generated sprite to a
 * hand-drawn SVG fallback.
 *
 * An adapter is therefore selected by MODEL IDENTITY, never by an environment
 * flag — a flag that lives in `.env.local` is invisible to durable workers,
 * which is exactly how the Seedream adapter came to be skipped in production
 * code paths while appearing correct in the Next.js dev server.
 */

export type Modality = "text" | "image" | "tts" | "video" | "audio";

export type AdapterRequestContext = {
  /** Gateway origin, no trailing slash, no `/v1`. */
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
};

export type AdapterMedia = {
  /** Remote URL when the vendor hosts the artifact. */
  url?: string;
  /** Inline payload when the vendor returns bytes. */
  bytes?: Buffer;
  mimeType?: string;
};

export type AdapterOutcome =
  | { ok: true; media?: AdapterMedia; text?: string; raw?: unknown }
  | { ok: false; error: string; status?: number; raw?: unknown };

export type ModalityAdapter = {
  /** Stable id used in logs, provenance and capability reports. */
  id: string;
  modality: Modality;
  /** True when this adapter owns the given model id. */
  matches: (model: string) => boolean;
  /** Human-readable protocol summary, surfaced by the capability report. */
  describe: () => string;
  invoke: (ctx: AdapterRequestContext, input: AdapterInput) => Promise<AdapterOutcome>;
};

export type AdapterInput = {
  prompt: string;
  /** Image: pixel or tier size. TTS: unused. Video: unused. */
  size?: string;
  /** TTS voice id. */
  voice?: string;
  /** Text: max output tokens. Reasoning models need real headroom here. */
  maxTokens?: number;
  temperature?: number;
  /** Multimodal reference images, as URLs or data URIs. */
  referenceImages?: string[];
  /** Extra vendor-specific fields merged into the request body. */
  extra?: Record<string, unknown>;
};

/**
 * A gateway that does not route a path answers 200 with an empty body rather
 * than 404, so "HTTP ok" alone is not evidence of success. Every adapter runs
 * its response through this before reporting `ok`.
 */
export function isUnroutedGatewayResponse(status: number, byteLength: number, contentType: string | null): boolean {
  return status === 200 && byteLength === 0 && !contentType;
}
