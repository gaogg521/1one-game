import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GameplayEventPayloadSchema } from "@/lib/gameplay-telemetry";

export const runtime = "nodejs";

/**
 * Minimal anonymous play-quality telemetry. This route intentionally accepts
 * no prompt, user identity, raw input, or client fingerprint.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = GameplayEventPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }

  try {
    await prisma.gameplayEvent.create({ data: parsed.data });
  } catch {
    // The client deliberately treats this telemetry route as non-blocking.
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true }, { status: 202 });
}
