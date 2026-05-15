/** 服务端请求关联 ID（结构化日志 x-request-id 头对齐）。 */
export function newGenerateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function ridHeaders(requestId: string): HeadersInit {
  return { "x-request-id": requestId };
}
