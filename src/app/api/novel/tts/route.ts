import { NextResponse } from "next/server";
import {
  synthesizeVolcTts,
  isVolcTtsConfigured,
  getVolcTtsConfig,
  volcVoiceLabel,
  resolveVolcVoiceType,
  VOLC_TTS_VOICE_IDS,
  VOLC_TTS_DEFAULT_VOICE,
} from "@/lib/volc-tts";
import { localizedJsonError } from "@/lib/api/localized-error";
import { isApiKeyedError } from "@/lib/api/api-keyed-error";
import { resolveRequestLocaleSync } from "@/lib/i18n/request-locale";

export const maxDuration = 60;

export async function GET(req: Request) {
  const uiLocale = resolveRequestLocaleSync(req);
  const cfg = getVolcTtsConfig();
  const defaultVoiceType = cfg?.voiceType ?? VOLC_TTS_DEFAULT_VOICE;
  return NextResponse.json({
    available: isVolcTtsConfigured(),
    provider: cfg ? "volc" : null,
    voiceType: defaultVoiceType,
    voiceLabel: cfg ? volcVoiceLabel(defaultVoiceType, uiLocale) : null,
    defaultVoiceType,
    voices: VOLC_TTS_VOICE_IDS.map((id) => ({ id, label: volcVoiceLabel(id, uiLocale) })),
  });
}

export async function POST(req: Request) {
  if (!isVolcTtsConfigured()) {
    return localizedJsonError(req, "ttsNotConfigured", 503);
  }

  let body: { text?: string; speedRatio?: number; voiceType?: string };
  try {
    body = (await req.json()) as { text?: string; speedRatio?: number; voiceType?: string };
  } catch {
    return localizedJsonError(req, "invalidJson", 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return localizedJsonError(req, "missingText", 400);
  }

  const voiceType = resolveVolcVoiceType(body.voiceType);

  try {
    const audio = await synthesizeVolcTts(text, {
      speedRatio: typeof body.speedRatio === "number" ? body.speedRatio : undefined,
      voiceType,
    });
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (isApiKeyedError(e)) {
      return localizedJsonError(req, e.errorKey, 502, { params: e.params });
    }
    return localizedJsonError(req, "ttsFailed", 502);
  }
}
