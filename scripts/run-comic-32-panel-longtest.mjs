/**
 * 32 格配图 SSE 长测（需 8888 已启动，走服务端同一 DATABASE_URL）
 * node scripts/run-comic-32-panel-longtest.mjs
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { writeFileSync, appendFileSync } from "node:fs";

config({ path: resolve(process.cwd(), ".env") });

const base = process.env.BENCHMARK_BASE_URL ?? "http://127.0.0.1:8888";
const ownerKey = "panel-longtest";
const cookie = `gcreator_owner=${ownerKey}`;
const SNIPPET =
  "崇祯十七年三月，煤山风紧。宫中余烬未冷，城外炮声已近。李自成大军围德胜门，守军士气涣散。";

function parseSseChunk(text) {
  const events = [];
  for (const block of text.split("\n\n")) {
    const line = block.split("\n").find((l) => l.startsWith("data: "));
    if (!line) continue;
    try {
      events.push(JSON.parse(line.slice(6)));
    } catch {
      /* ignore */
    }
  }
  return events;
}

async function main() {
  const health = await fetch(`${base}/api/health`);
  if (!health.ok) throw new Error(`health ${health.status}`);

  console.log("[1/2] 生成 8 页分镜…");
  const tStory = Date.now();
  const gen = await fetch(`${base}/api/comic/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      content: SNIPPET.repeat(4),
      title: "32格配图长测",
      pageCount: 8,
      lengthTier: "medium",
    }),
  });
  const genBody = await gen.json().catch(() => ({}));
  if (!gen.ok) {
    throw new Error(`comic generate ${gen.status}: ${genBody.error ?? JSON.stringify(genBody)}`);
  }
  const comicId = genBody.comic?.id;
  const storySec = ((Date.now() - tStory) / 1000).toFixed(1);
  console.log(`[OK] 分镜 ${genBody.pageCount} 页 / ${genBody.panelCount} 格 · ${storySec}s · id=${comicId}`);

  console.log("[2/2] SSE 配图…");
  const t0 = Date.now();
  const res = await fetch(`${base}/api/comic/${comicId}/panels/stream`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  if (!res.ok) throw new Error(`panels/stream ${res.status}: ${await res.text()}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let lastDone = null;
  let panelDone = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const chunk of parts) {
      for (const ev of parseSseChunk(chunk + "\n\n")) {
        if (ev.type === "panel_done") {
          panelDone += 1;
          console.log(`  [panel_done] ${panelDone} · ${ev.message ?? ""}`);
        }
        if (ev.type === "done") lastDone = ev;
        if (ev.type === "error") throw new Error(ev.error ?? "配图失败");
      }
    }
  }

  const totalMs = Date.now() - t0;
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const line = `[SUMMARY] 配图 ${lastDone?.withImage ?? 0}/${lastDone?.total ?? 32} · ${mins}m${secs}s (${totalMs}ms) · comic=${comicId}`;
  console.log("\n" + line);

  const reportPath = resolve(process.cwd(), "PROJECT_MEMORY/COMIC_32_PANEL_LONGTEST.md");
  const block = `\n## ${new Date().toISOString()}\n- 分镜: ${storySec}s · ${genBody.pageCount} 页\n- ${line}\n`;
  try {
    appendFileSync(reportPath, block, "utf8");
  } catch {
    writeFileSync(reportPath, `# 漫画 32 格配图长测\n${block}`, "utf8");
  }
  process.exit(lastDone?.withImage > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("[FAIL]", e.message ?? e);
  process.exit(1);
});
