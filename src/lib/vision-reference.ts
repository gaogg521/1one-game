import type { AppLocale } from "@/i18n/routing";
import { apiErrorMessage } from "@/lib/i18n/progress-message";
import { clarifyGatewayUpstreamError } from "@/lib/llm/errors";
import { openAiChatOutputTokenLimits } from "@/lib/llm/openai-token-param";
import { getGameModelCascade } from "@/lib/game-model-route";
import { PRODUCT } from "@/lib/product-config";
import { getRuntimeConfigSync } from "@/lib/runtime-config";
import { createOpenAIClientForProvider } from "@/lib/runtime-llm-client";
import { resolveSceneRoute } from "@/lib/runtime-providers";

/** 从参考图结构化提取游戏 Brief 建议（供 /api/analyze-ref-image 使用）。 */
export type RefImageGameBrief = {
  /** 推荐模板 ID，可能为 null（无法判断时） */
  suggestedTemplateId: string | null;
  /** 置信度 */
  confidence: "high" | "medium" | "low";
  /** 推荐玩家/守护物主色 hex */
  playerColor: string | null;
  /** 推荐危险物/敌人主色 hex */
  hazardColor: string | null;
  /** 推荐背景色 hex */
  backgroundColor: string | null;
  /** 场景主题关键词（中文名词 2-5 个） */
  themeKeywords: string[];
  /** 画风建议（与 assetStyle 对齐） */
  artStyle: string | null;
};

const ANALYZE_SYSTEM = `你是游戏设计助手，任务是分析一张参考图并输出结构化游戏创意建议，以 JSON 格式返回。

必须输出如下 JSON，不得有任何多余文字：
{
  "suggestedTemplateId": "<模板 ID 或 null>",
  "confidence": "<high|medium|low>",
  "playerColor": "<hex 或 null>",
  "hazardColor": "<hex 或 null>",
  "backgroundColor": "<hex 或 null>",
  "themeKeywords": ["主题词1", "主题词2"],
  "artStyle": "<画风 ID 或 null>"
}

模板 ID 可选值（不确定填 null）：
platformer / shooter / towerDefense / farming / strategy / puzzle / runner / chess / coaster / stealth

artStyle 可选值（不确定填 null）：
cute-cartoon / blocky-pixel / neon-cyber / classic-arcade / bullet-hell / wuxia-flight / nature-organic / paper-craft / hand-drawn

判断依据：
- 若图中有塔楼/城堡/路径/小兵沿路行走 → towerDefense
- 若图中有横版角色跳跃/地形平台 → platformer
- 若图中有飞船/子弹/弹幕/太空 → shooter
- 若图中有农场/田地/作物格/收获 → farming
- 若图中有棋盘/六边形格/军事地图 → strategy
- playerColor：主角/守护物/炮台的主色；hazardColor：敌人/危险物的主色
- backgroundColor：整体场景背景色，通常是图的平均底色
- themeKeywords：图中识别到的 2-5 个中文名词（如 萝卜、僵尸、向日葵、太空船）`;

export async function analyzeRefImageForGameBrief(params: {
  mimeType: string;
  base64: string;
  uiLocale?: AppLocale;
}): Promise<RefImageGameBrief | null> {
  const payload = getRuntimeConfigSync().payload;
  const ctx = resolveSceneRoute(payload, "game_vision");
  if (!ctx) return null;

  const client = createOpenAIClientForProvider(ctx.provider);
  const models = ctx.models.length ? ctx.models : getGameModelCascade("vision");

  const content = [
    { type: "text" as const, text: "请分析这张游戏参考图，输出 JSON 格式的创意建议：" },
    {
      type: "image_url" as const,
      image_url: { url: `data:${params.mimeType};base64,${params.base64}` },
    },
  ];

  for (const model of models) {
    try {
      const res = await client.chat.completions.create({
        model,
        temperature: 0.1,
        max_tokens: 400,
        messages: [
          { role: "system", content: ANALYZE_SYSTEM },
          { role: "user", content },
        ],
      });
      const raw = res.choices[0]?.message?.content?.trim() ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]) as Partial<RefImageGameBrief>;
      return {
        suggestedTemplateId: typeof parsed.suggestedTemplateId === "string" ? parsed.suggestedTemplateId : null,
        confidence: parsed.confidence ?? "low",
        playerColor: typeof parsed.playerColor === "string" ? parsed.playerColor : null,
        hazardColor: typeof parsed.hazardColor === "string" ? parsed.hazardColor : null,
        backgroundColor: typeof parsed.backgroundColor === "string" ? parsed.backgroundColor : null,
        themeKeywords: Array.isArray(parsed.themeKeywords) ? parsed.themeKeywords.slice(0, 6) : [],
        artStyle: typeof parsed.artStyle === "string" ? parsed.artStyle : null,
      };
    } catch {
      /* 尝试下一模型 */
    }
  }
  return null;
}

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
