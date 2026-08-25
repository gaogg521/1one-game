/**
 * GET /api/projects/[id]/bgm
 * Priority: persisted audio-model artifact → audio model → LLM note sequence.
 * Every response is playable; no configured secret can turn this into a skip.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseGameSpec } from "@/lib/game-spec";
import { ensureProjectBgm } from "@/lib/game-bgm-pipeline";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;

  const row = await prisma.project.findUnique({ where: { id }, select: { specJson: true } });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  // specJson is persisted JSON text; parse it before validating the object.
  let spec;
  try {
    spec = parseGameSpec(JSON.parse(row.specJson));
  } catch {
    return NextResponse.json({ error: "invalid spec" }, { status: 500 });
  }

  const result = await ensureProjectBgm(id, spec);
  if (result.source === "audio_model") return NextResponse.json({ audio: result.audio, source: result.source });
  return NextResponse.json({ notes: result.notes, source: result.source });
}
