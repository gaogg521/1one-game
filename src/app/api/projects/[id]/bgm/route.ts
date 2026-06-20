/**
 * GET /api/projects/[id]/bgm
 * 返回该游戏的旋律音符序列（LLM 生成，DB 缓存）。
 * 若配置了第三方 BGM API Key，则返回 { skip: true } 让客户端使用正式 BGM。
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseGameSpec } from "@/lib/game-spec";
import { getRuntimeConfigSync } from "@/lib/runtime-config";
import { generateBgmNotesFromSpec } from "@/lib/game-bgm-gen";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;

  // 若有第三方 BGM API Key，不需要 LLM 降级
  const cfg = getRuntimeConfigSync();
  if (cfg.payload.replicateApiKey) {
    return NextResponse.json({ skip: true });
  }

  const row = await prisma.project.findUnique({ where: { id }, select: { specJson: true, bgmNotesJson: true } });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 已缓存则直接返回
  if (row.bgmNotesJson) {
    try {
      return NextResponse.json({ notes: JSON.parse(row.bgmNotesJson) });
    } catch {
      // cache corrupt, regenerate below
    }
  }

  // 生成并缓存
  const spec = parseGameSpec(row.specJson);
  if (!spec) return NextResponse.json({ error: "invalid spec" }, { status: 500 });

  const notes = await generateBgmNotesFromSpec(spec);
  if (!notes) return NextResponse.json({ error: "generation failed" }, { status: 500 });

  await prisma.project.update({ where: { id }, data: { bgmNotesJson: JSON.stringify(notes) } });

  return NextResponse.json({ notes });
}
