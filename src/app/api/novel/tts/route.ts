import { NextResponse } from "next/server";
import {
  synthesizeVolcTts,
  isVolcTtsConfigured,
  getVolcTtsConfig,
  volcVoiceLabel,
  resolveVolcVoiceType,
  VOLC_TTS_VOICES,
  VOLC_TTS_DEFAULT_VOICE,
} from "@/lib/volc-tts";

export const maxDuration = 60;

export async function GET() {
  const cfg = getVolcTtsConfig();
  const defaultVoiceType = cfg?.voiceType ?? VOLC_TTS_DEFAULT_VOICE;
  return NextResponse.json({
    available: isVolcTtsConfigured(),
    provider: cfg ? "volc" : null,
    voiceType: defaultVoiceType,
    voiceLabel: cfg ? volcVoiceLabel(defaultVoiceType) : null,
    defaultVoiceType,
    voices: VOLC_TTS_VOICES.map((v) => ({ id: v.id, label: v.label })),
  });
}

export async function POST(req: Request) {
  if (!isVolcTtsConfigured()) {
    return NextResponse.json(
      { error: "未配置火山引擎 TTS，请在 .env 设置 VOLC_TTS_APP_ID 与 VOLC_TTS_ACCESS_TOKEN" },
      { status: 503 },
    );
  }

  let body: { text?: string; speedRatio?: number; voiceType?: string };
  try {
    body = (await req.json()) as { text?: string; speedRatio?: number; voiceType?: string };
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "缺少 text" }, { status: 400 });
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "语音合成失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
