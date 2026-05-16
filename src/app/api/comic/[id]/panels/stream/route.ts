import { getImageGenAvailability } from "@/lib/image-generation";
import { getComicPanelGenConcurrency, getImageGenBatchPanelCount } from "@/lib/model-config";
import { getOwnerKey } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import {
  countPanelsWithImages,
  parseComicDocument,
  renderComicPanels,
  serializeComicPanels,
} from "@/lib/comic-panel-render";

export const maxDuration = 600;

type RouteContext = { params: Promise<{ id: string }> };

function sseData(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(_req: Request, ctx: RouteContext) {
  const ownerKey = await getOwnerKey();
  if (!ownerKey) {
    return new Response(JSON.stringify({ error: "未授权" }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const { id } = await ctx.params;
  const row = await prisma.comic.findUnique({ where: { id } });
  if (!row || row.ownerKey !== ownerKey) {
    return new Response(JSON.stringify({ error: "未找到" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const doc = parseComicDocument(row.imageUrls);
  if (doc.pages.length === 0) {
    return new Response(JSON.stringify({ error: "暂无分镜数据" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const availability = getImageGenAvailability();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseData(obj)));
      };

      try {
        const batchPanels = getImageGenBatchPanelCount();
        const concurrency = getComicPanelGenConcurrency();
        send({
          type: "status",
          message: availability.ok
            ? batchPanels > 0
              ? `已连接文生图：${availability.openaiModel}，一次请求最多 ${batchPanels} 张，开始生成…`
              : `已连接文生图：${availability.openaiModel}，并发 ${concurrency} 格，开始生成…`
            : availability.message,
        });

        const result = await renderComicPanels(doc, {
          onlyMissing: true,
          onProgress: (ev) => {
            send(ev as unknown as Record<string, unknown>);
            if (ev.type === "panel_done") {
              void prisma.comic
                .update({
                  where: { id },
                  data: {
                    imageUrls: ev.imageUrls,
                    status: ev.withImage > 0 ? "ready" : row.status,
                  },
                })
                .catch(() => {});
            }
          },
        });

        const imageUrls = serializeComicPanels(result.doc);
        const after = countPanelsWithImages(result.doc);

        await prisma.comic.update({
          where: { id },
          data: {
            imageUrls,
            status: after.withImage > 0 ? "ready" : row.status,
          },
        });

        send({
          type: "done",
          ok: true,
          comic: { id, imageUrls },
          rendered: result.rendered,
          withImage: after.withImage,
          total: after.total,
          imageSource: result.imageSource,
          errors: result.errors.length ? result.errors : undefined,
          message:
            after.withImage === 0
              ? result.errors.join("；") || "配图未生成"
              : after.withImage < after.total
                ? `完成：${after.withImage}/${after.total} 格已有配图`
                : "配图全部完成",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "配图生成失败";
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
