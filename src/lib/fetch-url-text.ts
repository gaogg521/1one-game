/**
 * 抓取公开网页正文（简易 HTML 去标签），仅供创意辅助；请勿用于内网或未授权地址。
 */

const MAX_BYTES = 900_000;
const MAX_CHARS = 24_000;
const TIMEOUT_MS = 14_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0") return true;
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

export async function fetchUrlPlainText(rawUrl: string): Promise<{ title?: string; text: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("链接格式无效");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("仅支持 http/https 链接");
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error("出于安全考虑，该地址不允许抓取");
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: ac.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "User-Agent":
          process.env.OPENAI_USER_AGENT?.trim() ??
          "Mozilla/5.0 (compatible; GamePromptBot/1.0; +https://example.invalid)",
      },
    });
    if (!res.ok) {
      throw new Error(`抓取失败 HTTP ${res.status}`);
    }
    const ctype = res.headers.get("content-type") ?? "";
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      throw new Error("页面体积过大");
    }

    if (ctype.includes("text/plain")) {
      const text = new TextDecoder("utf8").decode(buf);
      return { text: text.slice(0, MAX_CHARS) };
    }

    const html = new TextDecoder("utf8").decode(buf);
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const title = titleMatch?.[1] ? stripHtml(titleMatch[1]).slice(0, 200) : undefined;
    const plain = stripHtml(html).slice(0, MAX_CHARS);
    return { title, text: plain };
  } finally {
    clearTimeout(timer);
  }
}
