/**
 * 产品级常量：面向终端用户的能力参数（模型、超时、限流、篇幅等）。
 * 发版时在代码中调整；**.env 仅保留密钥、网关地址、部署开关**（见 `.env.example`）。
 */

import { godotExportTemplateIds, GAME_TEMPLATE_IDS } from "@/lib/game-templates/registry";

export type ImageGenSizeOption = "1024x1024" | "1024x1536" | "1536x1024";
export type OrchestrationQualityTier = "fast" | "standard" | "rich" | "astrocade";
export type ReferenceAssetStorageMode = "session" | "cloud" | "cos";

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
    /**
     * 可移植的产品基线。生产和开发环境的实际模型必须由各自的运行时业务路由配置，
     * 不把某台开发机的模型选择写入发版源码。
     */
    novelTextPrimary: "deepseek-v4-pro",
    novelTextFallback: "doubao-seed-2-pro",
    /** 封面、漫画分镜配图（实际服务商和模型由 comic_image_openai 路由决定） */
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
      /** 产品优化：长篇续写默认 8 章（原固定 5 章效率低，长篇 5 章需多次续写） */
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
    /** Secondary exports are disabled; the independent browser runtime is canonical. */
    enabled: false,
    /** 全模板走 ai-mother-universal；列表由 game-templates/registry 驱动 */
    supportedTemplates: godotExportTemplateIds(),
    /** 新用户默认运行时（可被 localStorage 覆盖） */
    defaultRuntime: "independent" as "independent" | "godot",
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
    agenticTimeoutMs: 200_000,
    agenticRepairTimeoutMs: 150_000,
    /** 模型链整段（含 repair / 多模型回退） */
    totalTimeoutMs: 300_000,
    maxRepairRounds: 2,
    /**
     * 部分网关 strict schema 不兼容扩展 director 时设 false；
     * 主链路 GLM-5.2 / DeepSeek-V4 / GPT-5.x 全部已验证支持，默认 true，
     * 让 LLM 直接输出 4 幕 + 5~8 事件，否则节奏永远由 buildDirector 兜底硬塞，
     * 导致所有用户游戏节奏同质化（coinRain @ 0.34 / goalShift @ 0.58 / miniBoss @ 0.82）。
     */
    jsonSchemaIncludeDirector: true,
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

  /**
   * GameForge: the multi-agent game build pipeline.
   *
   * Modules are generated independently so each completion gets a real budget
   * instead of sharing one 12k ceiling with the whole game.
   */
  gameForge: {
    enabled: process.env.GAME_FORGE === "0" || process.env.GAME_FORGE === "false" ? false : true,
    /** Design doc: structured, moderate size. */
    designMaxTokens: 8_192,
    /**
     * Raised 2026-09-07 from 150s after production evidence: production's
     * actual game_text model (deepseek-v4-flash-ga-260731 via Volcengine)
     * generates a far more verbose design document than the model this budget
     * was tuned against locally -- 13724-15655 completion tokens observed vs
     * 2200-6500 locally -- and one isolated, uncontended call timed out at
     * exactly the old 150000ms ceiling while two others finished at 119s and
     * 138s. 150s was cutting it too close for this model's real output size;
     * this budget must fit the slowest model actually routed to it, not the
     * one most recently benchmarked.
     */
    designTimeoutMs: 210_000,
    /**
     * Budget for the fallback design attempt.
     *
     * The design call is the only stage with no degradation path -- no design,
     * no game -- and it is the stage most likely to time out: measured p95 on
     * this gateway is ~148s against a 150s ceiling, and one observed build
     * spent 211s to deliver nothing at all. Retrying the same prompt with the
     * same budget is the worst available move, because a timeout means the
     * reply was too long to finish, and asking again changes neither.
     *
     * So the retry asks for LESS: a smaller plan, one-line briefs, no optional
     * flourishes. A four-module game is a worse game than a seven-module one,
     * and both are infinitely better than a blank screen after three and a
     * half minutes.
     */
    designFallbackTimeoutMs: 90_000,
    /** Per-module code budget. This is the ceiling that used to cap a whole game. */
    moduleMaxTokens: 16_384,
    moduleTimeoutMs: 240_000,
    /**
     * How many module completions may run at once. A plan is 4-7 modules, so
     * this covers a whole plan in ONE wave — at 3 a six-module plan took two
     * waves and doubled the code stage a creator waits through.
     */
    moduleConcurrency: 8,
    /** Game-feel pass rewrites whole modules, so it needs the same budget. */
    feelMaxTokens: 16_384,
    feelTimeoutMs: 200_000,
    /** Repair rounds driven by QA findings. */
    maxRepairRounds: 2,
    repairMaxTokens: 16_384,
    repairTimeoutMs: 200_000,
    /** Attempts per module before the build gives up on it. */
    moduleAttempts: 3,
    /** Concurrent image generations. Slots are independent; this is the art stage's whole width. */
    artConcurrency: 5,
    /**
     * Time budget for the art stage, per slot and in total.
     *
     * Measured on this gateway: four slots in parallel finish in ~36s, the
     * slowest (a background) taking 36s on its own. The image layer's default
     * ceiling is TWELVE MINUTES per call, and a failed call falls back to a
     * second provider with the same ceiling -- so one hung request could hold
     * a slot for 24 minutes. A creator waiting on a one-sentence game will not
     * wait 24 minutes for a picture, and does not have to: a missing slot
     * degrades to the runtime's generated placeholder, which is a worse game
     * but still a game.
     *
     * The budget is what turns "the gateway hiccuped" from a 40-minute build
     * into a build that ships on time with one placeholder in it.
     */
    /**
     * The model review's own budget, separate from the design call's.
     *
     * It used to borrow designTimeoutMs (150s) and was measured at 112s on a
     * build with a single non-blocking finding -- a third of the whole build,
     * spent having a model read code that a real browser had already run
     * clean. The review still earns its place for what the probe cannot judge
     * (whether the game is any good), but not at any price: past this budget
     * the build ships on the deterministic audit plus observed behaviour.
     */
    reviewTimeoutMs: 60_000,
    artSlotTimeoutMs: 75_000,
    artBudgetMs: 150_000,
    /**
     * Boot the assembled build in a headless browser and fold what it actually
     * does into QA.
     *
     * On by default. The two worst defects this pipeline has shipped -- a
     * module that balanced but did not parse, and core systems reading an
     * unprovided shared value -- both passed a green deterministic audit and
     * were only visible in a running browser. Set GAME_FORGE_PROBE=0 for a
     * deployment without playwright; the probe degrades to a no-op anyway, so
     * this is a cost switch, not a correctness one.
     */
    runtimeProbe: process.env.GAME_FORGE_PROBE === "0" || process.env.GAME_FORGE_PROBE === "false" ? false : true,
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
