import { NextResponse } from "next/server";
import { recordShareEvent } from "@/lib/auth/referral";
import type { ShareChannel } from "@/lib/auth/types";
import { getCurrentAuthUser, getOwnerKeyFromCookies } from "@/lib/auth/user";
import { localizedJsonError } from "@/lib/api/localized-error";

const CHANNELS = new Set<ShareChannel>([
  "wechat",
  "qq",
  "feishu",
  "line",
  "douyin",
  "copy",
  "link",
  "unknown",
]);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    shareCode?: string;
    workType?: string;
    workId?: string;
    channel?: string;
    referrerUserId?: string;
  };

  const shareCode = body.shareCode?.trim();
  const workId = body.workId?.trim();
  const workType = body.workType?.trim();
  if (!shareCode || !workId || !["game", "novel", "comic"].includes(workType ?? "")) {
    return localizedJsonError(req, "invalidParams", 400);
  }

  const channel = CHANNELS.has(body.channel as ShareChannel)
    ? (body.channel as ShareChannel)
    : "unknown";
  const user = await getCurrentAuthUser();
  const ownerKey = await getOwnerKeyFromCookies();

  await recordShareEvent({
    shareCode,
    workType: workType as "game" | "novel" | "comic",
    workId,
    channel,
    referrerUserId: body.referrerUserId ?? user?.id ?? null,
    visitorOwnerKey: ownerKey ?? null,
  });

  return NextResponse.json({ ok: true });
}
