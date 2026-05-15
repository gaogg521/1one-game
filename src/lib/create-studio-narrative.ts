/**
 * 创作台「制作过程」可读文案：规则推断 + 与用户提示词对齐的说明（非模型 CoT）。
 */

export type StudioGenerateFlags = {
  searchEnhance: boolean;
  templateHint: string;
  enhancePass: boolean;
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
  return "未命中强关键词，系统将结合全文由模型/auto 推断最合适的模板（avoider / collector / survivor / platformer / towerDefense 之一）。";
}

function templateHintLine(hint: string): string {
  switch (hint) {
    case "towerDefense":
      return "你已指定模板提示：**塔防**。生成时会优先对齐塔防结构与数值。";
    case "platformer":
      return "你已指定模板提示：**平台跳跃**。会强化跳跃重力与关卡目标刻画。";
    case "collector":
      return "你已指定模板提示：**收集类**。";
    case "survivor":
      return "你已指定模板提示：**生存类**。";
    case "avoider":
      return "你已指定模板提示：**躲避类**。";
    default:
      return "模板提示为 **auto**：由模型从一句话里自选 avoider/collector/survivor/platformer/towerDefense。";
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
