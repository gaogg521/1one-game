/**
 * 创作台「制作过程」可读文案：规则推断 + 与用户提示词对齐的说明（非模型 CoT）。
 */

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

/** 截取展示用提示词片段 */
export function summarizePromptForStudio(prompt: string, maxLen = 420): string {
  const t = prompt.trim().replace(/\s+/g, " ");
  if (!t.length) return "（空）";
  return t.length <= maxLen ? t : `${t.slice(0, maxLen)}…`;
}

/** 与用户 mock-spec 同款关键词语义，转成面向用户的玩法倾向说明 */
export function guessPlayStyleZh(prompt: string): string {
  const p = prompt.toLowerCase();
  if (/塔防|保卫萝卜|波次防守|防御塔|箭塔|炮塔|放置塔|\b(td|tower defense|tower\s*defen[cs]e)\b/i.test(p)) {
    return "检测到你的描述更偏 **塔防**：路线行军 + 炮台建造与升级 + 波次节奏。";
  }
  if (/射击|飞船|敌机|弹幕|战机|太空战|清屏|shooter|shoot|bullet hell/i.test(p)) {
    return "检测到你的描述更偏 **射击**：俯视角火力循环、波次压迫与技能窗口。";
  }
  if (/平台|跳台|横版闯关|\b(platformer|platform)\b|马里奥|恶魔城/i.test(prompt) || /\b(platform|jump)\b/.test(p)) {
    return "检测到你的描述更偏 **横版闯关 / 平台跳跃**：跳跃、多层平台与收集目标。";
  }
  if (/收集|捡|金币|宝石|吃掉|拾起|豆子/i.test(prompt) || /\b(collect|coin|gem|pick\s*up)\b/i.test(p)) {
    return "检测到你的描述更偏 **收集类**：场景中拾取物件并规避威胁。";
  }
  if (/生存|多条命|血条|尽量久|\b(surviv|survival|\bhp\b|life)/i.test(p)) {
    return "检测到你的描述更偏 **生存 / 容错型躲避**：生命值与节奏压力更重。";
  }
  if (/躲|躲开|躲开|障碍物|弹幕|从天而降/i.test(prompt) || /\b(dodge|avoid|fall)\b/i.test(p)) {
    return "检测到你的描述更偏 **躲避类**：单命或容错下规避威胁。";
  }
  return "未命中强关键词，系统将结合全文由模型/auto 推断最合适的模板（avoider / collector / survivor / platformer / towerDefense / shooter 之一）。";
}

function templateHintLine(hint: string): string {
  switch (hint) {
    case "towerDefense":
      return "你已指定模板提示：**塔防**。生成时会优先对齐塔防结构与数值。";
    case "shooter":
      return "你已指定模板提示：**射击**。会优先补齐敌群、火力循环与波次压力。";
    case "platformer":
      return "你已指定模板提示：**平台跳跃**。会强化跳跃重力与关卡目标刻画。";
    case "collector":
      return "你已指定模板提示：**收集类**。";
    case "survivor":
      return "你已指定模板提示：**生存类**。";
    case "avoider":
      return "你已指定模板提示：**躲避类**。";
    default:
      return "模板提示为 **auto**：由模型从一句话里自选 avoider/collector/survivor/platformer/towerDefense/shooter。";
  }
}

