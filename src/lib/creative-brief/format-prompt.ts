import type { BriefMedium, CreativeBrief } from "@/lib/creative-brief/types";
import type { AppLocale } from "@/i18n/routing";
import { creativeBriefBulletMessage } from "@/lib/i18n/progress-message";

/** 将 Creative Brief 格式化为 GameSpec 生成器可读的约束块 */
export function formatCreativeBriefForGameSpec(brief: CreativeBrief): string {
  const lines: string[] = [
    "【AI 深度扩写 · Creative Brief】",
    `一句话原意：${brief.userPrompt.trim()}`,
    `Logline：${brief.logline}`,
    `题材包：${brief.packLabel}（${brief.packId}）`,
    `玩法倾向：模板 ${brief.intent.templateHint} · 调性 ${brief.intent.tone} · 难度 ${brief.intent.difficulty}`,
    "",
    "【世界观】",
    brief.world,
    "",
    "【场景】",
    ...brief.scenes.map((s) => `- ${s}`),
    "",
    "【势力 / 单位 / 武器 / 特效】",
    ...brief.factions.map((s) => `- 势力：${s}`),
    ...brief.units.map((s) => `- 单位：${s}`),
    ...(brief.weapons.length ? brief.weapons.map((s) => `- 武器：${s}`) : []),
    ...brief.vfx.map((s) => `- 特效：${s}`),
    "",
    "【画风与氛围】",
    ...brief.artStyle.map((s) => `- ${s}`),
    ...brief.mood.map((s) => `- 氛围：${s}`),
    "",
    "【玩法落地提示（必须体现在 GameSpec）】",
    ...brief.gameplayHints.map((s) => `- ${s}`),
  ];

  const th = brief.themeHints;
  if (th.backgroundColor || th.playerColor || th.hazardColor || th.musicProfile) {
    lines.push("", "【主题色与听感建议】");
    if (th.backgroundColor) lines.push(`- backgroundColor 倾向 ${th.backgroundColor}`);
    if (th.playerColor) lines.push(`- playerColor 倾向 ${th.playerColor}`);
    if (th.hazardColor) lines.push(`- hazardColor 倾向 ${th.hazardColor}`);
    if (th.collectibleColor) lines.push(`- collectibleColor 倾向 ${th.collectibleColor}`);
    if (th.musicProfile) lines.push(`- presentation.musicProfile 建议 ${th.musicProfile}`);
  }

  if (brief.negatives.length) {
    lines.push("", "【自动挂载负面约束（勿违背）】", ...brief.negatives.map((s) => `- 避免：${s}`));
  }

  lines.push(
    "",
    "【硬约束】",
    "- 以上 Brief 用于补齐用户未说清的美术与氛围；GameSpec 仍须合法且可运行。",
    "- templateId 须与玩法倾向一致；title/subtitle/labels 用中文且贴合 Brief，勿引入未授权 IP 专有名词。",
    "- theme 六色须与 Brief 色调一致；勿无故改成田园暖色或霓虹赛博（除非 Brief 明确要求）。",
  );

  return lines.join("\n").slice(0, 3600);
}

export function formatBriefOneLineSummary(brief: CreativeBrief): string {
  const scene = brief.scenes[0] ?? brief.world;
  return `${brief.logline} · ${scene}`.slice(0, 420);
}

const HINT_LABEL_KEY: Record<BriefMedium, string> = {
  game: "hintLabelGame",
  novel: "hintLabelNovel",
  comic: "hintLabelComic",
};

const UNIT_LABEL_KEY: Record<BriefMedium, string> = {
  game: "unitLabelGame",
  novel: "unitLabelNovel",
  comic: "unitLabelComic",
};

export function buildStudioBriefBullets(
  brief: CreativeBrief,
  medium: BriefMedium = "game",
  locale: AppLocale = "zh-Hans",
): string[] {
  const tr = (key: string, params?: Record<string, string | number | undefined | null>) =>
    creativeBriefBulletMessage(locale, key, params);
  const unitLabel = tr(UNIT_LABEL_KEY[medium]);
  const hintLabel = tr(HINT_LABEL_KEY[medium]);
  const listSep = locale === "zh-Hans" || locale === "zh-Hant" ? "、" : ", ";
  const clauseSep = locale === "zh-Hans" || locale === "zh-Hant" ? "；" : "; ";
  const templateSuffix =
    medium === "game"
      ? tr("packTemplateSuffix", { templateId: brief.intent.templateHint })
      : "";
  const expandKey =
    brief.expandSource === "pack"
      ? "expandPack"
      : brief.expandSource === "pack+llm"
        ? "expandPackLlm"
        : "expandLlm";

  return [
    tr("logline", { logline: brief.logline }),
    tr("pack", { packLabel: brief.packLabel, templateSuffix }),
    tr("world", { world: brief.world }),
    tr("scenes", { scenes: brief.scenes.slice(0, 3).join(clauseSep) }),
    tr("units", { unitLabel, units: brief.units.slice(0, 4).join(listSep) }),
    tr("artStyle", { style: brief.artStyle.slice(0, 4).join(listSep) }),
    tr("mood", { mood: brief.mood.join(listSep) }),
    tr("hints", { hintLabel, hints: brief.gameplayHints.slice(0, 3).join(clauseSep) }),
    tr(expandKey),
  ];
}
