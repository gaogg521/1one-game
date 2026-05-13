/** 供 /api/generate、stream、variants 共用的请求体解析与长度校验。 */
export type GeneratePayload =
  | {
      ok: true;
      prompt: string;
      searchEnhance: boolean;
      templateHint: "auto" | "platformer" | "towerDefense" | "collector" | "survivor" | "avoider";
      enhancePass: boolean;
    }
  | { ok: false; error: string; status: number };

export function parseGeneratePayload(body: unknown): GeneratePayload {
  const prompt =
    typeof body === "object" && body !== null && "prompt" in body
      ? String((body as { prompt?: unknown }).prompt ?? "")
      : "";
  const searchEnhance =
    typeof body === "object" && body !== null && "searchEnhance" in body
      ? Boolean((body as { searchEnhance?: unknown }).searchEnhance)
      : false;
  const templateHintRaw =
    typeof body === "object" && body !== null && "templateHint" in body
      ? String((body as { templateHint?: unknown }).templateHint ?? "auto")
      : "auto";
  const templateHint =
    templateHintRaw === "platformer" ||
    templateHintRaw === "towerDefense" ||
    templateHintRaw === "collector" ||
    templateHintRaw === "survivor" ||
    templateHintRaw === "avoider"
      ? templateHintRaw
      : "auto";
  const enhancePass =
    typeof body === "object" && body !== null && "enhancePass" in body
      ? Boolean((body as { enhancePass?: unknown }).enhancePass)
      : true;
  const trimmed = prompt.trim();
  if (trimmed.length < 2) {
    return { ok: false, error: "描述太短，请至少写几个字", status: 400 };
  }
  if (trimmed.length > 4000) {
    return { ok: false, error: "描述过长", status: 400 };
  }
  return { ok: true, prompt: trimmed, searchEnhance, templateHint: templateHint as any, enhancePass };
}
