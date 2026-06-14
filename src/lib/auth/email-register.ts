import { cookies } from "next/headers";
import { REF_COOKIE, SESSION_COOKIE } from "@/lib/constants";
import { bindReferralOnSignup } from "@/lib/auth/referral";
import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  validatePasswordStrength,
  verifyPassword,
} from "@/lib/auth/password";
import { verifyRegisterCode } from "@/lib/auth/email-verification";
import {
  createUserSession,
  getOwnerKeyFromCookies,
  linkOwnerKeyToUser,
  sessionCookieOptions,
} from "@/lib/auth/user";
import { grantSignupBonus } from "@/lib/commerce/quota";
import { prisma } from "@/lib/prisma";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";

export type RegisterInput = {
  email: string;
  code: string;
  password: string;
  displayName: string;
  referralCode?: string;
};

export async function registerWithEmail(input: RegisterInput): Promise<
  | { ok: true; userId: string; sessionToken: string }
  | { ok: false; error: "invalidEmail" | "weakPassword" | "invalidCode" | "nameRequired" | "emailTaken" }
> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return { ok: false, error: "invalidEmail" };

  const pwErr = validatePasswordStrength(input.password);
  if (pwErr) return { ok: false, error: "weakPassword" };

  const displayName = input.displayName.trim();
  if (displayName.length < 2 || displayName.length > 32) {
    return { ok: false, error: "nameRequired" };
  }

  const codeOk = await verifyRegisterCode(email, input.code);
  if (!codeOk) return { ok: false, error: "invalidCode" };

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, legacyOwnerKey: true },
  });
  if (existing?.passwordHash) return { ok: false, error: "emailTaken" };

  const ownerKey = await getOwnerKeyFromCookies();
  const jar = await cookies();
  const refCode = input.referralCode?.trim() || jar.get(REF_COOKIE)?.value;

  const passwordHash = hashPassword(input.password);

  let userId: string;
  try {
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          displayName,
          passwordHash,
          ...(ownerKey && !existing.legacyOwnerKey ? { legacyOwnerKey: ownerKey } : {}),
        },
      });
      userId = existing.id;
    } else {
      const user = await prisma.user.create({
        data: {
          email,
          displayName,
          passwordHash,
          legacyOwnerKey: ownerKey,
        },
      });
      userId = user.id;
    }
  } catch (e) {
    if (isPrismaUniqueViolation(e)) return { ok: false, error: "emailTaken" };
    throw e;
  }

  await bindReferralOnSignup(userId, refCode);
  await grantSignupBonus(userId);
  if (ownerKey) await linkOwnerKeyToUser(userId, ownerKey);

  const sessionToken = await createUserSession(userId);
  return { ok: true, userId, sessionToken };
}

export async function loginWithEmail(
  emailRaw: string,
  password: string,
): Promise<
  | { ok: true; userId: string; sessionToken: string }
  | { ok: false; error: "invalidCredentials" }
> {
  const email = normalizeEmail(emailRaw);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return { ok: false, error: "invalidCredentials" };
  }

  const ownerKey = await getOwnerKeyFromCookies();
  if (ownerKey) await linkOwnerKeyToUser(user.id, ownerKey);

  const sessionToken = await createUserSession(user.id);
  return { ok: true, userId: user.id, sessionToken };
}
