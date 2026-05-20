import type { CreativeBrief } from "@/lib/creative-brief/types";

/** 将 Creative Brief 格式化为小说正文生成器可读的约束块 */
export function formatCreativeBriefForNovel(brief: CreativeBrief): string {
  const lines: string[] = [
    "【AI 深度扩写 · 小说 Creative Brief】",
    `一句话原意：${brief.userPrompt.trim()}`,
    `Logline：${brief.logline}`,
    `题材包：${brief.packLabel}（${brief.packId}）`,
    `叙事调性：${brief.intent.tone} · 难度/压迫感 ${brief.intent.difficulty}`,
    "",
    "【世界观】",
    brief.world,
    "",
    "【关键场景（可化为章节锚点）】",
    ...brief.scenes.map((s) => `- ${s}`),
    "",
    "【势力 / 主要角色 / 关键道具与意象】",
    ...brief.factions.map((s) => `- 势力：${s}`),
    ...brief.units.map((s) => `- 角色：${s}`),
    ...(brief.weapons.length ? brief.weapons.map((s) => `- 道具/能力：${s}`) : []),
    ...brief.vfx.map((s) => `- 意象/场面：${s}`),
    "",
    "【文风与氛围】",
    ...brief.artStyle.map((s) => `- 文风/画面感：${s}`),
    ...brief.mood.map((s) => `- 氛围：${s}`),
    "",
    "【结构落地提示（须体现在正文）】",
    ...brief.gameplayHints.map((s) => `- ${s}`),
  ];

  if (brief.negatives.length) {
    lines.push("", "【勿违背的禁忌】", ...brief.negatives.map((s) => `- 避免：${s}`));
  }

  lines.push(
    "",
    "【硬约束】",
    "- 以上 Brief 补齐用户未说清的人设、冲突与视觉基调；正文仍须完整、有章节标题。",
    "- 至少 2–3 个有名字的主要角色；勿引入未授权 IP 专有名词。",
    "- 开篇须扣住 Logline；高潮与收束须呼应 Brief 中的核心矛盾。",
  );

  return lines.join("\n").slice(0, 3800);
}
