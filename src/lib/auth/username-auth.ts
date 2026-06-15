import { cookies } from "next/headers";
import { REF_COOKIE } from "@/lib/constants";
import { bindReferralOnSignup } from "@/lib/auth/referral";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { normalizeUsername, validateUsername } from "@/lib/auth/username";
import {
  createUserSession,
  getOwnerKeyFromCookies,
  linkOwnerKeyToUser,
} from "@/lib/auth/user";
import { grantSignupBonus } from "@/lib/commerce/quota";
import { prisma } from "@/lib/prisma";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";

export type UsernameRegisterInput = {
  username: string;
  password: string;
  displayName?: string;
  referralCode?: string;
};

export async function registerWithUsername(input: UsernameRegisterInput): Promise<
  | { ok: true; userId: string; sessionToken: string }
  | {
      ok: false;
      error: "invalidUsername" | "usernameReserved" | "weakPassword" | "nameRequired" | "usernameTaken";
    }
> {
  const username = normalizeUsername(input.username);
  const usernameErr = validateUsername(username);
  if (usernameErr === "invalid") return { ok: false, error: "invalidUsername" };
  if (usernameErr === "reserved") return { ok: false, error: "usernameReserved" };

  const pwErr = validatePasswordStrength(input.password);
  if (pwErr) return { ok: false, error: "weakPassword" };

  const displayName = (input.displayName?.trim() || input.username.trim()).slice(0, 32);
  if (displayName.length < 2) return { ok: false, error: "nameRequired" };

  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true, passwordHash: true },
  });
  if (existing?.passwordHash) return { ok: false, error: "usernameTaken" };

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
          username,
          displayName,
          passwordHash,
          ...(ownerKey ? { legacyOwnerKey: ownerKey } : {}),
        },
      });
      userId = existing.id;
    } else {
      const user = await prisma.user.create({
        data: {
          username,
          displayName,
          passwordHash,
          legacyOwnerKey: ownerKey,
        },
      });
      userId = user.id;
    }
  } catch (e) {
    if (isPrismaUniqueViolation(e)) return { ok: false, error: "usernameTaken" };
    throw e;
  }

  await bindReferralOnSignup(userId, refCode);
  await grantSignupBonus(userId);
  if (ownerKey) await linkOwnerKeyToUser(userId, ownerKey);

  const sessionToken = await createUserSession(userId);
  return { ok: true, userId, sessionToken };
}

export async function loginWithUsername(
  usernameRaw: string,
  password: string,
): Promise<
  | { ok: true; userId: string; sessionToken: string }
  | { ok: false; error: "invalidCredentials" }
> {
  const username = normalizeUsername(usernameRaw);
  const user = await prisma.user.findUnique({
    where: { username },
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
