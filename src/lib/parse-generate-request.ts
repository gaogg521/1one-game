/** 供 /api/generate、stream、variants 共用的请求体解析与长度校验。 */
/** 模板提示：与 GameSpec.templateId / 字面量白名单一致（含 auto）。 */
import type { GameTemplateId } from "@/lib/game-templates";
import { isGameTemplateId } from "@/lib/game-templates/registry";

export type GenerateTemplateHint = "auto" | GameTemplateId;

/** 创作台 session AssetManifest 的脱敏摘要（仅条数/revision）。 */
export type AssetManifestSummary = {
  schemaVersion: number;
  revision: number;
  itemCount: number;
};

function normalizeTemplateHint(raw: string): GenerateTemplateHint {
  if (raw === "auto") return "auto";
  if (isGameTemplateId(raw)) return raw;
  return "auto";
}

function parseAssetManifestSummary(body: unknown): AssetManifestSummary | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const wrapped = body as { assetManifest?: unknown; clientAssetManifest?: unknown };
  const raw = wrapped.assetManifest ?? wrapped.clientAssetManifest;
  if (typeof raw !== "object" || raw === null) return undefined;
  const o = raw as Record<string, unknown>;
  const schemaVersion = Number(o.schemaVersion);
  const revision = Number(o.revision);
  const itemCount = Number(o.itemCount);
  if (!Number.isFinite(schemaVersion) || !Number.isFinite(revision) || !Number.isFinite(itemCount)) return undefined;
  if (schemaVersion !== 1) return undefined;
  if (itemCount < 0 || itemCount > 64 || revision < 0 || revision > 1e9) return undefined;
  return { schemaVersion, revision, itemCount };
}

export type GeneratePayload =
  | {
      ok: true;
      prompt: string;
      searchEnhance: boolean;
      templateHint: GenerateTemplateHint;
      enhancePass: boolean;
      /** 编排 trace 记入 client_asset_manifest 节点；多套生成不参与 trace 时仍可打结构化日志 */
      assetManifestSummary?: AssetManifestSummary;
    }
  | { ok: false; errorKey: string; status: number };

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
  const templateHint = normalizeTemplateHint(templateHintRaw);
  const enhancePass =
    typeof body === "object" && body !== null && "enhancePass" in body
      ? Boolean((body as { enhancePass?: unknown }).enhancePass)
      : true;
  const assetManifestSummary = parseAssetManifestSummary(body);
  const trimmed = prompt.trim();
  if (trimmed.length < 2) {
    return { ok: false, errorKey: "promptTooShort", status: 400 };
  }
  if (trimmed.length > 4000) {
    return { ok: false, errorKey: "promptTooLong", status: 400 };
  }
  return {
    ok: true,
    prompt: trimmed,
    searchEnhance,
    templateHint,
    enhancePass,
    ...(assetManifestSummary ? { assetManifestSummary } : {}),
  };
}
