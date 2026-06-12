/**
 * 创作台「制作过程」可读文案：规则推断 + 与用户提示词对齐的说明（非模型 CoT）。
 */

import type { AppLocale } from "@/i18n/routing";
import { tMessage } from "@/lib/i18n/messages";

export type StudioGenerateFlags = {
  searchEnhance: boolean;
  templateHint: string;
  enhancePass: boolean;
};

export type CoCreationIntent = {
  templateId: "auto" | "platformer" | "towerDefense" | "collector" | "survivor" | "avoider" | "shooter";
  premise: string;
  fantasy: string;
  gameplayCore: string;
  strengths: string[];
  risks: string[];
};

export type CoCreationDirection = {
  id: string;
  title: string;
  summary: string;
  templateId: CoCreationIntent["templateId"];
  bullets: string[];
  promptAddon: string;
};

function tr(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  return tMessage(locale, `createStudioNarrative.${key}`, params);
}

/** 截取展示用提示词片段 */
export function summarizePromptForStudio(
  prompt: string,
  locale: AppLocale = "zh-Hans",
  maxLen = 420,
): string {
  const t = prompt.trim().replace(/\s+/g, " ");
  if (!t.length) return tr(locale, "emptyPrompt");
  return t.length <= maxLen ? t : `${t.slice(0, maxLen)}…`;
}

/** 与用户 mock-spec 同款关键词语义，转成面向用户的玩法倾向说明 */
export function guessPlayStyle(prompt: string, locale: AppLocale = "zh-Hans"): string {
  const p = prompt.toLowerCase();
  if (/塔防|保卫萝卜|波次防守|防御塔|箭塔|炮塔|放置塔|\b(td|tower defense|tower\s*defen[cs]e)\b/i.test(p)) {
    return tr(locale, "playStyle.towerDefense");
  }
  if (/射击|飞船|敌机|弹幕|战机|太空战|清屏|shooter|shoot|bullet hell/i.test(p)) {
    return tr(locale, "playStyle.shooter");
  }
  if (/平台|跳台|横版闯关|\b(platformer|platform)\b|马里奥|恶魔城/i.test(prompt) || /\b(platform|jump)\b/.test(p)) {
    return tr(locale, "playStyle.platformer");
  }
  if (/收集|捡|金币|宝石|吃掉|拾起|豆子/i.test(prompt) || /\b(collect|coin|gem|pick\s*up)\b/i.test(p)) {
    return tr(locale, "playStyle.collector");
  }
  if (/生存|多条命|血条|尽量久|\b(surviv|survival|\bhp\b|life)/i.test(p)) {
    return tr(locale, "playStyle.survivor");
  }
  if (/躲|躲开|躲开|障碍物|弹幕|从天而降/i.test(prompt) || /\b(dodge|avoid|fall)\b/i.test(p)) {
    return tr(locale, "playStyle.avoider");
  }
  return tr(locale, "playStyle.fallback");
}

/** @deprecated use guessPlayStyle */
export function guessPlayStyleZh(prompt: string): string {
  return guessPlayStyle(prompt, "zh-Hans");
}

function templateHintLine(hint: string, locale: AppLocale): string {
  switch (hint) {
    case "towerDefense":
      return tr(locale, "templateHint.towerDefense");
    case "shooter":
      return tr(locale, "templateHint.shooter");
    case "platformer":
      return tr(locale, "templateHint.platformer");
    case "collector":
      return tr(locale, "templateHint.collector");
    case "survivor":
      return tr(locale, "templateHint.survivor");
    case "avoider":
      return tr(locale, "templateHint.avoider");
    default:
      return tr(locale, "templateHint.auto");
  }
}

/** 服务端在 SSE 中与「初始化」配对推送的多行说明（同一 step: prep）。 */
export function buildServerPrepLines(
  prompt: string,
  flags: StudioGenerateFlags,
  locale: AppLocale = "zh-Hans",
): string[] {
  const lines: string[] = [];
  lines.push(tr(locale, "prep.header"));
  lines.push(guessPlayStyle(prompt, locale));
  lines.push(templateHintLine(flags.templateHint, locale));
  lines.push(flags.searchEnhance ? tr(locale, "prep.searchOn") : tr(locale, "prep.searchOff"));
  lines.push(flags.enhancePass ? tr(locale, "prep.enhanceOn") : tr(locale, "prep.enhanceOff"));
  lines.push(
    tr(locale, "prep.pipeline", {
      prefix: flags.searchEnhance ? tr(locale, "prep.pipelineSearchPrefix") : "",
      enhanceSuffix: flags.enhancePass ? tr(locale, "prep.pipelineEnhanceSuffix") : "",
    }),
  );
  return lines;
}

