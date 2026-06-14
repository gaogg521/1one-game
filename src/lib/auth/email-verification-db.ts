import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type EmailVerificationRow = {
  id: string;
  email: string;
  codeHash: string;
  purpose: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
};

export async function userHasRegisteredPassword(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true },
  });
  return Boolean(user?.passwordHash);
}

export async function findRecentEmailVerification(
  email: string,
  purpose: string,
): Promise<EmailVerificationRow | null> {
  return prisma.emailVerification.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function findValidEmailVerification(
  email: string,
  purpose: string,
): Promise<EmailVerificationRow | null> {
  return prisma.emailVerification.findFirst({
    where: {
      email,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createEmailVerification(params: {
  email: string;
  codeHash: string;
  purpose: string;
  expiresAt: Date;
}): Promise<string> {
  const id = randomUUID();
  await prisma.emailVerification.create({
    data: {
      id,
      email: params.email,
      codeHash: params.codeHash,
      purpose: params.purpose,
      expiresAt: params.expiresAt,
    },
  });
  return id;
}

export async function deleteEmailVerification(id: string): Promise<void> {
  await prisma.emailVerification.delete({ where: { id } }).catch(() => {});
}

export async function consumeEmailVerification(id: string): Promise<void> {
  await prisma.emailVerification.update({
    where: { id },
    data: { consumedAt: new Date() },
  });
}
