import { prisma } from "@/lib/prisma";
import { decryptRuntimeSecrets, encryptRuntimeSecrets } from "@/lib/runtime-config-crypto";
import type { EmailConfigPayload } from "@/lib/email-config-types";

const ROW_ID = "default";

export async function findPlatformEmailConfigRow() {
  return prisma.platformEmailConfig.findUnique({
    where: { id: ROW_ID },
    select: { configEnc: true, updatedAt: true, updatedByUserId: true },
  });
}

export function parseEmailConfigEnc(enc: string | null | undefined): EmailConfigPayload {
  if (!enc) return {};
  try {
    return JSON.parse(decryptRuntimeSecrets(enc)) as EmailConfigPayload;
  } catch {
    return {};
  }
}

export async function upsertPlatformEmailConfig(params: {
  configEnc: string;
  updatedByUserId: string | null;
}): Promise<void> {
  await prisma.platformEmailConfig.upsert({
    where: { id: ROW_ID },
    create: {
      id: ROW_ID,
      configEnc: params.configEnc,
      updatedByUserId: params.updatedByUserId,
    },
    update: {
      configEnc: params.configEnc,
      updatedByUserId: params.updatedByUserId,
    },
  });
}

export async function deletePlatformEmailConfig(): Promise<void> {
  await prisma.platformEmailConfig.delete({ where: { id: ROW_ID } }).catch(() => {});
}

export function encryptEmailConfigPayload(payload: EmailConfigPayload): string {
  return encryptRuntimeSecrets(JSON.stringify(payload));
}
