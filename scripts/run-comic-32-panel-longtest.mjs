/**
 * 32 格配图 SSE 长测（需 8888 已启动，走服务端同一 DATABASE_URL）
 * npm run qa:comic-32-panels
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";

config({ path: resolve(process.cwd(), ".env") });
/** Node 内置 fetch 默认 headersTimeout=300s；SSE 长连接需放宽（panels/stream 亦可能 >5min） */
process.env.UNDICI_HEADERS_TIMEOUT = "0";
process.env.UNDICI_BODY_TIMEOUT = "0";

const base = process.env.BENCHMARK_BASE_URL ?? "http://127.0.0.1:8888";
const ownerKey = "panel-longtest";
const cookie = `gcreator_owner=${ownerKey}`;
const SNIPPET =
  "崇祯十七年三月，煤山风紧。宫中余烬未冷，城外炮声已近。李自成大军围德胜门，守军士气涣散。";

function longFetch(url, init = {}) {
  return fetch(url, init);
}

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

async function readSseStream(res, onEvent) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const chunk of parts) {
      for (const ev of parseSseChunk(chunk + "\n\n")) {
        onEvent(ev);
      }
    }
  }
}

async function generateComicViaStream(body) {
  const t0 = Date.now();
  const res = await longFetch(`${base}/api/comic/generate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`comic generate/stream ${res.status}: ${text.slice(0, 400)}`);
  }

  let lastDone = null;
  let lastError = null;
  let lastProgress = "";

  await readSseStream(res, (ev) => {
    if (ev.step === "ping") return;
    if (ev.step === "error" || ev.ok === false) {
      lastError = ev.message ?? ev.error ?? "分镜失败";
      return;
    }
    if (ev.message) {
      lastProgress = ev.message;
      console.log(`  [gen] ${ev.step ?? "?"} · ${ev.message}`);
    }
    if (ev.step === "done") lastDone = ev;
  });

  if (lastError) throw new Error(lastError);
  if (!lastDone?.comic?.id) throw new Error("分镜 SSE 未返回 comic.id");

  const storySec = ((Date.now() - t0) / 1000).toFixed(1);
  return {
    comicId: lastDone.comic.id,
    pageCount: lastDone.pageCount,
    panelCount: lastDone.panelCount,
    storySec,
    lastProgress,
  };
}

async function streamPanelRender(comicId) {
  const t0 = Date.now();
  const res = await longFetch(`${base}/api/comic/${comicId}/panels/stream`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  if (!res.ok) throw new Error(`panels/stream ${res.status}: ${await res.text()}`);

  let lastDone = null;
  let panelDone = 0;

  await readSseStream(res, (ev) => {
    if (ev.type === "panel_done") {
      panelDone += 1;
      console.log(`  [panel_done] ${panelDone} · ${ev.message ?? ""}`);
    }
    if (ev.type === "done") lastDone = ev;
    if (ev.type === "error") throw new Error(ev.error ?? "配图失败");
  });

  return { ...lastDone, elapsedMs: Date.now() - t0 };
}

async function streamPanelRenderUntilComplete(comicId, expectedTotal, maxPasses = 4) {
  let lastDone = null;
  let totalMs = 0;
  for (let pass = 1; pass <= maxPasses; pass++) {
    console.log(`[2/${pass}] SSE 配图（第 ${pass}/${maxPasses} 轮）…`);
    const round = await streamPanelRender(comicId);
    lastDone = round;
    totalMs += round.elapsedMs ?? 0;
    const withImage = round?.withImage ?? 0;
    /** done.total 为本轮 flat.length（缺格数），须与全书 expectedTotal 比较 */
    if (withImage >= expectedTotal) break;
    const remain = expectedTotal - withImage;
    console.log(`  [retry] 仍缺 ${remain} 格，${pass < maxPasses ? "继续补跑" : "已达最大轮次"}`);
  }
  return { ...lastDone, elapsedMs: totalMs };
}

async function main() {
  const health = await longFetch(`${base}/api/health`);
  if (!health.ok) throw new Error(`health ${health.status}`);

  const resumeId = process.env.COMIC_LONGTEST_RESUME_ID?.trim();
  const maxPasses = Math.min(6, Math.max(1, Number.parseInt(process.env.COMIC_LONGTEST_MAX_PASSES ?? "4", 10) || 4));

  let gen;
  if (resumeId) {
    console.log(`[skip] 续跑配图 comic=${resumeId}`);
    gen = { comicId: resumeId, pageCount: 8, panelCount: 64, storySec: "0" };
  } else {
    console.log("[1/2] 生成 8 页分镜（SSE，无 headers 超时）…");
    gen = await generateComicViaStream({
      content: SNIPPET.repeat(4),
      title: "32格配图长测",
      pageCount: 8,
      lengthTier: "medium",
    });
    console.log(
      `[OK] 分镜 ${gen.pageCount} 页 / ${gen.panelCount} 格 · ${gen.storySec}s · id=${gen.comicId}`,
    );
  }

  const lastDone = await streamPanelRenderUntilComplete(gen.comicId, gen.panelCount, maxPasses);

  const withImage = lastDone?.withImage ?? 0;
  const total = lastDone?.total ?? gen.panelCount ?? 32;
  const totalMs = lastDone?.elapsedMs ?? 0;
  const line = `[SUMMARY] 配图 ${withImage}/${total} · ${Math.floor(totalMs / 60000)}m${Math.floor((totalMs % 60000) / 1000)}s (${totalMs}ms) · comic=${gen.comicId}`;
  console.log("\n" + line);

  const reportDir = resolve(process.cwd(), "qa-output", "comic-32-panels");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, "REPORT.md");
  const block = `# 漫画 32 格配图长测

更新时间：${new Date().toISOString()}

- 分镜: ${gen.storySec}s · ${gen.pageCount} 页 / ${gen.panelCount} 格
- ${line}
- 通过标准: withImage === total (${withImage === total ? "PASS" : "PARTIAL"})
`;
  writeFileSync(reportPath, block, "utf8");

  const memoryPath = resolve(process.cwd(), "PROJECT_MEMORY/COMIC_32_PANEL_LONGTEST.md");
  try {
    appendFileSync(memoryPath, `\n## ${new Date().toISOString()}\n- 分镜: ${gen.storySec}s · ${gen.pageCount} 页\n- ${line}\n`, "utf8");
  } catch {
    writeFileSync(memoryPath, `# 漫画 32 格配图长测\n${block}`, "utf8");
  }

  if (withImage < total) {
    console.error(`[FAIL] 配图未完成 ${withImage}/${total}`);
    try {
      const row = await longFetch(`${base}/api/comic/${gen.comicId}`, { headers: { Cookie: cookie } });
      if (row.ok) {
        const data = await row.json();
        const missing = (data.panelsWithImage != null)
          ? `panelsWithImage=${data.panelsWithImage}/${data.panelCount ?? total}`
          : "";
        console.error(`[diag] comic status=${data.status ?? "?"} ${missing}`);
      }
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
  console.log("[OK] qa:comic-32-panels");
}

main().catch((e) => {
  console.error("[FAIL]", e.message ?? e);
  process.exit(1);
});
