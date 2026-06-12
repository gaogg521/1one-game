import { createHash, randomBytes } from "crypto";
import { redisGet, redisSet } from "@/lib/cache/redis-kv";

type TokenCache = { token: string; expiresAt: number };
type TicketCache = { ticket: string; expiresAt: number };

const REDIS_TOKEN_KEY = "1one:wechat:access_token";
const REDIS_TICKET_KEY = "1one:wechat:jsapi_ticket";

let accessTokenCache: TokenCache | null = null;
let jsapiTicketCache: TicketCache | null = null;

function mpCredentials(): { appId: string; secret: string } | null {
  const appId = process.env.WECHAT_MP_APP_ID?.trim() ?? process.env.OAUTH_WECHAT_APP_ID?.trim();
  const secret = process.env.WECHAT_MP_APP_SECRET?.trim() ?? process.env.OAUTH_WECHAT_APP_SECRET?.trim();
  if (!appId || !secret) return null;
  return { appId, secret };
}

export function isWechatJssdkConfigured(): boolean {
  return Boolean(mpCredentials());
}

async function fetchAccessToken(): Promise<string> {
  const cred = mpCredentials();
  if (!cred) throw new Error("微信 JS-SDK 未配置 WECHAT_MP_APP_ID/SECRET");
  const now = Date.now();
  const fromRedis = await redisGet(REDIS_TOKEN_KEY);
  if (fromRedis) {
    accessTokenCache = { token: fromRedis, expiresAt: now + 3_600_000 };
    return fromRedis;
  }
  if (accessTokenCache && accessTokenCache.expiresAt > now + 60_000) {
    return accessTokenCache.token;
  }
  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", cred.appId);
  url.searchParams.set("secret", cred.secret);
  const res = await fetch(url);
  const json = (await res.json()) as { access_token?: string; expires_in?: number; errmsg?: string };
  if (!json.access_token) throw new Error(json.errmsg ?? "微信 access_token 获取失败");
  const ttl = json.expires_in ?? 7200;
  accessTokenCache = {
    token: json.access_token,
    expiresAt: now + ttl * 1000,
  };
  await redisSet(REDIS_TOKEN_KEY, json.access_token, Math.max(60, ttl - 120));
  return json.access_token;
}

async function fetchJsApiTicket(): Promise<string> {
  const now = Date.now();
  const fromRedis = await redisGet(REDIS_TICKET_KEY);
  if (fromRedis) {
    jsapiTicketCache = { ticket: fromRedis, expiresAt: now + 3_600_000 };
    return fromRedis;
  }
  if (jsapiTicketCache && jsapiTicketCache.expiresAt > now + 60_000) {
    return jsapiTicketCache.ticket;
  }
  const token = await fetchAccessToken();
  const url = new URL("https://api.weixin.qq.com/cgi-bin/ticket/getticket");
  url.searchParams.set("type", "jsapi");
  url.searchParams.set("access_token", token);
  const res = await fetch(url);
  const json = (await res.json()) as { ticket?: string; expires_in?: number; errmsg?: string };
  if (!json.ticket) throw new Error(json.errmsg ?? "微信 jsapi_ticket 获取失败");
  const ttl = json.expires_in ?? 7200;
  jsapiTicketCache = {
    ticket: json.ticket,
    expiresAt: now + ttl * 1000,
  };
  await redisSet(REDIS_TICKET_KEY, json.ticket, Math.max(60, ttl - 120));
  return json.ticket;
}

function sha1(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

export async function buildWechatJssdkConfig(pageUrl: string) {
  const cred = mpCredentials();
  if (!cred) return null;
  const ticket = await fetchJsApiTicket();
  const nonceStr = randomBytes(8).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000);
  const url = pageUrl.split("#")[0] ?? pageUrl;
  const raw = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
  const signature = sha1(raw);
  return {
    appId: cred.appId,
    timestamp,
    nonceStr,
    signature,
    jsApiList: ["updateAppMessageShareData", "updateTimelineShareData", "onMenuShareAppMessage", "onMenuShareTimeline"],
  };
}
