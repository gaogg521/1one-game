import { CHILDREN_THEME_HINTS } from "@/lib/children-novel-creative";
import type { NovelBriefUserRevision, NovelCreativeBrief } from "@/lib/literary-brief/novel-types";

function formatChildrenBriefForPipeline(brief: NovelCreativeBrief): string {
  const lines: string[] = [
    "【AI 深度扩写 · 儿童故事创意构思】",
    brief.title ? `书名：${brief.title}` : "",
    `类型：${brief.genreLabel}`,
    `家长原话：${brief.userPrompt.trim()}`,
    "",
    "【从创意提取 · 须严格遵守】",
    `- 故事方向：${brief.logline}`,
    `- 小问题/困境：${brief.coreConflict}`,
    `- 主角（原创）：${brief.protagonist}`,
    `- 主角目标：${brief.protagonistGoal}`,
    "",
    "【可能主题参考（择贴合者）】",
    CHILDREN_THEME_HINTS.join("、"),
    "",
    "【配角/伙伴】",
    ...brief.characters.map((c) => `- ${c}`),
    "",
    "【情节三步】",
    ...brief.plotBeats.map((b, i) => `${i + 1}. ${b}`),
    "",
    "【关键画面】",
    ...brief.keyScenes.map((s) => `- ${s}`),
    "",
    "【场景基调】",
    brief.setting,
    brief.world,
    "",
    `【基调】${brief.tone}`,
    "",
    "【叙事提示】",
    ...brief.narrativeHints.map((s) => `- ${s}`),
    "",
    "【文风】",
    ...brief.writingStyle.map((s) => `- ${s}`),
    "",
    "【硬约束】",
    "- 成稿须原创角色与场景，禁止模板角色（如小兔豆豆）",
    "- 结构：小问题 → 尝试解决 → 温暖闭环结局",
    "- 输出格式见写作阶段说明：故事标题≤12字、正文、家长共读≤20字",
  ];
  if (brief.negatives.length) {
    lines.push("", "【禁忌】", ...brief.negatives.map((n) => `- ${n}`));
  }
  return lines.filter(Boolean).join("\n").slice(0, 3800);
}

export function formatNovelBriefOneLineSummary(brief: NovelCreativeBrief): string {
  const scene = brief.keyScenes[0] ?? brief.setting;
  return `${brief.logline} · ${scene}`.slice(0, 420);
}

export function formatNovelBriefForPipeline(brief: NovelCreativeBrief): string {
  if (brief.genreId === "children") return formatChildrenBriefForPipeline(brief);

  const lines: string[] = [
    "【AI 深度扩写 · 小说创意构思】",
    brief.title ? `书名：${brief.title}` : "",
    `类型：${brief.genreLabel}`,
    `用户原话：${brief.userPrompt.trim()}`,
    "",
    `【Logline】${brief.logline}`,
    "",
    "【时代与地点】",
    brief.setting,
    "",
    "【世界观】",
    brief.world,
    "",
    "【主角】",
    brief.protagonist,
    "",
    "【核心矛盾】",
    brief.coreConflict,
    "",
    "【主角目标】",
    brief.protagonistGoal,
    "",
    "【主要角色】",
    ...brief.characters.map((c) => `- ${c}`),
    "",
    "【对立面 / 反派势力】",
    ...brief.antagonists.map((c) => `- ${c}`),
    "",
    "【情节节拍（起承转合）】",
    ...brief.plotBeats.map((b) => `- ${b}`),
    "",
    "【关键场景 / 章节锚点】",
    ...brief.keyScenes.map((s) => `- ${s}`),
    "",
    `【基调】${brief.tone}`,
    "",
    "【文风】",
    ...brief.writingStyle.map((s) => `- ${s}`),
    "",
    "【连载与结构提示】",
    ...brief.narrativeHints.map((s) => `- ${s}`),
  ];

  if (brief.negatives.length) {
    lines.push("", "【禁忌】", ...brief.negatives.map((n) => `- ${n}`));
  }

  lines.push(
    "",
    "【硬约束】",
    "- 输出完整中文网文小说正文，多章、每章有标题。",
    "- 禁止出现游戏 templateId、HUD、关卡、玩家单位等游戏开发用语。",
    "- 人物动机与时代/类型一致；勿引入未授权 IP。",
  );

  return lines.filter(Boolean).join("\n").slice(0, 3800);
}

export function mergeNovelBriefRevision(
  brief: NovelCreativeBrief,
  rev: NovelBriefUserRevision,
): NovelCreativeBrief {
  return {
    ...brief,
    logline: rev.logline?.trim() || brief.logline,
    world: rev.world?.trim() || brief.world,
  };
}

export function formatNovelRevisionBlock(rev: NovelBriefUserRevision): string {
  const lines: string[] = ["【用户修订的构思】"];
  if (rev.logline?.trim()) lines.push(`- Logline：${rev.logline.trim()}`);
  if (rev.world?.trim()) lines.push(`- 世界观：${rev.world.trim()}`);
  if (rev.addonNotes?.trim()) lines.push(`- 补充：${rev.addonNotes.trim()}`);
  return lines.join("\n");
}

export function buildNovelPipelinePrompt(
  userPrompt: string,
  brief: NovelCreativeBrief,
  rev?: NovelBriefUserRevision | null,
): string {
  const merged = rev ? mergeNovelBriefRevision(brief, rev) : brief;
  const block = formatNovelBriefForPipeline(merged);
  const revBlock = rev ? formatNovelRevisionBlock(rev) : "";
  return [userPrompt.trim(), "---", block, revBlock].filter(Boolean).join("\n\n").slice(0, 4000);
}
