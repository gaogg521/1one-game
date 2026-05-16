/** 生成类 API 统一错误载荷（可与监控/客户端按 code 分类）。 */

export type ApiGenerateErrorPayload = {
  error: string;
  code?: string;
  requestId?: string;
};

export function generationErrorCodes() {
  return {
    BODY_TOO_LARGE: "BODY_TOO_LARGE",
    BAD_JSON: "BAD_JSON",
    RATE_LIMITED: "RATE_LIMITED",
    BAD_REQUEST: "BAD_REQUEST",
    UNAUTHORIZED: "UNAUTHORIZED",
    LLM_FAILED: "LLM_FAILED",
    INTERNAL: "INTERNAL",
  } as const;
}
