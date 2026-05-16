/**
 * 为指定小说生成漫画分镜并流式配图
 * 用法：node scripts/generate-comic-for-novel.mjs <novelId> [pageCount]
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const novelId = process.argv[2] || "cmp7w7381000auz81yisafq0h";
const pageCount = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;
const base = process.env.BENCHMARK_BASE_URL ?? "http://localhost:8888";
const ownerCookie = "gcreator_owner=anon";

function parseSseEvents(text) {
  const out = [];
  for (const block of text.split("\n\n")) {
    const line = block.split("\n").find((l) => l.startsWith("data: "));
    if (!line) continue;
    try {
      out.push(JSON.parse(line.slice(6)));
    } catch {
      /* ignore */
    }
  }
  return out;
}

const t0 = Date.now();
console.log("小说 ID:", novelId);
console.log("1/2 生成分镜…", pageCount ? `pageCount=${pageCount}` : "lengthTier=medium");

const genBody = { novelId, lengthTier: "medium" };
if (pageCount) genBody.pageCount = pageCount;

const genRes = await fetch(`${base}/api/comic/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: ownerCookie },
  body: JSON.stringify(genBody),
});
const genData = await genRes.json().catch(() => ({}));
if (!genRes.ok) {
  console.error("分镜失败:", genRes.status, genData);
  process.exit(1);
}

const comicId = genData.comic?.id;
console.log(
  "分镜完成:",
  comicId,
  `· ${genData.pageCount} 页 / ${genData.panelCount} 格`,
  `· ${((Date.now() - t0) / 1000).toFixed(0)}s`,
);
if (genData.panelsRendered > 0) {
  console.log("已内联配图:", genData.panelsRendered, "格");
  console.log("打开:", `${base}/comic/${comicId}`);
  process.exit(0);
}

console.log("2/2 流式配图（可能需数十分钟）…");
const streamRes = await fetch(`${base}/api/comic/${comicId}/panels/stream`, {
  method: "POST",
  headers: { Cookie: ownerCookie },
});
if (!streamRes.ok) {
  console.error("配图流失败:", streamRes.status, await streamRes.text());
  process.exit(1);
}

const reader = streamRes.body.getReader();
const dec = new TextDecoder();
let buf = "";
let withImage = 0;
let total = 0;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  const parts = buf.split("\n\n");
  buf = parts.pop() ?? "";
  for (const chunk of parts) {
    for (const ev of parseSseEvents(chunk + "\n\n")) {
      if (ev.type === "panel_done") {
        console.log(`  格 ${ev.index}/${ev.total} ${ev.ok ? "OK" : "FAIL"}`);
        withImage = ev.withImage ?? withImage;
        total = ev.total ?? total;
      }
      if (ev.type === "done" && ev.withImage != null) {
        withImage = ev.withImage;
        total = ev.total ?? total;
        console.log("完成:", ev.message);
      }
      if (ev.type === "error") {
        console.error("错误:", ev.error);
        process.exit(1);
      }
    }
  }
}

const ms = Date.now() - t0;
const mins = Math.floor(ms / 60000);
const secs = Math.floor((ms % 60000) / 1000);
console.log("\n---");
console.log("漫画:", `${base}/comic/${comicId}`);
console.log("配图:", `${withImage}/${total} 格`);
console.log("总耗时:", `${mins} 分 ${secs} 秒`);
