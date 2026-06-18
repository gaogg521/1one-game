import type { AppLocale } from "@/i18n/routing";
import { apiErrorMessage } from "@/lib/i18n/progress-message";
import { clarifyGatewayUpstreamError } from "@/lib/llm/errors";
import { openAiChatOutputTokenLimits } from "@/lib/llm/openai-token-param";
import { getGameModelCascade } from "@/lib/game-model-route";
import { PRODUCT } from "@/lib/product-config";
import { getRuntimeConfigSync } from "@/lib/runtime-config";
import { createOpenAIClientForProvider } from "@/lib/runtime-llm-client";
import { resolveSceneRoute } from "@/lib/runtime-providers";

const MAX_SIDE_NOTE =
  "简要列出：①画面主体轮廓与体态 ②配色与光源 ③画风关键词（像素/手绘/水彩/二次元等）④主体与背景的可分性。**另起一行**：用「落地建议」前缀写三小点——(背景是否透明底/纯白/复杂实拍)、(若为可走行兵种或塔楼贴片，推荐使用「居中正方形精灵格」还是保持原宽幅)、(主体是否偏心、是否建议留白边)。总长≤260字中文。";

function buildVisionPrompt(params: { roleHint?: string; imageOrdinal?: number }): string {
  const ord =
    typeof params.imageOrdinal === "number" && params.imageOrdinal > 0
      ? `这是用户本次上传的第 ${params.imageOrdinal} 张参考图；创意描述里的「图${params.imageOrdinal}」即指本张（按图片出现顺序编号）。`
      : "这是一张游戏或美术参考图。";
  const trimmed = params.roleHint?.trim();
  const role = trimmed
    ? `用户标注该图的用途是：「${trimmed}」。请围绕该用途写要点：若是「背景/地图/场景」，强调地貌层次、主色与氛围光，并注明是否适合整张铺底（通常**不要**再套方形精灵裁剪）；若是「怪物/敌军/hazard」，强调轮廓、体型与识别色，默认按**可走行贴片**语义写落地建议（透明底为佳、正方形居中更合适）；若是「主角/守护者/水晶/萝卜/塔/tower」，强调剪影与可读性（塔防贴片常需正方形留白）；若标为塔皮肤但画面过宽也请提醒。其它用途综合写清与玩法氛围相关的视觉信息。`
    : "用户未单独标注用途，请推测最可能的美术用途（场地底图 vs 兵种/物件贴片），并在落地建议里写清是否要透明底或方形居中。";
  return `${ord}\n${role}\n${MAX_SIDE_NOTE}`;
}

export async function describeReferenceImage(params: {
  mimeType: string;
  base64: string;
  /** 创作台「用途」输入，如：背景地图、怪物造型 */
  roleHint?: string;
  /** 本次任务中第几张图（从 1 起），与用户正文「图N」对齐 */
  imageOrdinal?: number;
  uiLocale?: AppLocale;
}): Promise<string> {
  const payload = getRuntimeConfigSync().payload;
  const ctx = resolveSceneRoute(payload, "game_vision");
  if (!ctx) {
    return apiErrorMessage(params.uiLocale ?? "zh-Hans", "visionDescFailed");
  }

  const client = createOpenAIClientForProvider(ctx.provider);
  const models = ctx.models.length ? ctx.models : getGameModelCascade("vision");
  const gatewayBaseUrl = ctx.provider.baseUrl;
  const content = [
    { type: "text" as const, text: buildVisionPrompt(params) },
    {
      type: "image_url" as const,
      image_url: {
        url: `data:${params.mimeType};base64,${params.base64}`,
      },
    },
  ];

  const visionOut = PRODUCT.llm.visionMaxOutputTokens;
  const locale = params.uiLocale ?? "zh-Hans";
  for (const model of models) {
    try {
      const res = await client.chat.completions.create({
        model,
        temperature: 0.3,
        ...openAiChatOutputTokenLimits(model, visionOut),
        messages: [{ role: "user", content }],
      });
      const t = res.choices[0]?.message?.content?.trim();
      if (t?.length) return t.slice(0, 720);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        "[vision-reference]",
        clarifyGatewayUpstreamError(msg, gatewayBaseUrl),
      );
      /* 尝试下一备用模型 */
    }
  }

  return apiErrorMessage(locale, "visionDescFailed");
}
