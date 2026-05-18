/**
 * 火山引擎 · 豆包语音合成
 * - V3 单向流（推荐）：https://www.volcengine.com/docs/6561/1257584 同系列 V3 文档
 * - V1 HTTP 一次性（备选）：https://www.volcengine.com/docs/6561/1257584
 * 音色：https://www.volcengine.com/docs/6561/97465
 */

import { randomUUID } from "crypto";

const VOLC_TTS_V1_ENDPOINT = "https://openspeech.bytedance.com/api/v1/tts";
const VOLC_TTS_V3_ENDPOINT = "https://openspeech.bytedance.com/api/v3/tts/unidirectional";

/** 有声阅读默认：擎苍 */
export const VOLC_TTS_DEFAULT_VOICE = "BV701_streaming";

export const VOLC_TTS_VOICES = [
  { id: "BV701_streaming", label: "擎苍（有声阅读男）" },
  { id: "BV104_streaming", label: "温柔淑女" },
  { id: "BV115_streaming", label: "古风少御" },
  { id: "BV700_streaming", label: "灿灿" },
  { id: "BV001_streaming", label: "通用女声" },
  { id: "BV002_streaming", label: "通用男声" },
] as const;

export type VolcTtsConfig = {
  appId: string;
  accessKey: string;
  cluster: string;
  voiceType: string;
};

/** 与 openclaw / volc_dubbing_workflow.py 一致：去掉 Bearer 前缀 */
function normalizeVolcAccessToken(raw: string): string {
  return raw.replace(/^Bearer\s*;?\s*/i, "").trim();
}

export function getVolcTtsConfig(): VolcTtsConfig | null {
  const appId =
    process.env.VOLC_TTS_APP_ID?.trim() || process.env.VOLC_TTS_APPID?.trim();
  const accessKeyRaw =
    process.env.VOLC_TTS_ACCESS_TOKEN?.trim() ||
    process.env.VOLC_TTS_TOKEN?.trim() ||
    process.env.VOLC_TTS_ACCESS_KEY?.trim();
  const accessKey = accessKeyRaw ? normalizeVolcAccessToken(accessKeyRaw) : "";
  const voiceType = process.env.VOLC_TTS_VOICE_TYPE?.trim() || VOLC_TTS_DEFAULT_VOICE;
  const cluster = process.env.VOLC_TTS_CLUSTER?.trim() || "volcano_tts";

  if (appId && accessKey) {
    return { appId, accessKey, cluster, voiceType };
  }

  const apiKey = process.env.VOLC_TTS_API_KEY?.trim();
  if (apiKey) {
    const m = apiKey.match(/^(\d+)-(.+)$/);
    if (m) {
      return { appId: m[1]!, accessKey: apiKey, cluster, voiceType };
    }
  }

  return null;
}

export function isVolcTtsConfigured(): boolean {
  return getVolcTtsConfig() !== null;
}

function getV3ResourceId(speakerId: string): string {
  if (speakerId.startsWith("S_")) return "seed-icl-2.0";
  if (speakerId.includes("_uranus_") || speakerId.startsWith("saturn_")) return "seed-tts-2.0";
  return "seed-tts-1.0";
}

function parseV3NdjsonAudio(raw: string): Buffer {
  const chunks: Buffer[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: { code?: number; data?: string; message?: string };
    try {
      parsed = JSON.parse(trimmed) as { code?: number; data?: string; message?: string };
    } catch {
      continue;
    }
    if (parsed.code === 0 && parsed.data) {
      chunks.push(Buffer.from(parsed.data, "base64"));
      continue;
    }
    if (parsed.code === 20000000) break;
    if (parsed.code !== undefined && parsed.code !== 0) {
      throw new Error(parsed.message || `火山 TTS V3 错误 code=${parsed.code}`);
    }
  }
  if (chunks.length === 0) throw new Error("火山 TTS V3 未返回音频数据");
  return Buffer.concat(chunks);
}

