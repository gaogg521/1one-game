import { createHash, randomInt } from "node:crypto";
import { normalizeEmail } from "@/lib/auth/password";
import { sendRegisterVerificationEmail } from "@/lib/auth/email-sender";
import {
  consumeEmailVerification,
  createEmailVerification,
  deleteEmailVerification,
  findRecentEmailVerification,
  findValidEmailVerification,
  userHasRegisteredPassword,
} from "@/lib/auth/email-verification-db";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return String(randomInt(100000, 999999));
}

export async function sendRegisterVerificationCode(emailRaw: string): Promise<{
  ok: boolean;
  error?: "invalidEmail" | "emailTaken" | "cooldown" | "sendFailed";
  devCode?: string;
}> {
  const email = normalizeEmail(emailRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "invalidEmail" };
  }

  if (await userHasRegisteredPassword(email)) {
    return { ok: false, error: "emailTaken" };
  }

  const recent = await findRecentEmailVerification(email, "register");
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "cooldown" };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  const verificationId = await createEmailVerification({
    email,
    codeHash: hashCode(code),
    purpose: "register",
    expiresAt,
  });

  const devExpose = process.env.EMAIL_AUTH_DEV_EXPOSE === "1" || process.env.NODE_ENV !== "production";
  const sendResult = await sendRegisterVerificationEmail(email, code);

  if (!sendResult.ok) {
    console.warn(`[email-auth] send failed for ${email}: ${sendResult.error}`);
    if (devExpose) {
      console.info(`[email-auth] register code for ${email}: ${code}`);
      return { ok: true, devCode: code };
    }
    await deleteEmailVerification(verificationId).catch(() => undefined);
    return { ok: false, error: "sendFailed" };
  }

  if (devExpose) {
    console.info(`[email-auth] register code for ${email}: ${code}`);
  }
  return { ok: true, ...(devExpose ? { devCode: code } : {}) };
}

export async function verifyRegisterCode(emailRaw: string, code: string): Promise<boolean> {
  const email = normalizeEmail(emailRaw);
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;

  const row = await findValidEmailVerification(email, "register");
  if (!row || row.codeHash !== hashCode(trimmed)) return false;

  await consumeEmailVerification(row.id);
  return true;
}