function detectTemplateId(
  prompt: string,
  templateHint: CoCreationIntent["templateId"],
): CoCreationIntent["templateId"] {
  if (templateHint !== "auto") return templateHint;
  const p = prompt.toLowerCase();
  if (/塔防|保卫萝卜|波次防守|防御塔|箭塔|炮塔|放置塔|\b(td|tower defense|tower\s*defen[cs]e)\b/i.test(p)) return "towerDefense";
  if (/射击|飞船|敌机|弹幕|战机|太空战|清屏|shooter|shoot|bullet hell/i.test(p)) return "shooter";
  if (/平台|跳台|横版闯关|\b(platformer|platform)\b|马里奥|恶魔城/i.test(prompt) || /\b(platform|jump)\b/.test(p)) return "platformer";
  if (/收集|捡|金币|宝石|吃掉|拾起|豆子/i.test(prompt) || /\b(collect|coin|gem|pick\s*up)\b/i.test(p)) return "collector";
  if (/生存|多条命|血条|尽量久|\b(surviv|survival|\bhp\b|life)/i.test(p)) return "survivor";
  return "avoider";
}

function inferFantasy(prompt: string, locale: AppLocale): string {
  if (/海|洋|珊瑚|章鱼|潜水|鱼/.test(prompt)) return tr(locale, "fantasy.ocean");
  if (/森林|树|蘑菇|精灵|藤蔓|鹿/.test(prompt)) return tr(locale, "fantasy.forest");
  if (/太空|宇宙|星|飞船|银河|陨石/.test(prompt)) return tr(locale, "fantasy.space");
  if (/赛博|霓虹|cyber|neon|机甲|全息/.test(prompt.toLowerCase())) return tr(locale, "fantasy.cyber");
  if (/猫|狗|萌|可爱|治愈/.test(prompt)) return tr(locale, "fantasy.cute");
  return tr(locale, "fantasy.default");
}

function gameplayCoreFor(templateId: CoCreationIntent["templateId"], locale: AppLocale): string {
  return tr(locale, `gameplayCore.${templateId === "auto" ? "avoider" : templateId}`);
}

export function buildCoCreationIntent(
  prompt: string,
  templateHint: CoCreationIntent["templateId"],
  locale: AppLocale = "zh-Hans",
): CoCreationIntent {
  const normalized = prompt.trim().replace(/\s+/g, " ");
  const templateId = detectTemplateId(normalized, templateHint);
  const fantasy = inferFantasy(normalized, locale);
  const strengths = [
    tr(locale, "intent.strengthTemplate", { templateId }),
    tr(locale, "intent.strengthFantasy", { fantasy }),
    tr(locale, "intent.strengthEnough"),
  ];
  const risks: string[] = [];
  if (!/守|防|收集|击败|逃离|坚持|到达|闯关|波次|win|goal|defend|collect|survive|reach|wave/i.test(normalized)) {
    risks.push(tr(locale, "intent.riskGoal"));
  }
  if (!/敌|怪|障碍|陷阱|敌机|入侵|风险|危险|墨汁|陨石|enemy|hazard|threat|trap|boss/i.test(normalized)) {
    risks.push(tr(locale, "intent.riskThreat"));
  }
  if (!/升级|技能|波次|事件|关卡|精英|Boss|首领|建造|upgrade|skill|wave|event|level|elite|build/i.test(normalized)) {
    risks.push(tr(locale, "intent.riskProgression"));
  }
  return {
    templateId,
    premise: summarizePromptForStudio(normalized, locale, 96),
    fantasy,
    gameplayCore: gameplayCoreFor(templateId, locale),
    strengths,
    risks,
  };
}

function directionBulletsFor(templateId: CoCreationIntent["templateId"], locale: AppLocale): string[] {
  if (templateId === "towerDefense") {
    return [tr(locale, "directionBullets.td0"), tr(locale, "directionBullets.td1")];
  }
  if (templateId === "shooter") {
    return [tr(locale, "directionBullets.shooter0"), tr(locale, "directionBullets.shooter1")];
  }
  if (templateId === "platformer") {
    return [tr(locale, "directionBullets.platformer0"), tr(locale, "directionBullets.platformer1")];
  }
  return [tr(locale, "directionBullets.default0"), tr(locale, "directionBullets.default1")];
}

function buildPromptAddon(
  locale: AppLocale,
  directionKey: "balanced" | "depth" | "spectacle",
  commonLead: string,
): string {
  const d = tr(locale, `directions.${directionKey}.addonHeader`);
  const line2 = tr(locale, `directions.${directionKey}.addonLine2`);
  const line3 = tr(locale, `directions.${directionKey}.addonLine3`);
  return `${d}\n- ${commonLead}\n- ${line2}\n- ${line3}`;
}

