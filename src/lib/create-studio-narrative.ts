/**
 * 创作台「制作过程」可读文案：规则推断 + 与用户提示词对齐的说明（非模型 CoT）。
 */

import type { AppLocale } from "@/i18n/routing";
import { inferTemplateFromPrompt, type GameTemplateId } from "@/lib/game-templates";
import { tMessage } from "@/lib/i18n/messages";

export type StudioGenerateFlags = {
  searchEnhance: boolean;
  templateHint: string;
  enhancePass: boolean;
};

export type CoCreationIntent = {
  templateId: "auto" | GameTemplateId;
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
  if (
    /飞机大战|打飞机|战机|敌机|空战|飞机|射击|飞船|弹幕|太空战|清屏/i.test(prompt) ||
    /shooter|shoot|bullet hell|shmup|plane battle|air combat/i.test(p)
  ) {
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
  return inferTemplateFromPrompt(prompt);
}

function inferFantasy(prompt: string, locale: AppLocale): string {
  if (/海|洋|珊瑚|章鱼|潜水|鱼/.test(prompt)) return tr(locale, "fantasy.ocean");
  if (/森林|树|蘑菇|精灵|藤蔓|鹿/.test(prompt)) return tr(locale, "fantasy.forest");
  if (/太空|宇宙|星|飞船|银河|陨石|飞机|战机|空战|航空/.test(prompt)) return tr(locale, "fantasy.space");
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


function buildDialogueAddon(locale: AppLocale, keyPrefix: string, fantasy: string): string {
  const header = tr(locale, `${keyPrefix}.addonHeader`);
  const lines = [0, 1, 2]
    .map((i) => {
      const line = tr(locale, `${keyPrefix}.addon${i}`, { fantasy });
      if (!line || line === `${keyPrefix}.addon${i}`) return null;
      return `- ${line}`;
    })
    .filter((line): line is string => Boolean(line));
  return [header, ...lines].join("\n");
}

function dialogueDirection(
  locale: AppLocale,
  id: string,
  templateId: GameTemplateId,
  keyPrefix: string,
  fantasy: string,
): CoCreationDirection {
  const bullets = [0, 1]
    .map((i) => tr(locale, `${keyPrefix}.bullet${i}`))
    .filter((b) => b && !b.startsWith("createStudioNarrative.dialogue"));
  return {
    id,
    title: tr(locale, `${keyPrefix}.title`),
    summary: tr(locale, `${keyPrefix}.summary`),
    templateId,
    bullets,
    promptAddon: buildDialogueAddon(locale, keyPrefix, fantasy),
  };
}

function resolveDirectionTemplateId(intent: CoCreationIntent): GameTemplateId {
  return intent.templateId === "auto" ? "avoider" : intent.templateId;
}

function buildTemplateDialogueDirections(
  templateId: GameTemplateId,
  intent: CoCreationIntent,
  locale: AppLocale,
): CoCreationDirection[] | null {
  const fantasy = intent.fantasy;
  if (templateId === "shooter" || templateId === "sniper") {
    return [
      dialogueDirection(locale, "shmup-classic", "shooter", "dialogue.shooter.classic", fantasy),
      dialogueDirection(locale, "boss-mothership", "shooter", "dialogue.shooter.boss", fantasy),
      dialogueDirection(locale, "power-loop", "shooter", "dialogue.shooter.power", fantasy),
      dialogueDirection(locale, "warzone-story", "shooter", "dialogue.shooter.story", fantasy),
    ];
  }
  if (templateId === "towerDefense") {
    return [
      dialogueDirection(locale, "td-lane", "towerDefense", "dialogue.towerDefense.lane", fantasy),
      dialogueDirection(locale, "td-multi", "towerDefense", "dialogue.towerDefense.multi", fantasy),
      dialogueDirection(locale, "td-hero", "towerDefense", "dialogue.towerDefense.hero", fantasy),
      dialogueDirection(locale, "td-events", "towerDefense", "dialogue.towerDefense.events", fantasy),
    ];
  }
  if (templateId === "platformer") {
    return [
      dialogueDirection(locale, "plat-run", "platformer", "dialogue.platformer.run", fantasy),
      dialogueDirection(locale, "plat-precision", "platformer", "dialogue.platformer.precision", fantasy),
      dialogueDirection(locale, "plat-combat", "platformer", "dialogue.platformer.combat", fantasy),
      dialogueDirection(locale, "plat-chapters", "platformer", "dialogue.platformer.chapters", fantasy),
    ];
  }
  return null;
}

function buildFallbackDialogueDirections(
  intent: CoCreationIntent,
  locale: AppLocale,
): CoCreationDirection[] {
  const templateId = resolveDirectionTemplateId(intent);
  const fantasy = intent.fantasy;
  const out: CoCreationDirection[] = [];

  if (intent.risks.includes(tr(locale, "intent.riskGoal"))) {
    out.push(dialogueDirection(locale, "fb-goal", templateId, "dialogue.fallback.goal", fantasy));
  }
  if (intent.risks.includes(tr(locale, "intent.riskThreat"))) {
    out.push(dialogueDirection(locale, "fb-threat", templateId, "dialogue.fallback.threat", fantasy));
  }
  if (intent.risks.includes(tr(locale, "intent.riskProgression"))) {
    out.push(
      dialogueDirection(locale, "fb-progression", templateId, "dialogue.fallback.progression", fantasy),
    );
  }
  out.push(dialogueDirection(locale, "fb-fantasy", templateId, "dialogue.fallback.fantasy", fantasy));

  const seen = new Set<string>();
  return out.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).slice(0, 4);
}

export function buildCoCreationDirections(
  intent: CoCreationIntent,
  locale: AppLocale = "zh-Hans",
  prompt = "",
): CoCreationDirection[] {
  const templateId =
    intent.templateId === "auto" ? inferTemplateFromPrompt(prompt.trim()) : intent.templateId;
  const themed = buildTemplateDialogueDirections(templateId, intent, locale);
  if (themed?.length) return themed;
  return buildFallbackDialogueDirections(intent, locale);
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
    agenticPlayRoute?: "dedicated" | "agentic";
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

export function streamMessage(locale: AppLocale, key: "start" | "done" | "error" | "spec_draft" | "enriching"): string {
  // spec_draft / enriching fallback to inline strings if not in i18n yet
  if (key === "spec_draft") {
    return locale === "zh-Hans" || locale === "zh-Hant"
      ? "🎮 正在生成游戏规格..."
      : locale === "ms" ? "🎮 Menjana spesifikasi permainan..."
      : locale === "th" ? "🎮 กำลังสร้างสเปคเกม..."
      : "🎮 Generating game spec...";
  }
  if (key === "enriching") {
    return locale === "zh-Hans" || locale === "zh-Hant"
      ? "✨ 正在丰富游戏内容与资产..."
      : locale === "ms" ? "✨ Memperkaya kandungan permainan..."
      : locale === "th" ? "✨ กำลังเพิ่มเนื้อหาเกม..."
      : "✨ Enriching game content & assets...";
  }
  return tr(locale, `stream.${key}`);
}
