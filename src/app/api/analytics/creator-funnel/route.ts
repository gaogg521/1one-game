import { NextResponse } from "next/server";
import { recordCreatorFunnelEvent } from "@/lib/creator-funnel";

/** Public, intentionally narrow visit endpoint. All meaningful creator stages are server-recorded. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { event?: unknown } | null;
  if (body?.event !== "visit") return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  await recordCreatorFunnelEvent({ event: "visit" });
  return NextResponse.json({ ok: true }, { status: 202 });
}
