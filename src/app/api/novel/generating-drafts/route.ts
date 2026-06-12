import { NextResponse } from "next/server";
import { loadNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import { NOVEL_STATUS_DRAFT_GENERATING } from "@/lib/novel-generate-checkpoint";
import { getOwnerKey } from "@/lib/owner";
import { prisma } from "@/lib/prisma";

/** 列出当前用户可断点续写的长篇生成草稿 */
export async function GET() {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return NextResponse.json({ drafts: [] });
  }

  const rows = await prisma.novel.findMany({
    where: { ownerKey, status: NOVEL_STATUS_DRAFT_GENERATING },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      title: true,
      prompt: true,
      content: true,
      updatedAt: true,
      lengthTier: true,
    },
  });

  const drafts = await Promise.all(
    rows.map(async (row) => {
      const meta = await loadNovelGenerationMeta(row.id);
      const checkpoint = meta?.generating;
      return {
        id: row.id,
        title: row.title,
        prompt: row.prompt,
        lengthTier: row.lengthTier,
        contentLength: row.content.length,
        updatedAt: row.updatedAt.toISOString(),
        completedSegments: checkpoint ? checkpoint.completedSegmentIndex + 1 : 0,
        totalSegments: meta?.segmentCount ?? checkpoint?.plan.totalSegments ?? null,
        canResume: Boolean(meta?.bible && meta.chapterPlan),
      };
    }),
  );

  return NextResponse.json({ drafts: drafts.filter((d) => d.canResume) });
}
