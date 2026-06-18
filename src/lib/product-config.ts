/**
 * 产品级常量：面向终端用户的能力参数（模型、超时、限流、篇幅等）。
 * 发版时在代码中调整；**.env 仅保留密钥、网关地址、部署开关**（见 `.env.example`）。
 */

import { godotExportTemplateIds, GAME_TEMPLATE_IDS } from "@/lib/game-templates/registry";

export type ImageGenSizeOption = "1024x1024" | "1024x1536" | "1536x1024";
export type OrchestrationQualityTier = "fast" | "standard" | "rich" | "astrocade";
export type ReferenceAssetStorageMode = "session" | "cloud";

export const PRODUCT = {
  /** OpenAI 兼容网关默认头（小说流式会按篇幅覆盖 x-openclaw-timeout-ms） */
  gateway: {
    defaultOpenClawTimeoutMs: 600_000,
  },

  models: {
    /** 游戏 / GameSpec — 纯文本创意（无参考图） */
    gameTextPrimary: "glm-5-2",
    gameTextFallbacks: ["deepseek-v4-pro"] as string[],
    /** 游戏 / GameSpec — 含参考图或多模态理解（LiteLLM 池内 ID：gpt-5-4） */
    gameVisionPrimary: "gpt-5-4",
    gameVisionFallbacks: ["kimi-k2-6"] as string[],
    /** @deprecated 兼容旧路由；新配置请用 gameText* / gameVision* */
    gamePrimary: "gpt-5.2",
    gameFallbacks: ["gemini-3.1-pro-preview"] as string[],
    /** 小说正文、漫画分镜 JSON */
    novelTextPrimary: "deepseek-v4-pro",
    novelTextFallback: "doubao-seed-2-pro",
    /** 封面、漫画分镜配图 */
    imageOpenAI: "gpt-image-2",
    imageGemini: "gemini-3.1-flash-image-preview",
    /** 非 OpenAI 兼容 Provider 时的备用（需对应 API Key） */
    anthropicPrimary: "claude-3-7-sonnet-latest",
    anthropicFallbacks: [] as string[],
    geminiPrimary: "gemini-3-flash-preview",
    geminiFallbacks: [] as string[],
  },

  novel: {
    /** 正文生成前对一句话创意做 Creative Brief 扩写 */
    creativeBriefExpand: true,
    creativeBriefLlm: true,
    briefExpandTimeoutMs: 24_000,
    llmTimeoutMs: { short: 180_000, medium: 600_000, long: 1_800_000 } as const,
    maxOutputTokens: 65_536,
    minAcceptCharsFloor: { short: 1_000, medium: 2_400, long: 10_000 } as const,
    minAcceptCharsRatio: { short: 0.9, medium: 0.92, long: 0.92 } as const,
    /** 长篇分段续写（设定圣经 → 章规划 → 按章分段写作 → 一致性校验） */
    longSegmented: {
      charsPerSegment: 10_000,
      maxSegments: 24,
      targetTotalChars: 80_000,
      avgCharsPerChapter: 3_200,
      minChapterCount: 12,
      maxChapterCount: 36,
      chaptersPerSegmentMax: 5,
      bibleMaxTokens: 2_048,
      chapterPlanMaxTokens: 4_096,
      segmentMaxTokens: 16_384,
      segmentTimeoutMs: 1_200_000,
      bibleTimeoutMs: 900_000,
      chapterPlanTimeoutMs: 900_000,
      contextTailChars: 2_800,
      contextRecapChapters: 6,
      /** 全书章规划已写完、但未达字数上限时，每次续写追加规划章数 */
      continueExtendChapterCount: 8,
      /** 每批正文写完后是否轻量润色 */
      polishAfterSegment: true,
      polishTimeoutMs: 420_000,
      polishMaxTokens: 8_192,
      /** 续写页可选的「本次写 N 章」预设；0 表示全部待写 */
      continueChapterPresets: [3, 5, 8, 0] as number[],
      continueDefaultMaxChapters: 5,
      /** @deprecated 使用 bibleTimeoutMs */
      outlineTimeoutMs: 900_000,
      /** @deprecated 使用 bibleMaxTokens */
      outlineMaxTokens: 2_048,
    },
  },

  comic: {
    /** 改编前对创意描述做 Brief 扩写（导演包/分镜消费） */
    creativeBriefExpand: true,
    creativeBriefLlm: true,
    briefExpandTimeoutMs: 22_000,
    panelGenConcurrency: 4,
    /** 角色参考图并行生成上限（与分镜配图并发共用配置） */
    charSheetConcurrency: 4,
    /** 单张角色参考图超时（毫秒）；过长会阻塞分镜入库 */
    charSheetTimeoutMs: 180_000,
    /** 单次流内最多配图格数；短篇默认分镜先入库，详情页再异步补图 */
    inlinePanelMaxCount: 1,
    batchPanelCount: 4,
    /** 页数 ≥ 此值或小说为 long 时走导演→分镜→镜头→生图流水线 */
    directorPipelineMinPages: 6,
    /** 中篇默认 8 页走轻量分镜；≥ 此页数才启用导演流水线 */
    mediumDirectorMinPages: 12,
    storyboardChunkPages: 4,
    directorTimeoutMs: 900_000,
    storyboardTimeoutMs: 180_000,
    directorContentMaxChars: 24_000,
    lightPathContentMaxChars: 12_000,
    /** 独立漫画：正文 ≥ 此字数时跳过后台 Brief，直接进入分镜 */
    standaloneBriefSkipMinChars: 1500,
  },

  image: {
    defaultSize: "1024x1024" as ImageGenSizeOption,
  },

  godot: {
    enabled: true,
    /** 全模板走 ai-mother-universal；列表由 game-templates/registry 驱动 */
    supportedTemplates: godotExportTemplateIds(),
    /** 新用户默认运行时（可被 localStorage 覆盖） */
    defaultRuntime: "phaser" as "phaser" | "godot",
    importTimeoutMs: 90_000,
    exportTimeoutMs: 180_000,
    /** 已写入母版 export_presets：Web / Windows Desktop / Android */
    exportPresets: ["Web", "Windows Desktop", "Android"] as const,
  },

  game: {
    /** 单次 GameSpec LLM 调用；过短会在应用侧 AbortSignal 取消，网关记 context canceled */
    genTimeoutMs: 120_000,
    repairTimeoutMs: 90_000,
    enhanceTimeoutMs: 120_000,
    /** Agentic 模块：完整 JS 源码 JSON，需更长网关超时 */
    agenticTimeoutMs: 120_000,
    agenticRepairTimeoutMs: 90_000,
    /** 模型链整段（含 repair / 多模型回退） */
    totalTimeoutMs: 300_000,
    maxRepairRounds: 2,
    /** 部分网关 strict schema 不兼容扩展 director 时保持 false */
    jsonSchemaIncludeDirector: false,
    /** 生成 GameSpec 前先做 Creative Brief 深度扩写 */
    creativeBriefExpand: true,
    /** Brief 二次润色是否调用 LLM（关则仅用题材知识包） */
    creativeBriefLlm: true,
    briefExpandTimeoutMs: 22_000,
    /** Astrocade 级：默认开启 Agentic（AGENTIC_GAME_MODULE=0 关闭） */
    agenticModuleEnabled:
      process.env.AGENTIC_GAME_MODULE === "0" || process.env.AGENTIC_GAME_MODULE === "false"
        ? false
        : true,
    /** 优先 template fallback（接近样品 Scene）；默认全模板；AGENTIC_FORCE_LLM=1 可测 LLM */
    agenticTemplateFirst: (process.env.AGENTIC_TEMPLATE_FIRST ?? GAME_TEMPLATE_IDS.join(","))
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    /** Astrocade 竞对：template-first 用户生成走专用 Scene（与样品馆一致）；DEDICATED_SCENE_FOR_TEMPLATE_FIRST=0 关闭 */
    dedicatedSceneForTemplateFirst:
      process.env.DEDICATED_SCENE_FOR_TEMPLATE_FIRST === "0" ||
      process.env.DEDICATED_SCENE_FOR_TEMPLATE_FIRST === "false"
        ? false
        : true,
    /** Phase D：保存后 Brief 驱动自动封面（GAME_AUTO_COVER_FROM_BRIEF=0 关闭） */
    autoCoverFromBrief:
      process.env.GAME_AUTO_COVER_FROM_BRIEF === "0" ||
      process.env.GAME_AUTO_COVER_FROM_BRIEF === "false"
        ? false
        : true,
  },

  orchestration: {
    qualityTier:
      (process.env.ORCHESTRATION_QUALITY_TIER as "fast" | "standard" | "rich" | "astrocade" | undefined) ??
      "astrocade",
  },

  api: {
    bodyMaxBytes: 524_288,
    rateLimit: {
      windowMs: 60_000,
      postMax: 24,
      streamMax: 20,
      variantsMax: 10,
      refineMax: 12,
    },
  },

  /** 商业化：额度、邀请、套餐（密钥见 .env） */
  commerce: {
    signupBonusQuota: 30,
    referralReferrerCredits: 50,
    referralInviteeCredits: 20,
    generationCost: {
      game: 1,
      novel: 2,
      novelLong: 5,
      novelContinue: 2,
      comic: 3,
      comicPanels: 2,
      refine: 1,
      variants: 2,
      cover: 1,
    } as const,
    freePlanMonthlyQuota: 30,
  },

  llm: {
    withTimeoutMaxMs: 600_000,
    jsonMaxOutputTokens: 12_288,
    textMaxOutputTokens: 16_000,
    visionMaxOutputTokens: 512,
    /** null = 按模型 id 自动判断 max_completion_tokens */
    forceMaxCompletionTokens: null as boolean | null,
  },

  referenceAssets: {
    storageMode: "session" as ReferenceAssetStorageMode,
  },

  comfy: {
    probeTimeoutMs: 2_800,
  },
} as const;
