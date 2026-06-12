/** Create studio narrative + generate stream SSE copy — merged by i18n-bulk-catalog.mjs */

const zhHans = {
  emptyPrompt: "（空）",
  playStyle: {
    towerDefense: "检测到你的描述更偏 **塔防**：路线行军 + 炮台建造与升级 + 波次节奏。",
    shooter: "检测到你的描述更偏 **射击**：俯视角火力循环、波次压迫与技能窗口。",
    platformer: "检测到你的描述更偏 **横版闯关 / 平台跳跃**：跳跃、多层平台与收集目标。",
    collector: "检测到你的描述更偏 **收集类**：场景中拾取物件并规避威胁。",
    survivor: "检测到你的描述更偏 **生存 / 容错型躲避**：生命值与节奏压力更重。",
    avoider: "检测到你的描述更偏 **躲避类**：单命或容错下规避威胁。",
    fallback:
      "未命中强关键词，系统将结合全文由模型/auto 推断最合适的模板（avoider / collector / survivor / platformer / towerDefense / shooter 之一）。",
  },
  templateHint: {
    towerDefense: "你已指定模板提示：**塔防**。生成时会优先对齐塔防结构与数值。",
    shooter: "你已指定模板提示：**射击**。会优先补齐敌群、火力循环与波次压力。",
    platformer: "你已指定模板提示：**平台跳跃**。会强化跳跃重力与关卡目标刻画。",
    collector: "你已指定模板提示：**收集类**。",
    survivor: "你已指定模板提示：**生存类**。",
    avoider: "你已指定模板提示：**躲避类**。",
    auto: "模板提示为 **auto**：由模型从一句话里自选 avoider/collector/survivor/platformer/towerDefense/shooter。",
  },
  prep: {
    header: "── 系统将按下面思路处理你的话（概要，非隐藏思维链）：",
    searchOn:
      "已开启 **联网检索**：会先拉同类玩法/画风线索，再将摘要并进创意（不脱敏专有名词则由提示词护栏约束）。",
    searchOff: "本轮 **未** 开启联网检索；仅使用你的正文与可选参考素材摘录。",
    enhanceOn: "将执行 **二次强化 pass**：在同模板下加厚系统感与可读数值。",
    enhanceOff: "已关闭二次强化 pass：单次规格直出后再做本地纠错与校验。",
    pipeline: "随后进入：**{prefix}初稿规格 → {enhanceSuffix}校验 / 纠错 / 补齐蓝图**。",
    pipelineSearchPrefix: "检索 → ",
    pipelineEnhanceSuffix: "强化 → ",
  },
  fantasy: {
    ocean: "海洋 / 潮汐 / 水下生态",
    forest: "森林 / 自然 / 童话冒险",
    space: "宇宙 / 星舰 / 太空冲突",
    cyber: "赛博 / 霓虹 / 高科技空间",
    cute: "可爱角色 / 轻松氛围 / 萌系表达",
    default: "围绕你当前描述提炼出的统一世界观",
  },
  gameplayCore: {
    towerDefense: "路线行军、布塔升级、精英波与守点压力要同时成立。",
    shooter: "移动闪避、自动射击、敌群编队和短 CD 技能形成节奏循环。",
    platformer: "跳跃手感、关卡地形、收集目标和机制变化共同驱动推进。",
    collector: "移动采集与规避威胁双线并行，持续制造“冒险拿奖励”的反馈。",
    survivor: "容错与压迫并存，强调越拖越难的生存决策。",
    avoider: "短回合躲避与目标推进需要足够清晰，避免只剩随机障碍。",
  },
  intent: {
    strengthTemplate: "当前更适合往 **{templateId}** 方向落地。",
    strengthFantasy: "世界观焦点：{fantasy}。",
    strengthEnough: "已有一句话创意足够生成首版 GameSpec，可继续通过方向选择收敛结果。",
    riskGoal: "目标感还不够明确，建议补一句“玩家最终要完成什么”。",
    riskThreat: "威胁来源不够具体，可能会生成成“有主题但没压力”的 demo。",
    riskProgression: "进程变化信息偏少，需要用候选方向把玩法层次补厚。",
  },
  directionBullets: {
    commonLead: "世界观以「{fantasy}」为主，保持标题、敌人、目标和 HUD 命名统一。",
    td0: "强调三种塔职责分工、精英波和守点事件。",
    td1: "优先生成能看懂的经济节奏，而不是只换皮。",
    shooter0: "强调敌群编队、火力窗口和短暂爆发技能。",
    shooter1: "优先做出 3 分钟内有明显波次升级的战斗节奏。",
    platformer0: "强调关卡段落、地形机制和限时小目标。",
    platformer1: "优先做出“前进探索”而不是单屏随机跳跃。",
    default0: "强调目标、威胁与阶段变化，避免只剩表层主题包装。",
    default1: "优先让玩家每 20~40 秒感受到一次局势变化。",
    balancedExtra: "数值更保守，优先稳定可玩。",
    depthExtra: "优先补厚中层决策与阶段变化。",
    spectacleExtra1: "更强调标题、字幕、敌我命名与高潮演出的一致性。",
    spectacleExtra2: "玩法仍需完整，但允许更强烈的主题包装。",
  },
  directions: {
    balanced: {
      title: "稳妥成品向",
      summary: "先保证规则清晰、目标明确、首次试玩就容易理解。",
      addonHeader: "【共创方向】稳妥成品向",
      addonLine2: "目标、失败条件、进程变化要第一眼可理解。",
      addonLine3: "数值先偏稳妥，保证首版可玩。",
    },
    depth: {
      title: "系统更深",
      summary: "增加事件、技能、阶段变化和中层决策，提升可玩性上限。",
      addonHeader: "【共创方向】系统更深",
      addonLine2: "强化技能、事件、精英/Boss/目标变化中的至少两项。",
      addonLine3: "不要只改皮肤，要明显抬高玩法层次。",
    },
    spectacle: {
      title: "演出与主题优先",
      summary: "保留可玩性的前提下，突出视觉主题、命名和高潮段落。",
      addonHeader: "【共创方向】演出与主题优先",
      addonLine2: "主题命名、HUD 文案、阶段演出要更鲜明。",
      addonLine3: "保证可玩基础上，让玩家更容易记住这个世界观。",
    },
  },
  assets: {
    fileQueue: "本机「选择文件」队列中：**{count}** 张图片（上传优先）。",
    clipQueue: "剪贴板队列：**{count}** 张（用途分布：{breakdown}）。",
    none: "本次 **没有**排队中的上传/剪贴板参考图；仅根据文字生成。",
    purposeUnlabeled: "（用途未标注）",
  },
  stream: {
    start: "已接收创意，准备生成…",
    done: "完成",
    error: "生成过程异常",
    recapTemplate: "**选定模板**：{templateId}",
    recapTitle: "**成品标题**：{title}",
    recapSubtitle: "**氛围副标题**：{subtitle}",
    recapTd: "**塔防概览**：基地生命约 **{baseHealth}** · 开局金币 **{startingCoins}** · 总波次数 **{winScore}**（可到右侧快速调试微调）。",
    recapEnemies: "**敌军种类**：蓝图内登记 **{count}** 种敌人模型。",
    recapGeneric:
      "**通用玩法数值**：主角移速 {playerSpeed} · 威胁移速 {hazardSpeed} · 取胜目标(winScore) {winScore}。",
    recapSearchUsed: "**联网检索**：已并入摘要片段；来源列表可在生成完成后于页内查看（若有）。",
    recapSearchFallback:
      "**联网检索**：本轮未得到有效摘要（密钥/配额/无命中等皆可），已退回纯文本管线。{warning}",
  },
};

