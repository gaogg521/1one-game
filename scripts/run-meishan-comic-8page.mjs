/**
 * 《煤山崇祯》8 页漫画：分镜 SSE + 配图 SSE（需 8888 + API keys）
 * node scripts/run-meishan-comic-8page.mjs [--content-only|--novel]
 * 默认 --content-only（与 qa:comic-32-panels 同源，轻量分镜更稳）
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
process.env.UNDICI_HEADERS_TIMEOUT = "0";
process.env.UNDICI_BODY_TIMEOUT = "0";

const base = process.env.BENCHMARK_BASE_URL ?? "http://127.0.0.1:8888";
const arg = process.argv[2]?.trim();
const useNovel = arg === "--novel" || process.env.MEISHAN_USE_NOVEL === "1";
const defaultOwnerKey = process.env.MEISHAN_OWNER_KEY ?? "meishan-8page";
const maxPanelPasses = Math.min(6, Math.max(1, Number.parseInt(process.env.MEISHAN_MAX_PASSES ?? "4", 10) || 4));
const resumeComicId = process.env.MEISHAN_RESUME_COMIC_ID?.trim();

const MEISHAN_SNIPPET = `崇祯十七年三月，煤山风紧。宫中余烬未冷，城外炮声已近。
李自成大军围德胜门，守军士气涣散。崇祯召群臣于乾清宫，问策无人敢言。
夜半，王承恩随驾出玄武门，往煤山。帝着素衣，步上歪脖老树，回望紫禁城灯火渐稀。
「诸君误朕，朕非亡国之君。」史家谓之：君王死社稷。`;

function parseSse(text) {
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

async function readSse(res, onEvent) {
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
      for (const ev of parseSse(chunk + "\n\n")) onEvent(ev);
    }
  }
}

async function resolveNovelSource() {
  if (!useNovel) return null;
  const novelId = arg && arg !== "--novel" && arg !== "--content-only" ? arg : undefined;
  try {
    const { prisma } = await import("../src/lib/prisma.ts");
    const row = novelId
      ? await prisma.novel.findUnique({
          where: { id: novelId },
          select: { id: true, title: true, ownerKey: true },
        })
      : await prisma.novel.findFirst({
          where: { OR: [{ title: { contains: "煤山" } }, { title: { contains: "崇祯" } }] },
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, ownerKey: true },
        });
    await prisma.$disconnect();
    if (row) {
      console.log(`[info] 使用小说: ${row.title} (${row.id})`);
      return row;
    }
  } catch (e) {
    console.warn("[warn] 查库失败，改用 content 模式:", e instanceof Error ? e.message : e);
  }
  return null;
}

function ownerCookie(ownerKey) {
  return `gcreator_owner=${ownerKey}`;
}

async function streamGenerate(body, sessionCookie) {
  const genRes = await fetch(`${base}/api/comic/generate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify(body),
  });
  if (!genRes.ok) throw new Error(`generate ${genRes.status}: ${await genRes.text()}`);

  let comicId = null;
  let panelCount = 0;
  let pageCount = 0;
  let lastError = null;

  await readSse(genRes, (ev) => {
    if (ev.step === "ping") return;
    if (ev.step === "error" || ev.ok === false) {
      lastError = ev.message ?? "分镜失败";
      return;
    }
    if (ev.message) console.log(`  [gen] ${ev.step ?? "?"} · ${ev.message}`);
    if (ev.step === "done" && ev.comic?.id) {
      comicId = ev.comic.id;
      panelCount = ev.panelCount ?? 0;
      pageCount = ev.pageCount ?? 0;
      console.log(`  分镜完成 · ${pageCount} 页 / ${panelCount} 格 · id=${comicId}`);
    }
  });

  if (lastError) throw new Error(lastError);
  if (!comicId) throw new Error("未返回 comic.id");
  return { comicId, panelCount, pageCount };
}

async function streamPanelsUntilComplete(comicId, expectedTotal, sessionCookie) {
  let lastWithImage = 0;
  for (let pass = 1; pass <= maxPanelPasses; pass++) {
    console.log(`[2/${pass}] 配图 SSE（第 ${pass}/${maxPanelPasses} 轮）…`);
    const panelRes = await fetch(`${base}/api/comic/${comicId}/panels/stream`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });
    if (!panelRes.ok) throw new Error(`panels ${panelRes.status}: ${await panelRes.text()}`);

    let lastError = null;
    await readSse(panelRes, (ev) => {
      if (ev.type === "error") lastError = ev.error ?? "配图失败";
      if (ev.type === "panel_done" && ev.ok) process.stdout.write(".");
      if (ev.type === "done") {
        lastWithImage = ev.withImage ?? 0;
        console.log(`\n  本轮 ${lastWithImage}/${expectedTotal}`);
      }
    });
    if (lastError) throw new Error(lastError);
    if (lastWithImage >= expectedTotal) break;
  }
  return lastWithImage;
}

async function main() {
  const health = await fetch(`${base}/api/health`);
  if (!health.ok) throw new Error(`health ${health.status}`);

  const novel = await resolveNovelSource();
  const sessionCookie = ownerCookie(novel?.ownerKey ?? defaultOwnerKey);

  let comicId;
  let panelCount;
  if (resumeComicId) {
    console.log(`[skip] 续跑配图 comic=${resumeComicId}`);
    comicId = resumeComicId;
    panelCount = Number.parseInt(process.env.MEISHAN_EXPECTED_PANELS ?? "64", 10) || 64;
  } else {
    const body = {
      pageCount: 8,
      lengthTier: "medium",
      title: "穿越到煤山的崇祯帝 · 8页版",
      ...(novel
        ? { novelId: novel.id }
        : { content: MEISHAN_SNIPPET.repeat(4) }),
    };
    console.log(`[1/2] 分镜 8 页 · mode=${novel ? "novel" : "content"}`);
    const gen = await streamGenerate(body, sessionCookie);
    comicId = gen.comicId;
    panelCount = gen.panelCount;
  }

  const withImage = await streamPanelsUntilComplete(comicId, panelCount, sessionCookie);

  const reportDir = resolve(process.cwd(), "qa-output", "meishan-comic-8page");
  mkdirSync(reportDir, { recursive: true });
  const line = `novel=${novel?.id ?? "content"} comic=${comicId} panels=${withImage}/${panelCount}`;
  writeFileSync(
    resolve(reportDir, "REPORT.md"),
    `# 煤山崇祯 8 页漫画\n\n- ${new Date().toISOString()}\n- mode: ${novel ? "novel" : "content"}\n- ${line}\n- 试玩: ${base}/comic/${comicId}\n- PASS: ${withImage >= panelCount ? "yes" : "partial"}\n`,
    "utf8",
  );
  console.log(`\n[SUMMARY] ${line}`);
  if (withImage < panelCount) process.exit(1);
  console.log("[OK] meishan-comic-8page");
}

main().catch((e) => {
  console.error("[FAIL]", e.message ?? e);
  process.exit(1);
});
