import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const CONSOLE_2FA_COOKIE = "gcreator_console_2fa";
const TTL_MS = 12 * 60 * 60 * 1000;

function signingSecret(): string | null {
  const pin = process.env.ADMIN_CONSOLE_2FA_PIN?.trim();
  if (!pin) return null;
  return process.env.SUPER_ADMIN_SECRET?.trim() || pin;
}

/** 生产且配置了 PIN 时，控制台 UI 需二次验证 */
export function isConsole2faRequired(): boolean {
  return process.env.NODE_ENV === "production" && Boolean(process.env.ADMIN_CONSOLE_2FA_PIN?.trim());
}

export function verifyConsole2faPin(pin: string): boolean {
  const expected = process.env.ADMIN_CONSOLE_2FA_PIN?.trim();
  if (!expected || !pin) return false;
  if (pin.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(pin), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function mintConsole2faToken(userId: string): string {
  const secret = signingSecret();
  if (!secret) throw new Error("console 2FA not configured");
  const exp = Date.now() + TTL_MS;
  const payload = `${userId}:${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function validateConsole2faToken(token: string, userId: string): boolean {
  const secret = signingSecret();
  if (!secret) return false;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [uid, expRaw, sig] = decoded.split(":");
    if (!uid || !expRaw || !sig || uid !== userId) return false;
    const exp = Number.parseInt(expRaw, 10);
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    const payload = `${uid}:${expRaw}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    if (sig.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function hasValidConsole2faSession(userId: string): Promise<boolean> {
  if (!isConsole2faRequired()) return true;
  const jar = await cookies();
  const raw = jar.get(CONSOLE_2FA_COOKIE)?.value;
  if (!raw) return false;
  return validateConsole2faToken(raw, userId);
}