export function buildCoCreationDirections(
  intent: CoCreationIntent,
  locale: AppLocale = "zh-Hans",
): CoCreationDirection[] {
  const templateId = intent.templateId === "auto" ? "avoider" : intent.templateId;
  const commonLead = tr(locale, "directionBullets.commonLead", { fantasy: intent.fantasy });
  const templateBullets = directionBulletsFor(templateId, locale);

  return [
    {
      id: "balanced",
      title: tr(locale, "directions.balanced.title"),
      summary: tr(locale, "directions.balanced.summary"),
      templateId,
      bullets: [...templateBullets, tr(locale, "directionBullets.balancedExtra")],
      promptAddon: buildPromptAddon(locale, "balanced", commonLead),
    },
    {
      id: "depth",
      title: tr(locale, "directions.depth.title"),
      summary: tr(locale, "directions.depth.summary"),
      templateId,
      bullets: [...templateBullets, tr(locale, "directionBullets.depthExtra")],
      promptAddon: buildPromptAddon(locale, "depth", commonLead),
    },
    {
      id: "spectacle",
      title: tr(locale, "directions.spectacle.title"),
      summary: tr(locale, "directions.spectacle.summary"),
      templateId,
      bullets: [
        commonLead,
        tr(locale, "directionBullets.spectacleExtra1"),
        tr(locale, "directionBullets.spectacleExtra2"),
      ],
      promptAddon: buildPromptAddon(locale, "spectacle", commonLead),
    },
  ];
}

export function describeQueuedAssetSummary(
  params: {
    fileImageCount: number;
    pasted: ReadonlyArray<{ purpose: string; file?: { name?: string } }>;
  },
  locale: AppLocale = "zh-Hans",
): string[] {
  const out: string[] = [];
  if (params.fileImageCount > 0) {
    out.push(tr(locale, "assets.fileQueue", { count: params.fileImageCount }));
  }
  if (params.pasted.length > 0) {
    const purposeBreakdown = params.pasted.reduce(
      (acc, row) => {
        const k = row.purpose?.trim() || tr(locale, "assets.purposeUnlabeled");
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const brief = Object.entries(purposeBreakdown)
      .map(([k, n]) => `${k} ×${n}`)
      .join("；");
    out.push(tr(locale, "assets.clipQueue", { count: params.pasted.length, breakdown: brief }));
  }
  if (out.length === 0) out.push(tr(locale, "assets.none"));
  return out;
}

/** SSE recap lines after spec generation (generate/stream). */
export function buildGenerateRecapLines(
  locale: AppLocale,
  spec: {
    templateId: string;
    title: string;
    labels?: { subtitle?: string | null };
    gameplay: { baseHealth?: number; startingCoins?: number; winScore?: number; playerSpeed?: number; hazardSpeed?: number };
    towerDefense?: { enemies?: unknown[] | null };
  },
  web?: { used?: boolean; warning?: string | null },
  searchEnhance?: boolean,
): string[] {
  const recapLines: string[] = [];
  recapLines.push(tr(locale, "stream.recapTemplate", { templateId: spec.templateId }));
  recapLines.push(tr(locale, "stream.recapTitle", { title: spec.title }));
  if (spec.labels?.subtitle?.trim()) {
    recapLines.push(tr(locale, "stream.recapSubtitle", { subtitle: spec.labels.subtitle.trim() }));
  }
  if (spec.templateId === "towerDefense") {
    recapLines.push(
      tr(locale, "stream.recapTd", {
        baseHealth: Math.round(spec.gameplay.baseHealth ?? 0),
        startingCoins: Math.round(spec.gameplay.startingCoins ?? 0),
        winScore: Math.round(spec.gameplay.winScore ?? 0),
      }),
    );
    const ne = spec.towerDefense?.enemies?.length ?? 0;
    if (ne > 0) recapLines.push(tr(locale, "stream.recapEnemies", { count: ne }));
  } else {
    recapLines.push(
      tr(locale, "stream.recapGeneric", {
        playerSpeed: Math.round(spec.gameplay.playerSpeed ?? 0),
        hazardSpeed: Math.round(spec.gameplay.hazardSpeed ?? 0),
        winScore: Math.round(spec.gameplay.winScore ?? 0),
      }),
    );
  }
  if (web?.used) {
    recapLines.push(tr(locale, "stream.recapSearchUsed"));
  } else if (searchEnhance) {
    recapLines.push(
      tr(locale, "stream.recapSearchFallback", {
        warning: web?.warning ? ` ${web.warning}` : "",
      }),
    );
  }
  return recapLines;
}

export function streamMessage(locale: AppLocale, key: "start" | "done" | "error"): string {
  return tr(locale, `stream.${key}`);
}
