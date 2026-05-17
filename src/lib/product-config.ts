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
    llmTimeoutMs: { short: 180_000, medium: 600_000, long: 1_800_000 } as const,
    maxOutputTokens: 65_536,
    minAcceptCharsFloor: { short: 180, medium: 1_600, long: 8_000 } as const,
    minAcceptCharsRatio: { short: 0.6, medium: 0.85, long: 0.85 } as const,
    /** 长篇分段续写 */
    longSegmented: {
      charsPerSegment: 10_000,
      maxSegments: 24,
      targetTotalChars: 80_000,
      outlineMaxTokens: 2_048,
      segmentMaxTokens: 16_384,
      segmentTimeoutMs: 1_200_000,
      outlineTimeoutMs: 900_000,
      contextTailChars: 2_800,
      contextRecapChapters: 6,
    },
  },

  comic: {
    panelGenConcurrency: 4,
    batchPanelCount: 4,
  },

  image: {
    defaultSize: "1024x1024" as ImageGenSizeOption,
  },

  game: {
    genTimeoutMs: 18_000,
    repairTimeoutMs: 12_000,
    enhanceTimeoutMs: 18_000,
    totalTimeoutMs: 42_000,
    maxRepairRounds: 2,
    /** 部分网关 strict schema 不兼容扩展 director 时保持 false */
    jsonSchemaIncludeDirector: false,
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
