/** LiteLLM / 部分自建网关在上游失败时会回传「别名/模型 + do request Post 上游URL」格式 */
export function looksLikeGatewayUpstreamError(msg: string): boolean {
  return /do request:\s*Post\s+"https?:\/\//i.test(msg) || /\[[^\]]+\/[^\]]+\]/.test(msg);
}

/**
 * 把「看起来像直连 Azure/Google」的报错改写成「网关上游失败」说明，避免误以为平台绕过了 LiteLLM。
 */
export function clarifyGatewayUpstreamError(raw: string, gatewayBaseUrl?: string | null): string {
  const msg = raw.trim();
  if (/client-abort after \d+ms|AbortError|aborted/i.test(msg) && /abort|context canceled/i.test(msg)) {
    return [
      "本平台在单次 LLM 超时预算到达后，通过 AbortSignal 主动取消了发往网关的请求（非用户关闭浏览器）。",
      "LiteLLM 上游日志中的 context canceled 通常由此引起；若模型仍偏慢，可在 product-config.game.genTimeoutMs 加长。",
      `详情：${msg}`,
    ].join(" ");
  }
  if (!looksLikeGatewayUpstreamError(msg)) return msg;
  const gw =
    gatewayBaseUrl?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    "（未记录 OPENAI_BASE_URL）";
  return [
    "请求已发到你配置的 OpenAI 兼容网关，但网关在转发上游模型时失败。",
    "报错中的 azure.com / googleapis.com 等域名来自网关的后端路由，不是本平台绕过网关直连外网。",
    `本平台网关：${gw}`,
    `网关返回：${msg}`,
  ].join(" ");
}

export function safeErrorSummary(e: unknown, opts?: { gatewayBaseUrl?: string | null }): string {
  let raw = "unknown error";
  if (!e) raw = "unknown error";
  else if (typeof e === "string") raw = e.slice(0, 1200);
  else if (e instanceof Error) {
    raw = (e.message || e.name || "Error").replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").slice(0, 1200);
  } else {
    try {
      raw = JSON.stringify(e).slice(0, 1200);
    } catch {
      raw = "unknown error";
    }
  }
  return clarifyGatewayUpstreamError(raw, opts?.gatewayBaseUrl).slice(0, 1600);
}

