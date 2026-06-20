export type LlmProvider = "openai" | "openai_compatible" | "litellm" | "anthropic" | "gemini";

export type LlmMode = "json_schema" | "json_object";

export type LlmJsonRequest = {
  provider: LlmProvider;
  model: string;
  system: string;
  user: string;
  temperature: number;
  /** 期望输出模式；provider 可能会自动降级。 */
  mode: LlmMode;
  /**
   * OpenAI-compatible 的 json_schema 需要透传 schema。
   * 其它 provider 可忽略或用于提示词约束。
   */
  jsonSchema?: unknown;
  timeoutMs: number;
  /** P1 修复：外部 AbortSignal */
  signal?: AbortSignal;
};

export type LlmJsonResult =
  | {
      ok: true;
      provider: LlmProvider;
      model: string;
      mode: LlmMode;
      raw: unknown;
    }
  | {
      ok: false;
      provider: LlmProvider;
      model: string;
      modeTried: LlmMode;
      error: string;
    };

export type LlmTextRequest = {
  model: string;
  system: string;
  user: string;
  temperature: number;
  maxTokens?: number;
  timeoutMs: number;
  /** P1 修复：外部 AbortSignal，客户端断连时取消 LLM fetch */
  signal?: AbortSignal;
};

export type LlmTextResult =
  | { ok: true; provider: LlmProvider; model: string; text: string }
  | { ok: false; provider: LlmProvider; model: string; error: string };
