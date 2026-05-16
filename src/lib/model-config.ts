/**
 * 模型 ID 的显式配置：一律由环境变量驱动；代码内不再「未配置则偷偷注入备用模型」。
 * 文档默认值仅在与 `.env.example` 对齐的兜底中使用（本地零 env 仍可跑通）。
 */

export function normalizeOpenAIModelId(id: string): string {
  const t = id.trim();
  const prefix = "litellm/";
  if (t.toLowerCase().startsWith(prefix)) return t.slice(prefix.length);
  return t;
}

function splitModelCsv(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  const t = raw.trim();
  if (t === "") return [];
  return t.split(/[,，]/).map((s) => normalizeOpenAIModelId(s)).filter(Boolean);
}

function dedupeModelIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of ids) {
    const t = normalizeOpenAIModelId(m);
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** 须与 `.env.example` 示例值保持一致 */
const DOC_DEFAULT_OPENAI_MODEL = "gpt-5.2";
const DOC_DEFAULT_NOVEL_PRIMARY = "deepseek-v4-pro";
const DOC_DEFAULT_NOVEL_FALLBACK = "doubao-seed-2-pro";
const DOC_DEFAULT_IMAGE_OPENAI = "gpt-image-2";
const DOC_DEFAULT_IMAGE_GEMINI = "gemini-3.1-flash-image-preview";

/**
 * 游戏 / GameSpec / 规格修补 / 视觉参考等文本链路。
 * - `OPENAI_MODEL`：主模型（未设置时用文档默认）
 * - `OPENAI_MODEL_FALLBACKS`：逗号分隔备用；**未设置或整段为空 = 无备用**（只跑主模型）
 */
export function getModelCascade(): string[] {
  const primaryRaw = process.env.OPENAI_MODEL?.trim();
  const primary = normalizeOpenAIModelId(
    primaryRaw !== undefined && primaryRaw !== "" ? primaryRaw : DOC_DEFAULT_OPENAI_MODEL,
  );
  const fallbacks = splitModelCsv(process.env.OPENAI_MODEL_FALLBACKS);
  return dedupeModelIds([primary, ...fallbacks]);
}

/** 小说正文、漫画分镜 JSON */
export function getNovelStyleTextModelCascade(): string[] {
  const p = process.env.NOVEL_LLM_PRIMARY?.trim();
  const f = process.env.NOVEL_LLM_FALLBACK?.trim();
  const primary = normalizeOpenAIModelId(p !== undefined && p !== "" ? p : DOC_DEFAULT_NOVEL_PRIMARY);
  const fallback = normalizeOpenAIModelId(f !== undefined && f !== "" ? f : DOC_DEFAULT_NOVEL_FALLBACK);
  return dedupeModelIds([primary, fallback]);
}

export function getImageGenOpenAIModel(): string {
  const v = process.env.IMAGE_GEN_OPENAI_MODEL?.trim();
  return v !== undefined && v !== "" ? v : DOC_DEFAULT_IMAGE_OPENAI;
}

export function getImageGenGeminiModel(): string {
  const v = process.env.GEMINI_IMAGE_MODEL?.trim();
  return v !== undefined && v !== "" ? v : DOC_DEFAULT_IMAGE_GEMINI;
}

export type ImageGenSizeOption = "1024x1024" | "1024x1536" | "1536x1024";

/** `IMAGE_GEN_SIZE`：1024x1024 | 1024x1536 | 1536x1024；无效或未设时为 1024×1024（1K） */
export function getImageGenDefaultSize(): ImageGenSizeOption {
  const v = process.env.IMAGE_GEN_SIZE?.trim();
  if (v === "1024x1536" || v === "1536x1024" || v === "1024x1024") return v;
  return "1024x1024";
}

/** `COMIC_PANEL_GEN_CONCURRENCY`：漫画分镜配图并发数，1～4，默认 4 */
export function getComicPanelGenConcurrency(): number {
  const raw = process.env.COMIC_PANEL_GEN_CONCURRENCY?.trim();
  if (raw === undefined || raw === "") return 4;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(4, Math.floor(n));
}

/**
 * `IMAGE_GEN_BATCH_PANELS`：单次 `images.generate` 的 `n`（一次请求多张，同一次网关往返）。
 * 0 / false 关闭批量，回退为逐张或并发；默认 4。
 */
export function getImageGenBatchPanelCount(): number {
  const raw = process.env.IMAGE_GEN_BATCH_PANELS?.trim();
  if (raw === "0" || raw === "false" || raw === "off") return 0;
  if (raw === undefined || raw === "") return 4;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.min(4, Math.floor(n));
}
