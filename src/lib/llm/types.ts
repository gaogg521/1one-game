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
  /**
   * Output ceiling for this call. Game runtime code needs far more room than a
   * short structured reply, and a truncated completion fails JSON parsing --
   * which silently selects for the simplest possible output.
   */
  maxTokens?: number;
  /**
   * Skip the automatic second attempt in the other response_format. For an
   * optional enhancement that already has a working fallback, that retry only
   * doubles the creator's wait before the same fallback is taken anyway.
   */
  singleModeOnly?: boolean;
  /**
   * Images attached to the user message, as data: or https: URLs. Only the
   * OpenAI-compatible path sends them; other providers ignore them, so a caller
   * must still make sense without the picture.
   */
  images?: string[];
  /** Opt-in for compatible gateways; omitted unless verified for the routed model. */
  thinking?: { type: "enabled" | "disabled" };
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