const en = {
  emptyPrompt: "(empty)",
  playStyle: {
    towerDefense:
      "Your description reads **tower defense**: path marching + tower placement/upgrades + wave pacing.",
    shooter: "Your description reads **shooter**: top-down fire loops, wave pressure, and skill windows.",
    platformer: "Your description reads **platformer**: jumping, layered platforms, and collection goals.",
    collector: "Your description reads **collector**: pick up objects in the scene while avoiding threats.",
    survivor: "Your description reads **survival / forgiving dodge**: heavier HP and pacing pressure.",
    avoider: "Your description reads **avoider**: dodge threats with limited lives or forgiveness.",
    fallback:
      "No strong keyword match — the model/auto pipeline will infer the best template (avoider / collector / survivor / platformer / towerDefense / shooter).",
  },
  templateHint: {
    towerDefense: "Template hint **tower defense** — generation will prioritize TD structure and numbers.",
    shooter: "Template hint **shooter** — will prioritize enemy waves, fire loops, and pressure.",
    platformer: "Template hint **platformer** — will emphasize jump feel and level goals.",
    collector: "Template hint **collector**.",
    survivor: "Template hint **survivor**.",
    avoider: "Template hint **avoider**.",
    auto: "Template hint **auto** — the model picks avoider/collector/survivor/platformer/towerDefense/shooter from your line.",
  },
  prep: {
    header: "── How the system will handle your prompt (summary, not hidden chain-of-thought):",
    searchOn:
      "**Web search enabled** — fetch similar play/style cues first, then merge summaries into the brief.",
    searchOff: "**Web search off** this round — text plus optional reference excerpts only.",
    enhanceOn: "Running a **second enhancement pass** to thicken systems and readable numbers.",
    enhanceOff: "Enhancement pass off — single spec pass, then local repair/validation.",
    pipeline: "Next: **{prefix}draft spec → {enhanceSuffix}validate / repair / blueprint fill**.",
    pipelineSearchPrefix: "search → ",
    pipelineEnhanceSuffix: "enhance → ",
  },
  fantasy: {
    ocean: "Ocean / tides / underwater ecology",
    forest: "Forest / nature / fairy-tale adventure",
    space: "Space / starships / cosmic conflict",
    cyber: "Cyber / neon / high-tech spaces",
    cute: "Cute characters / relaxed mood / cozy tone",
    default: "A unified world built from your current description",
  },
  gameplayCore: {
    towerDefense: "Path marching, tower upgrades, elite waves, and hold-the-point pressure together.",
    shooter: "Move-dodge, auto fire, enemy formations, and short-cooldown skills in a loop.",
    platformer: "Jump feel, terrain, collect goals, and mechanic shifts drive progress.",
    collector: "Move-collect and avoid threats in parallel for steady reward feedback.",
    survivor: "Forgiveness and pressure together — survival decisions get harder over time.",
    avoider: "Short dodge rounds and clear goals — avoid random obstacle soup.",
  },
  intent: {
    strengthTemplate: "Best fit right now: **{templateId}**.",
    strengthFantasy: "World focus: {fantasy}.",
    strengthEnough: "One sentence is enough for a first GameSpec — refine via direction picks.",
    riskGoal: "The win condition is still vague — add what the player must ultimately do.",
    riskThreat: "Threats are vague — you may get theme without pressure.",
    riskProgression: "Progression cues are thin — use direction picks to add layers.",
  },
  directionBullets: {
    commonLead: "Keep title, enemies, goals, and HUD naming unified under 「{fantasy}」.",
    td0: "Stress three tower roles, elite waves, and hold events.",
    td1: "Readable economy beats reskin-only.",
    shooter0: "Stress formations, fire windows, and burst skills.",
    shooter1: "Clear wave escalation within ~3 minutes.",
    platformer0: "Level beats, terrain mechanics, timed micro-goals.",
    platformer1: "Forward exploration, not random single-screen jumps.",
    default0: "Goals, threats, and phase shifts — not theme-only wrapping.",
    default1: "A noticeable shift every ~20–40 seconds.",
    balancedExtra: "Conservative numbers — stable first play.",
    depthExtra: "Thicker mid-layer decisions and phase shifts.",
    spectacleExtra1: "Stronger titles, subtitles, faction naming, and climax beats.",
    spectacleExtra2: "Still playable — bolder thematic packaging allowed.",
  },
  directions: {
    balanced: {
      title: "Ship-ready",
      summary: "Clear rules, obvious goals, easy first play.",
      addonHeader: "[Co-create] Ship-ready",
      addonLine2: "Goals, fail states, and progression visible at a glance.",
      addonLine3: "Conservative numbers for a stable v1.",
    },
    depth: {
      title: "Deeper systems",
      summary: "More events, skills, phases, and mid-layer decisions.",
      addonHeader: "[Co-create] Deeper systems",
      addonLine2: "Boost at least two of: skills, events, elites/bosses, goal shifts.",
      addonLine3: "Not just reskin — visibly richer gameplay.",
    },
    spectacle: {
      title: "Spectacle first",
      summary: "Strong theme, naming, and climax while staying playable.",
      addonHeader: "[Co-create] Spectacle first",
      addonLine2: "Sharper theme naming, HUD copy, and set-piece beats.",
      addonLine3: "Memorable world on top of a complete loop.",
    },
  },
  assets: {
    fileQueue: "Local file queue: **{count}** image(s) (uploads first).",
    clipQueue: "Clipboard queue: **{count}** image(s) (usage: {breakdown}).",
    none: "No queued uploads/clipboard refs this time — text only.",
    purposeUnlabeled: "(usage not set)",
  },
  stream: {
    start: "Prompt received — preparing generation…",
    done: "Done",
    error: "Generation failed unexpectedly",
    recapTemplate: "**Template**: {templateId}",
    recapTitle: "**Title**: {title}",
    recapSubtitle: "**Mood subtitle**: {subtitle}",
    recapTd: "**TD overview**: base HP **{baseHealth}** · start coins **{startingCoins}** · waves **{winScore}** (tweak in quick debug).",
    recapEnemies: "**Enemy types**: **{count}** registered in blueprint.",
    recapGeneric: "**Core numbers**: player speed {playerSpeed} · hazard speed {hazardSpeed} · win score {winScore}.",
    recapSearchUsed: "**Web search**: summary merged; sources may appear after completion.",
    recapSearchFallback: "**Web search**: no usable summary this round — text-only pipeline.{warning}",
  },
};

