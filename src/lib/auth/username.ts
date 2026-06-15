/** 登录用户名：小写字母开头，3–32 位，仅 a-z / 0-9 / _ */
const USERNAME_RE = /^[a-z][a-z0-9_]{2,31}$/;

const RESERVED_USERNAMES = new Set([
  "admin",
  "root",
  "system",
  "operone",
  "support",
  "help",
  "null",
  "undefined",
  "console",
  "api",
  "www",
]);

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(username: string): "invalid" | "reserved" | null {
  if (!USERNAME_RE.test(username)) return "invalid";
  if (RESERVED_USERNAMES.has(username)) return "reserved";
  return null;
}
