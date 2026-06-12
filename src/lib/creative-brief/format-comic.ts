import type { CreativeBrief } from "@/lib/creative-brief/types";

/** 将 Creative Brief 格式化为漫画导演包 / 分镜管线可读的约束块 */
export function formatCreativeBriefForComic(brief: CreativeBrief): string {
  const lines: string[] = [
    "【AI 深度扩写 · 漫画改编 Brief】",
    `创意原话：${brief.userPrompt.trim()}`,
    `Logline：${brief.logline}`,
    `题材包：${brief.packLabel}（${brief.packId}）`,
    `视觉调性：${brief.intent.tone}`,
    "",
    "【世界观与改编基调】",
    brief.world,
    "",
    "【分镜锚点场景（优先入画）】",
    ...brief.scenes.map((s) => `- ${s}`),
    "",
    "【角色 / 阵营 / 视觉符号】",
    ...brief.factions.map((s) => `- 阵营：${s}`),
    ...brief.units.map((s) => `- 角色造型：${s}`),
    ...brief.vfx.map((s) => `- 特效/镜头：${s}`),
    "",
    "【画风与镜头氛围】",
    ...brief.artStyle.map((s) => `- ${s}`),
    ...brief.mood.map((s) => `- ${s}`),
    "",
    "【分镜与页节奏提示】",
    ...brief.gameplayHints.map((s) => `- ${s}`),
    "- 成人/通用小说默认每页 8 格关键情节分镜；儿童短篇走独立小人书分格。",
    "- 分镜 prompt 须可画、无文字水印；角色外貌在全书保持一致。",
  ];

  if (brief.negatives.length) {
    lines.push("", "【画面禁忌】", ...brief.negatives.map((s) => `- 避免：${s}`));
  }

  return lines.join("\n").slice(0, 3600);
}
