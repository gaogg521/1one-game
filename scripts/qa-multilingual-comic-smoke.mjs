/**
 * 多语言小说 → 漫画分镜 smoke（需 dev + LLM，每语种约 5–15 分钟）
 * 用法：
 *   node scripts/qa-multilingual-comic-smoke.mjs           # 跑 ms + th + zh-Hant
 *   node scripts/qa-multilingual-comic-smoke.mjs ms        # 只跑马来
 *   node scripts/qa-multilingual-comic-smoke.mjs all       # 含英文共 4 语种
 */
import { config } from "dotenv";
import http from "node:http";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const baseUrl = new URL(process.env.BENCHMARK_BASE_URL ?? "http://localhost:8888");
const ownerCookie = "gcreator_owner=anon";
const TIMEOUT_MS = 1_800_000;

const ALL_CASES = [
  {
    label: "en",
    novelId: "cmq5yjms00002lzrm9pd8w3l2",
    expectPipeline: "light",
    captionHint: /[a-zA-Z]{4,}/,
  },
  {
    label: "ms",
    novelId: "cmq604sfe0005lzrmylmmd0zw",
    expectPipeline: "light",
    captionHint: /\b(yang|dan|dengan|dia|tidak|saya|kami|Jinyiwei|malam|pintu|pedang)\b/i,
  },
  {
    label: "th",
    novelId: "cmq5zkzt10003lzrm52bjn0f3",
    expectPipeline: "light",
    captionHint: /[\u0E00-\u0E7F]{2,}/,
  },
  {
    label: "zh-Hant",
    novelId: "cmq604ju70004lzrmhvyt1gii",
    expectPipeline: null,
    captionHint: /[請這為開關說與時裡後來對於實際無響應讓國義經發現愛廣東雲氣電錦衣衛衛隊]/,
  },
];

function pickCases(argv) {
  const arg = (argv[2] ?? "ms,th,zh-Hant").trim();
  if (arg === "all") return ALL_CASES;
  if (arg.includes(",")) {
    const labels = arg.split(",").map((s) => s.trim());
    return ALL_CASES.filter((c) => labels.includes(c.label));
  }
  const one = ALL_CASES.find((c) => c.label === arg || c.novelId === arg);
  if (one) return [one];
  return ALL_CASES.filter((c) => c.label !== "en");
}

function httpJson(method, path, body) {
  return new Promise((resolvePromise, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        protocol: baseUrl.protocol,
        hostname: baseUrl.hostname,
        port: baseUrl.port || (baseUrl.protocol === "https:" ? 443 : 80),
        path,
        method,
        headers: {
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
          Cookie: ownerCookie,
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          buf += chunk;
        });
        res.on("end", () => {
          let data = {};
          try {
            data = JSON.parse(buf);
          } catch {
            /* ignore */
          }
          resolvePromise({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            data,
          });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("request timeout")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function isEmergencyLike(panels) {
  if (!panels?.length) return true;
  const prompts = panels.map((p) => p.prompt ?? "").filter(Boolean);
  if (prompts.length < 2) return false;
  const unique = new Set(prompts);
  return unique.size === 1 && prompts[0].length < 200;
}

async function runCase(c) {
  console.log(`\n=== ${c.label} novel ${c.novelId} ===`);
  const t0 = Date.now();
  const gen = await httpJson("POST", "/api/comic/generate", {
    novelId: c.novelId,
    pageCount: 4,
    lengthTier: "short",
  });
  if (!gen.ok) {
    throw new Error(`generate ${gen.status}: ${JSON.stringify(gen.data)}`);
  }
  const { comic, pipeline, storyboardSource, pageCount, panelCount } = gen.data;
  console.log(
    "OK generate:",
    comic?.id,
    `pipeline=${pipeline}`,
    `storyboard=${storyboardSource}`,
    `${pageCount}p/${panelCount}panels`,
    `${((Date.now() - t0) / 1000).toFixed(0)}s`,
  );
  if (c.expectPipeline && pipeline !== c.expectPipeline) {
    throw new Error(`expected pipeline ${c.expectPipeline}, got ${pipeline}`);
  }
  if (storyboardSource === "emergency") {
    throw new Error("storyboardSource=emergency (static fallback)");
  }

  const detail = await httpJson("GET", `/api/comic/${comic.id}`);
  let doc = { pages: [], layoutId: undefined };
  try {
    doc = JSON.parse(detail.data.comic?.imageUrls ?? "{}");
  } catch {
    /* ignore */
  }
  const panels = [];
  for (const page of doc.pages ?? []) {
    for (const pan of page.panels ?? []) panels.push(pan);
  }
  const captions = panels.map((p) => p.caption ?? "").filter(Boolean);
  console.log("layout:", doc.layoutId, "sample caption:", (captions[0] ?? "").slice(0, 80));
  if (c.captionHint && !c.captionHint.test(captions.join(" "))) {
    throw new Error(`captions do not match ${c.label} locale: ${captions.slice(0, 2).join(" | ")}`);
  }
  if (isEmergencyLike(panels)) {
    throw new Error("panels look like emergency static fallback");
  }
  console.log(`PASS ${c.label} · comic=${comic.id}`);
  return comic.id;
}

async function main() {
  const cases = pickCases(process.argv);
  console.log("Base URL:", baseUrl.origin);
  console.log("Cases:", cases.map((c) => c.label).join(", "));
  for (const c of cases) {
    await runCase(c);
  }
  console.log("\nqa-multilingual-comic-smoke: ok");
}

main().catch((e) => {
  console.error("FAIL:", e.message ?? e);
  process.exit(1);
});
