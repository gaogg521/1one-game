import { postJson } from "@/lib/model-adapters/http";
import type { AdapterOutcome, ModalityAdapter } from "@/lib/model-adapters/types";

/**
 * TTS and video adapters.
 *
 * Probed 2026-09-05 against the LiteLLM gateway. Every candidate path answered
 * 200 with a zero-byte body and no content-type — this gateway's response for
 * a path it does not route — while `/v1/chat/completions` on the same key
 * returned real JSON. Paths tried and found unrouted:
 *
 *   TTS    /v1/audio/speech, /v1/audio/speech/generations, /v1/tts,
 *          /api/seedaudio/v1/audio/speech, /api/audio/v1/audio/speech,
 *          /api/volc/v1/audio/speech
 *   video  /v1/video/generations, /v1/videos/generations, /v1/video/generate,
 *          /v1/contents/generations/tasks,
 *          /api/seedance/v1/{video,videos}/generations,
 *          /api/seedance/v1/contents/generations/tasks,
 *          /api/volc/v1/video/generations
 *
 * So the adapters below are wired and shaped, but deliberately report the
 * probe result instead of pretending to work: the gateway path is the missing
 * input, not the code. Supply a working curl (as was done for Seedream, whose
 * `/api/seedream/v1/...` path was likewise undiscoverable from /v1/models) and
 * the endpoint constant below is the only thing that needs to change.
 *
 * TTS in this project already has a working non-gateway path: Volcengine
 * direct, configured through VOLC_TTS_* in .env and used by the listening
 * feature. `volcTtsAdapter` documents that boundary so nobody re-routes it
 * through the gateway and silently gets nothing back.
 */

const UNROUTED_HINT = "not routed on this gateway as of the 2026-09-05 probe — supply a working curl to fill in the endpoint";

/** OpenAI-shaped speech endpoint. Kept because other gateways do serve it. */
export const openaiSpeechAdapter: ModalityAdapter = {
  id: "tts.openai_speech",
  modality: "tts",
  matches: (model) => /^(seed-audio|tts-1|gpt-4o-mini-tts)/i.test(model.trim()),
  describe: () => `POST /v1/audio/speech · binary audio body · ${UNROUTED_HINT}`,
  async invoke(ctx, input): Promise<AdapterOutcome> {
    const res = await postJson(ctx.baseUrl, ctx.apiKey, "/v1/audio/speech", {
      model: ctx.model,
      input: input.prompt,
      voice: input.voice ?? "alloy",
      response_format: "mp3",
      ...(input.extra ?? {}),
    }, ctx.timeoutMs);
    if (!res.ok) return { ok: false, error: res.error, status: res.status };
    if (!res.bytes.length) return { ok: false, error: "speech endpoint returned an empty body" };
    return { ok: true, media: { bytes: res.bytes, mimeType: res.contentType || "audio/mpeg" } };
  },
};

/**
 * Volcengine TTS over the public internet, deliberately NOT through the model
 * gateway — the gateway routes no speech path at all, and this is the channel
 * the listening feature already uses. Credentials come from VOLC_TTS_* in
 * .env; `synthesizeVolcTts` handles the v1 → v3 protocol fallback itself.
 */
export const volcTtsAdapter: ModalityAdapter = {
  id: "tts.volcengine_direct",
  modality: "tts",
  // Volc voice ids (BV700_streaming…) and the generic volc/doubao-tts aliases.
  matches: (model) => /^(volc|bv\d|doubao-tts|seed-audio)/i.test(model.trim()),
  describe: () => "Volcengine TTS public API via VOLC_TTS_* · v1 with v3 fallback · returns mp3 bytes",
  async invoke(_ctx, input): Promise<AdapterOutcome> {
    const { isVolcTtsConfigured, resolveVolcVoiceType, synthesizeVolcTts } = await import("@/lib/volc-tts");
    if (!isVolcTtsConfigured()) {
      return { ok: false, error: "VOLC_TTS_APP_ID / VOLC_TTS_ACCESS_TOKEN are not configured" };
    }
    try {
      const bytes = await synthesizeVolcTts(input.prompt, { voiceType: resolveVolcVoiceType(input.voice) });
      if (!bytes.length) return { ok: false, error: "Volcengine TTS returned an empty buffer" };
      return { ok: true, media: { bytes, mimeType: "audio/mpeg" } };
    } catch (e) {
      return { ok: false, error: `Volcengine TTS failed: ${(e as Error).message}` };
    }
  },
};

export const openaiVideoAdapter: ModalityAdapter = {
  id: "video.openai_shape",
  modality: "video",
  matches: (model) => /^(seedance|wan[\d.]|joyveo|happyhorse)/i.test(model.trim()),
  describe: () => `POST /v1/video/generations · ${UNROUTED_HINT}`,
  async invoke(ctx, input): Promise<AdapterOutcome> {
    const res = await postJson(ctx.baseUrl, ctx.apiKey, "/v1/video/generations", {
      model: ctx.model,
      prompt: input.prompt,
      ...(input.extra ?? {}),
    }, ctx.timeoutMs);
    if (!res.ok) return { ok: false, error: res.error, status: res.status };
    const url = typeof res.json === "object" && res.json
      ? ((res.json as { data?: Array<{ url?: string }> }).data?.[0]?.url ?? null)
      : null;
    if (!url) return { ok: false, error: "video endpoint returned no url", raw: res.json };
    return { ok: true, media: { url, mimeType: "video/mp4" }, raw: res.json };
  },
};

// Volcengine first: it is the channel that actually works here, and it also
// claims the seed-audio-* ids that the (unrouted) gateway speech path matches.
export const TTS_ADAPTERS: ModalityAdapter[] = [volcTtsAdapter, openaiSpeechAdapter];
export const VIDEO_ADAPTERS: ModalityAdapter[] = [openaiVideoAdapter];
