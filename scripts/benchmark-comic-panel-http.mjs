/**
 * 经本地 dev 服务 POST /api/comic/[id]/panels/stream（等同浏览器「生成配图」）
 * 运行前需 npm run dev；运行：node scripts/benchmark-comic-panel-http.mjs [comicId]
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createRequire } from "module";

config({ path: resolve(process.cwd(), ".env") });

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const base = process.env.BENCHMARK_BASE_URL ?? "http://localhost:8888";
const ownerKey = "benchmark-panel-batch";

let comicId = process.argv[2];

async function ensureComic() {
  if (comicId) {
    const row = await prisma.comic.findUnique({ where: { id: comicId } });
    if (!row) throw new Error(`漫画不存在: ${comicId}`);
    return row;
  }

  const existing = await prisma.comic.findFirst({
    where: { ownerKey },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;

  const novel = await prisma.novel.create({
    data: {
      ownerKey,
      title: "批量配图基准",
      prompt: "穿越崇祯",
      content: "基准测试",
      summary: "基准",
      status: "ready",
    },
  });

  return prisma.comic.create({
    data: {
      ownerKey,
      novelId: novel.id,
      title: "批量配图基准 · 漫画",
      prompt: novel.prompt,
      imageUrls: JSON.stringify({
        formatVersion: 2,
        pageCount: 1,
        pages: [
          {
            page: 1,
            panels: [
              { caption: "煤山脚下", prompt: "Late Ming Chongzhen at coal hill, manga panel" },
              { caption: "京城风雨", prompt: "Beijing walls in storm, historical manga" },
              { caption: "宫内议事", prompt: "Imperial court debate, manga style" },
              { caption: "黎明破晓", prompt: "Dawn over forbidden city, manga" },
            ],
          },
        ],
      }),
      status: "ready",
    },
  });
}

function parseSseChunk(text) {
  const events = [];
  for (const block of text.split("\n\n")) {
    const line = block.split("\n").find((l) => l.startsWith("data: "));
    if (!line) continue;
    try {
      events.push(JSON.parse(line.slice(6)));
    } catch {
      // ignore
    }
  }
  return events;
}

const comic = await ensureComic();
comicId = comic.id;
console.log("comicId:", comicId);
console.log("POST", `${base}/api/comic/${comicId}/panels/stream`);

const t0 = Date.now();
const res = await fetch(`${base}/api/comic/${comicId}/panels/stream`, {
  method: "POST",
  headers: {
    Cookie: `gcreator_owner=${ownerKey}`,
  },
});

if (!res.ok) {
  console.error("HTTP", res.status, await res.text());
  process.exit(1);
}

const reader = res.body?.getReader();
if (!reader) {
  console.error("无响应流");
  process.exit(1);
}

const dec = new TextDecoder();
let buf = "";
let lastDone = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  const parts = buf.split("\n\n");
  buf = parts.pop() ?? "";
  for (const chunk of parts) {
    for (const ev of parseSseChunk(chunk + "\n\n")) {
      if (ev.type === "start" || ev.type === "status" || ev.type === "panel_done" || ev.type === "done") {
        console.log("[sse]", ev.type, ev.message ?? (ev.ok != null ? `格${ev.index} ok=${ev.ok}` : ""));
      }
      if (ev.type === "done" || (ev.type === "done" && ev.ok)) lastDone = ev;
      if (ev.type === "error") {
        console.error("[sse] error", ev.error);
        process.exit(1);
      }
    }
  }
}

const totalMs = Date.now() - t0;
const mins = Math.floor(totalMs / 60000);
const secs = Math.floor((totalMs % 60000) / 1000);
console.log("\n--- HTTP 流式结果 ---");
console.log("message:", lastDone?.message);
console.log("withImage:", lastDone?.withImage, "/", lastDone?.total);
console.log("总耗时:", `${mins} 分 ${secs} 秒`, `(${totalMs} ms)`);

await prisma.$disconnect();
process.exit(lastDone?.withImage > 0 ? 0 : 1);