function hantify(obj) {
  if (typeof obj === "string") {
    return obj
      .replace(/检测/g, "偵測")
      .replace(/描述/g, "描述")
      .replace(/系统/g, "系統")
      .replace(/检索/g, "檢索")
      .replace(/强化/g, "強化")
      .replace(/校验/g, "校驗")
      .replace(/纠错/g, "糾錯")
      .replace(/蓝图/g, "藍圖")
      .replace(/生成/g, "生成")
      .replace(/联网/g, "聯網")
      .replace(/本轮/g, "本輪")
      .replace(/参考/g, "參考")
      .replace(/素材/g, "素材")
      .replace(/剪贴板/g, "剪貼簿")
      .replace(/队列/g, "佇列")
      .replace(/图片/g, "圖片")
      .replace(/没有/g, "沒有")
      .replace(/创意/g, "創意")
      .replace(/准备/g, "準備")
      .replace(/完成/g, "完成")
      .replace(/异常/g, "異常")
      .replace(/敌军/g, "敵軍")
      .replace(/种类/g, "種類")
      .replace(/登记/g, "登記")
      .replace(/基地/g, "基地")
      .replace(/金币/g, "金幣")
      .replace(/波次/g, "波次")
      .replace(/微调/g, "微調")
      .replace(/氛围/g, "氛圍")
      .replace(/副标题/g, "副標題")
      .replace(/选定/g, "選定")
      .replace(/模板/g, "模板")
      .replace(/成品/g, "成品")
      .replace(/标题/g, "標題")
      .replace(/数值/g, "數值")
      .replace(/主角/g, "主角")
      .replace(/威胁/g, "威脅")
      .replace(/取胜/g, "取勝")
      .replace(/目标/g, "目標")
      .replace(/退回/g, "退回")
      .replace(/纯文本/g, "純文字")
      .replace(/管线/g, "管線")
      .replace(/并入/g, "併入")
      .replace(/片段/g, "片段")
      .replace(/来源/g, "來源")
      .replace(/列表/g, "列表")
      .replace(/页内/g, "頁內")
      .replace(/查看/g, "查看")
      .replace(/若有/g, "若有")
      .replace(/未得到/g, "未得到")
      .replace(/有效/g, "有效")
      .replace(/摘要/g, "摘要")
      .replace(/密钥/g, "金鑰")
      .replace(/配额/g, "配額")
      .replace(/无命中/g, "無命中")
      .replace(/皆可/g, "皆可")
      .replace(/提示/g, "提示");
  }
  if (Array.isArray(obj)) return obj.map(hantify);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, hantify(v)]));
  }
  return obj;
}

export const createStudioNarrativeByLocale = {
  "zh-Hans": zhHans,
  "zh-Hant": hantify(zhHans),
  en,
  ms: en,
  th: en,
};