async function synthesizeVolcTtsV3(
  text: string,
  cfg: VolcTtsConfig,
  options?: { voiceType?: string; speedRatio?: number },
): Promise<Buffer> {
  const speaker = options?.voiceType ?? cfg.voiceType;
  const speed = options?.speedRatio ?? 1;
  const speechRate = Math.round((speed - 1) * 100);
  const clampedRate = Math.min(100, Math.max(-50, speechRate));

  const body: Record<string, unknown> = {
    user: { uid: "novel-reader" },
    req_params: {
      text,
      speaker,
      audio_params: { format: "mp3", sample_rate: 24000 },
      ...(clampedRate !== 0 ? { speech_rate: clampedRate } : {}),
    },
  };

  const res = await fetch(VOLC_TTS_V3_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-App-Id": cfg.appId,
      "X-Api-Access-Key": cfg.accessKey,
      "X-Api-Resource-Id": getV3ResourceId(speaker),
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`火山 TTS V3 HTTP ${res.status}: ${raw.slice(0, 200)}`);
  }
  return parseV3NdjsonAudio(raw);
}

type VolcTtsV1Response = {
  code?: number;
  message?: string;
  data?: string;
};

/**
 * V1 HTTP 一次性合成（openclaw / volc_dubbing_workflow.py 同款）
 * @see https://www.volcengine.com/docs/6561/1257584
 */
async function synthesizeVolcTtsV1(
  text: string,
  cfg: VolcTtsConfig,
  options?: { voiceType?: string; speedRatio?: number },
): Promise<Buffer> {
  const body = {
    app: {
      appid: cfg.appId,
      /** 鉴权走 Authorization 头；body 内固定字面量（与官方 openclaw 脚本一致） */
      token: "access_token",
      cluster: cfg.cluster,
    },
    user: { uid: randomUUID() },
    audio: {
      voice_type: options?.voiceType ?? cfg.voiceType,
      encoding: "mp3",
      speed_ratio: Math.min(2, Math.max(0.5, options?.speedRatio ?? 1)),
    },
    request: {
      reqid: randomUUID(),
      text,
      text_type: "plain",
      operation: "query",
      with_frontend: 1,
    },
  };

  const res = await fetch(VOLC_TTS_V1_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer;${cfg.accessKey}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let json: VolcTtsV1Response;
  try {
    json = JSON.parse(raw) as VolcTtsV1Response;
  } catch {
    throw new Error(`火山 TTS V1 响应异常（HTTP ${res.status}）`);
  }

  if (!res.ok) {
    throw new Error(json.message || `火山 TTS V1 HTTP ${res.status}`);
  }

  if (json.code !== 3000 || !json.data) {
    throw new Error(json.message || `火山 TTS V1 合成失败（code=${json.code ?? "unknown"}）`);
  }

  return Buffer.from(json.data, "base64");
}

export async function synthesizeVolcTts(
  text: string,
  options?: { voiceType?: string; speedRatio?: number },
): Promise<Buffer> {
  const cfg = getVolcTtsConfig();
  if (!cfg) {
    throw new Error("未配置火山引擎 TTS（VOLC_TTS_APP_ID + VOLC_TTS_ACCESS_KEY）");
  }

  const trimmed = text.trim();
  if (!trimmed) throw new Error("朗读文本为空");
  if (trimmed.length > 900) throw new Error("单段文本过长，请缩短后重试");

  let v1Error: string | null = null;
  try {
    return await synthesizeVolcTtsV1(trimmed, cfg, options);
  } catch (err) {
    v1Error = err instanceof Error ? err.message : String(err);
  }

  try {
    return await synthesizeVolcTtsV3(trimmed, cfg, options);
  } catch (err) {
    const v3Msg = err instanceof Error ? err.message : String(err);
    throw new Error(formatVolcTtsError([v1Error, v3Msg].filter(Boolean).join("；")));
  }
}

export function volcVoiceLabel(voiceType: string): string {
  return VOLC_TTS_VOICES.find((v) => v.id === voiceType)?.label ?? voiceType;
}

export function isAllowedVolcVoice(voiceType: string): boolean {
  return VOLC_TTS_VOICES.some((v) => v.id === voiceType);
}

/** 请求音色 → 合法 voice_type（未知则回退 .env / 默认） */
export function resolveVolcVoiceType(requested?: string | null): string {
  const cfg = getVolcTtsConfig();
  const fallback = cfg?.voiceType ?? VOLC_TTS_DEFAULT_VOICE;
  const id = requested?.trim();
  if (id && isAllowedVolcVoice(id)) return id;
  return fallback;
}

export function formatVolcTtsError(message: string): string {
  if (/grant not found|45000010|requested resource not granted/i.test(message)) {
    return (
      "火山语音鉴权失败：请在控制台开通「豆包语音-语音合成」、确认 APP ID 与 Access Key 来自 " +
      "https://console.volcengine.com/speech/app ，且已授权音色（见音色列表文档）。"
    );
  }
  return message;
}
