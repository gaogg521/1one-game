import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/lib/auth/user";
import { getQuotaSummary } from "@/lib/commerce/quota";
import { prisma } from "@/lib/prisma";
import { localizedJsonError } from "@/lib/api/localized-error";

export async function GET(req: Request) {
  const user = await getCurrentAuthUser();
  if (!user) return localizedJsonError(req, "notLoggedIn", 401);

  const summary = await getQuotaSummary(user.id);
  const ledger = await prisma.quotaLedger.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { delta: true, balanceAfter: true, reason: true, createdAt: true },
  });

  return NextResponse.json({ ...summary, ledger });
}
