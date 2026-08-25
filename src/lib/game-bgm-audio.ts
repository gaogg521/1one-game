import { getBlobStore } from "@/lib/storage/blob-store";
import { getRuntimeConfigSync } from "@/lib/runtime-config";
import { resolveSceneRouteCandidates, type RuntimeLlmProvider } from "@/lib/runtime-providers";
import type { GameSpec } from "@/lib/game-spec";
import { isAudioOutputModelId } from "@/lib/bgm-model-capability";
import { recordProviderUsage } from "@/lib/provider-usage";

export type ProjectBgmAudio = {
  version: 1;
  source: "audio_model";
  providerId: string;
  model: string;
  url: string;
  mimeType: "audio/wav" | "audio/mpeg" | "audio/opus" | "audio/flac";
  createdAt: string;
};

type AudioResponse = {
  choices?: Array<{ message?: { audio?: { data?: string; format?: string; transcript?: string } } }>;
};

function mimeFor(format: string | undefined): ProjectBgmAudio["mimeType"] | null {
  switch ((format ?? "wav").toLowerCase()) {
    case "wav": return "audio/wav";
    case "mp3": return "audio/mpeg";
    case "opus": return "audio/opus";
    case "flac": return "audio/flac";
    default: return null;
  }
}

function extensionFor(mime: ProjectBgmAudio["mimeType"]): string {
  if (mime === "audio/mpeg") return "mp3";
  if (mime === "audio/opus") return "opus";
  if (mime === "audio/flac") return "flac";
  return "wav";
}

function hasExpectedAudioSignature(bytes: Buffer, mimeType: ProjectBgmAudio["mimeType"]): boolean {
  if (mimeType === "audio/wav") {
    return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WAVE";
  }
  if (mimeType === "audio/mpeg") {
    return bytes.subarray(0, 3).toString("ascii") === "ID3" || (bytes[0] === 0xff && (bytes[1] ?? 0) >= 0xe0);
  }
  if (mimeType === "audio/opus") return bytes.subarray(0, 4).toString("ascii") === "OggS";
  return bytes.subarray(0, 4).toString("ascii") === "fLaC";
}

function buildPrompt(spec: GameSpec): string {
  const audio = spec.production?.audio;
  const ambience = audio?.ambience ?? "arcade";
  const sections = audio?.sections.map((item) => item.section).join(" → ") ?? "intro → build → climax";
  return [
    `Create a short, seamless instrumental game background loop for: ${spec.title}.`,
    `Theme: ${spec.labels.subtitle ?? spec.title}; ambience: ${ambience}; music arc: ${sections}.`,
    "No narration, no lyrics, no spoken words, no branded melody. Use a clean loop suitable under gameplay, about 10 to 16 seconds.",
  ].join("\n");
}

export async function requestBgmAudio(
  provider: RuntimeLlmProvider,
  model: string,
  spec: GameSpec,
  requestFetch: typeof fetch = fetch,
  options?: { recordUsage?: boolean },
): Promise<{ bytes: Buffer; mimeType: ProjectBgmAudio["mimeType"] } | null> {
  if (provider.protocol !== "openai_compatible" || !provider.apiKey.trim() || !provider.baseUrl.trim()) return null;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${provider.apiKey}`,
    "Content-Type": "application/json",
  };
  if (provider.userAgent?.trim()) headers["User-Agent"] = provider.userAgent.trim();

  const startedAt = Date.now();
  let errorCode: string | undefined;
  try {
    const response = await requestFetch(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        modalities: ["text", "audio"],
        audio: { voice: "alloy", format: "wav" },
        temperature: 0.45,
        max_tokens: 700,
        messages: [
          { role: "system", content: "You create short instrumental gameplay soundtracks. Return audio only; never narrate the request." },
          { role: "user", content: buildPrompt(spec) },
        ],
      }),
      // BGM enriches a playable game; it must not hold the durable asset worker
      // hostage behind a slow provider. The deterministic fallback follows.
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      errorCode = `http_${response.status}`;
      return null;
    }
    const body = (await response.json()) as AudioResponse;
    const audio = body.choices?.[0]?.message?.audio;
    const mimeType = mimeFor(audio?.format);
    if (!audio?.data || !mimeType) {
      errorCode = "missing_audio";
      return null;
    }
    // A spoken transcript is a strong signal that this audio model did not make
    // a usable BGM loop.  Reject it and continue to the deterministic fallback.
    if ((audio.transcript ?? "").trim().length > 18) {
      errorCode = "spoken_output";
      return null;
    }
    const bytes = Buffer.from(audio.data, "base64");
    if (bytes.length < 2_048 || bytes.length > 16 * 1024 * 1024) {
      errorCode = "invalid_audio_size";
      return null;
    }
    if (!hasExpectedAudioSignature(bytes, mimeType)) {
      errorCode = "invalid_audio_signature";
      return null;
    }
    return { bytes, mimeType };
  } catch {
    errorCode = "request_failed";
    return null;
  } finally {
    if (options?.recordUsage !== false) {
      recordProviderUsage({
        modality: "audio",
        provider: provider.id,
        model,
        operation: "audio",
        status: errorCode ? "failed" : "succeeded",
        durationMs: Date.now() - startedAt,
        outputUnits: errorCode ? 0 : 1,
        errorCode,
      });
    }
  }
}

/**
 * Calls an explicitly audio-capable model assigned to `game_bgm`, then stores
 * the playable artifact.  A text-only route is intentionally ignored here so
 * callers can immediately use the LLM note fallback instead of sending an
 * incompatible request to a chat model.
 */
export async function generateProjectBgmAudio(projectId: string, spec: GameSpec): Promise<ProjectBgmAudio | null> {
  const candidates = resolveSceneRouteCandidates(getRuntimeConfigSync().payload, "game_bgm");
  for (const candidate of candidates.filter((item) => isAudioOutputModelId(item.model))) {
    const generated = await requestBgmAudio(candidate.provider, candidate.model, spec);
    if (!generated) continue;
    const key = `game-bgm/projects/${projectId}.${extensionFor(generated.mimeType)}`;
    const store = await getBlobStore();
    const url = await store.put(key, generated.bytes, generated.mimeType);
    return {
      version: 1,
      source: "audio_model",
      providerId: candidate.provider.id,
      model: candidate.model,
      url,
      mimeType: generated.mimeType,
      createdAt: new Date().toISOString(),
    };
  }
  return null;
}

export function parseProjectBgmAudio(raw: string | null | undefined): ProjectBgmAudio | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ProjectBgmAudio>;
    if (
      value.version === 1 &&
      value.source === "audio_model" &&
      typeof value.url === "string" &&
      value.url.length > 1 &&
      typeof value.model === "string" &&
      typeof value.providerId === "string" &&
      (value.mimeType === "audio/wav" || value.mimeType === "audio/mpeg" || value.mimeType === "audio/opus" || value.mimeType === "audio/flac") &&
      typeof value.createdAt === "string"
    ) return value as ProjectBgmAudio;
  } catch {
    // Corrupt cache must never block the fallback path.
  }
  return null;
}
