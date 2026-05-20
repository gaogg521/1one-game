/**
 * 产品级常量：面向终端用户的能力参数（模型、超时、限流、篇幅等）。
 * 发版时在代码中调整；**.env 仅保留密钥、网关地址、部署开关**（见 `.env.example`）。
 */

export type ImageGenSizeOption = "1024x1024" | "1024x1536" | "1536x1024";
export type OrchestrationQualityTier = "fast" | "standard" | "rich";
export type ReferenceAssetStorageMode = "session" | "cloud";

export const PRODUCT = {
  /** OpenAI 兼容网关默认头（小说流式会按篇幅覆盖 x-openclaw-timeout-ms） */
  gateway: {
    defaultOpenClawTimeoutMs: 600_000,
  },

  models: {
    /** 游戏 / GameSpec / 规格修补 / 视觉参考 */
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
    minAcceptCharsFloor: { short: 180, medium: 1_600, long: 8_000 } as const,
    minAcceptCharsRatio: { short: 0.6, medium: 0.85, long: 0.85 } as const,
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
    batchPanelCount: 4,
    /** 页数 ≥ 此值或小说为 long 时走导演→分镜→镜头→生图流水线 */
    directorPipelineMinPages: 9,
    storyboardChunkPages: 4,
    directorTimeoutMs: 900_000,
    storyboardTimeoutMs: 180_000,
    directorContentMaxChars: 24_000,
    lightPathContentMaxChars: 12_000,
  },

  image: {
    defaultSize: "1024x1024" as ImageGenSizeOption,
  },

  godot: {
    enabled: true,
    /** 全模板走 ai-mother-universal 专业运行时 */
    supportedTemplates: [
      "avoider",
      "collector",
      "survivor",
      "platformer",
      "towerDefense",
      "shooter",
    ] as const,
    /** 新用户默认运行时（可被 localStorage 覆盖） */
    defaultRuntime: "phaser" as "phaser" | "godot",
    importTimeoutMs: 90_000,
    exportTimeoutMs: 180_000,
    /** 已写入母版 export_presets：Web / Windows Desktop / Android */
    exportPresets: ["Web", "Windows Desktop", "Android"] as const,
  },

  game: {
    genTimeoutMs: 18_000,
    repairTimeoutMs: 12_000,
    enhanceTimeoutMs: 18_000,
    totalTimeoutMs: 42_000,
    maxRepairRounds: 2,
    /** 部分网关 strict schema 不兼容扩展 director 时保持 false */
    jsonSchemaIncludeDirector: false,
    /** 生成 GameSpec 前先做 Creative Brief 深度扩写 */
    creativeBriefExpand: true,
    /** Brief 二次润色是否调用 LLM（关则仅用题材知识包） */
    creativeBriefLlm: true,
    briefExpandTimeoutMs: 22_000,
  },

  orchestration: {
    qualityTier: "standard" as OrchestrationQualityTier,
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
