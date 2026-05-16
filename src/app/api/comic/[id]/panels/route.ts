import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerKey } from "@/lib/owner";
import {
  countPanelsWithImages,
  parseComicDocument,
  renderComicPanels,
  serializeComicPanels,
} from "@/lib/comic-panel-render";
import { getImageGenAvailability } from "@/lib/image-generation";

/** 漫画分镜配图：每格经网关文生图约 1～6 分钟，4 格顺序生成。 */
export const maxDuration = 600;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await prisma.comic.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }

  const doc = parseComicDocument(row.imageUrls);
  if (doc.pages.length === 0) {
    return NextResponse.json({ error: "暂无分镜数据" }, { status: 400 });
  }

  const before = countPanelsWithImages(doc);
  if (before.withImage >= before.total) {
    return NextResponse.json({
      ok: true,
      comic: { id, imageUrls: row.imageUrls },
      rendered: 0,
      withImage: before.withImage,
      total: before.total,
      imageSource: "none",
      message: "配图已齐全",
    });
  }

  const availability = getImageGenAvailability();

  try {
    const { doc: updated, rendered, total, imageSource, errors, imageGenHint } =
      await renderComicPanels(doc, {
        onlyMissing: true,
      });
    const after = countPanelsWithImages(updated);
    const imageUrls = serializeComicPanels(updated);

    await prisma.comic.update({
      where: { id },
      data: {
        imageUrls,
        status: after.withImage > 0 ? "ready" : row.status,
      },
    });

    const errSummary = errors.length > 0 ? errors.slice(0, 4).join("；") : undefined;

    return NextResponse.json({
      ok: true,
      comic: { id, imageUrls },
      rendered,
      attempted: total,
      withImage: after.withImage,
      total: after.total,
      imageSource,
      imageGenModel: availability.openaiModel,
      imageGenHint,
      errors: errors.length ? errors : undefined,
      message:
        after.withImage === 0
          ? errSummary ||
            `配图未生成。${availability.message}。请查看终端日志 [comic-panels] / [image-gen]`
          : after.withImage < after.total
            ? `已生成 ${rendered} 张，仍有 ${after.total - after.withImage} 格待补${errSummary ? `（${errSummary}）` : ""}`
            : "配图生成完成",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "配图生成失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