/** 服务端在 SSE 中与「初始化」配对推送的多行说明（同一 step: prep）。 */
export function buildServerPrepLines(prompt: string, flags: StudioGenerateFlags): string[] {
  const lines: string[] = [];
  lines.push("── 系统将按下面思路处理你的话（概要，非隐藏思维链）：");
  lines.push(guessPlayStyleZh(prompt));
  lines.push(templateHintLine(flags.templateHint));
  if (flags.searchEnhance) lines.push("已开启 **联网检索**：会先拉同类玩法/画风线索，再将摘要并进创意（不脱敏专有名词则由提示词护栏约束）。");
  else lines.push("本轮 **未** 开启联网检索；仅使用你的正文与可选参考素材摘录。");
  if (flags.enhancePass) lines.push("将执行 **二次强化 pass**：在同模板下加厚系统感与可读数值。");
  else lines.push("已关闭二次强化 pass：单次规格直出后再做本地纠错与校验。");
  lines.push(`随后进入：**${flags.searchEnhance ? "检索 → " : ""}初稿规格 → ${flags.enhancePass ? "强化 → " : ""}校验 / 纠错 / 补齐蓝图**。`);
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

function inferFantasy(prompt: string): string {
  if (/海|洋|珊瑚|章鱼|潜水|鱼/.test(prompt)) return "海洋 / 潮汐 / 水下生态";
  if (/森林|树|蘑菇|精灵|藤蔓|鹿/.test(prompt)) return "森林 / 自然 / 童话冒险";
  if (/太空|宇宙|星|飞船|银河|陨石/.test(prompt)) return "宇宙 / 星舰 / 太空冲突";
  if (/赛博|霓虹|cyber|neon|机甲|全息/.test(prompt.toLowerCase())) return "赛博 / 霓虹 / 高科技空间";
  if (/猫|狗|萌|可爱|治愈/.test(prompt)) return "可爱角色 / 轻松氛围 / 萌系表达";
  return "围绕你当前描述提炼出的统一世界观";
}

function gameplayCore(templateId: CoCreationIntent["templateId"]): string {
  switch (templateId) {
    case "towerDefense":
      return "路线行军、布塔升级、精英波与守点压力要同时成立。";
    case "shooter":
      return "移动闪避、自动射击、敌群编队和短 CD 技能形成节奏循环。";
    case "platformer":
      return "跳跃手感、关卡地形、收集目标和机制变化共同驱动推进。";
    case "collector":
      return "移动采集与规避威胁双线并行，持续制造“冒险拿奖励”的反馈。";
    case "survivor":
      return "容错与压迫并存，强调越拖越难的生存决策。";
    default:
      return "短回合躲避与目标推进需要足够清晰，避免只剩随机障碍。";
  }
}

export function buildCoCreationIntent(
  prompt: string,
  templateHint: CoCreationIntent["templateId"],
): CoCreationIntent {
  const normalized = prompt.trim().replace(/\s+/g, " ");
  const templateId = detectTemplateId(normalized, templateHint);
  const strengths = [
    `当前更适合往 **${templateId}** 方向落地。`,
    `世界观焦点：${inferFantasy(normalized)}。`,
    "已有一句话创意足够生成首版 GameSpec，可继续通过方向选择收敛结果。",
  ];
  const risks: string[] = [];
  if (!/守|防|收集|击败|逃离|坚持|到达|闯关|波次/.test(normalized)) {
    risks.push("目标感还不够明确，建议补一句“玩家最终要完成什么”。");
  }
  if (!/敌|怪|障碍|陷阱|敌机|入侵|风险|危险|墨汁|陨石/.test(normalized)) {
    risks.push("威胁来源不够具体，可能会生成成“有主题但没压力”的 demo。");
  }
  if (!/升级|技能|波次|事件|关卡|精英|Boss|首领|建造/.test(normalized)) {
    risks.push("进程变化信息偏少，需要用候选方向把玩法层次补厚。");
  }
  return {
    templateId,
    premise: summarizePromptForStudio(normalized, 96),
    fantasy: inferFantasy(normalized),
    gameplayCore: gameplayCore(templateId),
    strengths,
    risks,
  };
}

export function buildCoCreationDirections(intent: CoCreationIntent): CoCreationDirection[] {
  const templateId = intent.templateId === "auto" ? "avoider" : intent.templateId;
  const commonLead = `世界观以「${intent.fantasy}」为主，保持标题、敌人、目标和 HUD 命名统一。`;
  const templateBullets =
    templateId === "towerDefense"
      ? ["强调三种塔职责分工、精英波和守点事件。", "优先生成能看懂的经济节奏，而不是只换皮。"]
      : templateId === "shooter"
        ? ["强调敌群编队、火力窗口和短暂爆发技能。", "优先做出 3 分钟内有明显波次升级的战斗节奏。"]
        : templateId === "platformer"
          ? ["强调关卡段落、地形机制和限时小目标。", "优先做出“前进探索”而不是单屏随机跳跃。"]
          : ["强调目标、威胁与阶段变化，避免只剩表层主题包装。", "优先让玩家每 20~40 秒感受到一次局势变化。"];

  return [
    {
      id: "balanced",
      title: "稳妥成品向",
      summary: "先保证规则清晰、目标明确、首次试玩就容易理解。",
      templateId,
      bullets: [commonLead, ...templateBullets, "数值更保守，优先稳定可玩。"],
      promptAddon: `【共创方向】稳妥成品向\n- ${commonLead}\n- 目标、失败条件、进程变化要第一眼可理解。\n- 数值先偏稳妥，保证首版可玩。`,
    },
    {
      id: "depth",
      title: "系统更深",
      summary: "增加事件、技能、阶段变化和中层决策，提升可玩性上限。",
      templateId,
      bullets: [commonLead, ...templateBullets, "优先补厚中层决策与阶段变化。"],
      promptAddon: `【共创方向】系统更深\n- ${commonLead}\n- 强化技能、事件、精英/Boss/目标变化中的至少两项。\n- 不要只改皮肤，要明显抬高玩法层次。`,
    },
    {
      id: "spectacle",
      title: "演出与主题优先",
      summary: "保留可玩性的前提下，突出视觉主题、命名和高潮段落。",
      templateId,
      bullets: [commonLead, "更强调标题、字幕、敌我命名与高潮演出的一致性。", "玩法仍需完整，但允许更强烈的主题包装。"],
      promptAddon: `【共创方向】演出与主题优先\n- ${commonLead}\n- 主题命名、HUD 文案、阶段演出要更鲜明。\n- 保证可玩基础上，让玩家更容易记住这个世界观。`,
    },
  ];
}

export function describeQueuedAssetSummary(params: {
  fileImageCount: number;
  pasted: ReadonlyArray<{ purpose: string; file?: { name?: string } }>;
}): string[] {
  const out: string[] = [];
  if (params.fileImageCount > 0) {
    out.push(`本机「选择文件」队列中：**${params.fileImageCount}** 张图片（上传优先）。`);
  }
  if (params.pasted.length > 0) {
    const purposeBreakdown = params.pasted.reduce(
      (acc, row) => {
        const k = row.purpose?.trim() || "（用途未标注）";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const brief = Object.entries(purposeBreakdown)
      .map(([k, n]) => `${k} ×${n}`)
      .join("；");
    out.push(`剪贴板队列：**${params.pasted.length}** 张（用途分布：${brief}）。`);
  }
  if (out.length === 0) out.push("本次 **没有**排队中的上传/剪贴板参考图；仅根据文字生成。");
  return out;
}
