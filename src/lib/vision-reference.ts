import { createOpenAIClient } from "@/lib/openai-client";
import { getModelCascade } from "@/lib/model-cascade";

const MAX_SIDE_NOTE =
  "简要列出画面主体、配色倾向、风格关键词（像素/赛博/卡通等）、角色与道具，≤200字中文。";

function buildVisionPrompt(params: { roleHint?: string; imageOrdinal?: number }): string {
  const ord =
    typeof params.imageOrdinal === "number" && params.imageOrdinal > 0
      ? `这是用户本次上传的第 ${params.imageOrdinal} 张参考图；创意描述里的「图${params.imageOrdinal}」即指本张（按图片出现顺序编号）。`
      : "这是一张游戏或美术参考图。";
  const trimmed = params.roleHint?.trim();
  const role = trimmed
    ? `用户标注该图的用途是：「${trimmed}」。请围绕该用途写要点：若是「背景/地图/场景」，强调地貌层次、主色与氛围光；若是「怪物/敌军/hazard」，强调轮廓、体型、主色与识别特征（便于映射到游戏中的威胁视觉）；若是「主角/玩家/塔/hero」，强调造型与主色（便于映射到玩家侧）；其他用途则综合提取对玩法氛围最有用的视觉信息。`
    : "用户未单独标注用途，请综合提取对游戏美术与氛围最有用的信息。";
  return `${ord}\n${role}\n${MAX_SIDE_NOTE}`;
}

export async function describeReferenceImage(params: {
  mimeType: string;
  base64: string;
  /** 创作台「用途」输入，如：背景地图、怪物造型 */
  roleHint?: string;
  /** 本次任务中第几张图（从 1 起），与用户正文「图N」对齐 */
  imageOrdinal?: number;
}): Promise<string> {
  const client = createOpenAIClient();
  const models = getModelCascade();
  const content = [
    { type: "text" as const, text: buildVisionPrompt(params) },
    {
      type: "image_url" as const,
      image_url: {
        url: `data:${params.mimeType};base64,${params.base64}`,
      },
    },
  ];

  for (const model of models) {
    try {
      const res = await client.chat.completions.create({
        model,
        temperature: 0.3,
        max_tokens: 400,
        messages: [{ role: "user", content }],
      });
      const t = res.choices[0]?.message?.content?.trim();
      if (t?.length) return t.slice(0, 600);
    } catch {
      /* 尝试下一备用模型 */
    }
  }

  return "（未能生成图片描述）";
}
