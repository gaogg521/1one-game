/**
 * Capability report: resolves every configured scene model to its protocol
 * adapter and, with --live, actually calls the gateway to prove the pairing
 * works.
 *
 * This exists because the two worst failures in this pipeline were both
 * "configured model that cannot actually be called": an image model that 404s
 * on the endpoint the code used, and a text model whose reply came back empty
 * because reasoning consumed the token budget. Both degraded output silently.
 *
 *   npx tsx scripts/qa-model-adapters.ts            # offline: routing + coverage
 *   npx tsx scripts/qa-model-adapters.ts --live     # also calls each model once
 */
import "dotenv/config";
import fs from "node:fs";
import { describeRegistry, resolveAdapter } from "../src/lib/model-adapters/registry";
import type { Modality } from "../src/lib/model-adapters/types";

const LIVE = process.argv.includes("--live");

/** Local debug credentials, deliberately not the database/production ones. */
function localCreds(): { baseUrl: string; apiKey: string } {
  if (fs.existsSync("key.txt")) {
    const [url, key] = fs.readFileSync("key.txt", "utf8").trim().split(/\r?\n/);
    if (url && key) return { baseUrl: url.trim().replace(/\/+$/, ""), apiKey: key.trim() };
  }
  return { baseUrl: (process.env.OPENAI_BASE_URL ?? "").replace(/\/+$/, ""), apiKey: process.env.OPENAI_API_KEY ?? "" };
}

const PROBES: Array<{ modality: Modality; model: string; prompt: string; size?: string }> = [
  { modality: "image", model: "doubao-seedream-5-0-pro", prompt: "a round green slime creature, flat vector game sprite, plain dark background", size: "1K" },
  { modality: "image", model: "gpt-image-2", prompt: "a round green slime creature, flat vector game sprite, plain dark background", size: "1024x1024" },
  { modality: "image", model: "gemini-3.1-flash-image-preview", prompt: "a round green slime creature, flat vector game sprite, plain dark background" },
  { modality: "text", model: "minimax-2-7", prompt: 'Reply with JSON only: {"ok":true}' },
  { modality: "text", model: "glm-latest", prompt: 'Reply with JSON only: {"ok":true}' },
  { modality: "tts", model: "BV701_streaming", prompt: "这是一段测试语音。" },
];

async function main() {
  console.log("=== registry ===");
  for (const row of describeRegistry()) {
    console.log(`  ${row.modality.padEnd(6)} ${row.adapter.padEnd(24)} ${row.protocol}`);
  }

  console.log("\n=== model → adapter resolution ===");
  let unresolved = 0;
  for (const p of PROBES) {
    const adapter = resolveAdapter(p.modality, p.model);
    if (!adapter) unresolved += 1;
    console.log(`  ${p.modality.padEnd(6)} ${p.model.padEnd(32)} -> ${adapter ? adapter.id : "(NO ADAPTER)"}`);
  }
  if (unresolved) console.log(`\n  ${unresolved} model(s) have no adapter — they would fall back to a wrong protocol.`);

  if (!LIVE) {
    console.log("\n[OK] offline check complete. Re-run with --live to call the gateway.");
    return;
  }

  const { baseUrl, apiKey } = localCreds();
  if (!baseUrl || !apiKey) { console.error("[FAIL] no local credentials (key.txt or OPENAI_* env)"); process.exit(1); }
  console.log(`\n=== live calls against ${baseUrl} ===`);

  const results: Array<{ label: string; ok: boolean; detail: string }> = [];
  for (const p of PROBES) {
    const adapter = resolveAdapter(p.modality, p.model);
    const label = `${p.modality}/${p.model}`;
    if (!adapter) { results.push({ label, ok: false, detail: "no adapter" }); continue; }
    const t0 = Date.now();
    const out = await adapter.invoke(
      { baseUrl, apiKey, model: p.model, timeoutMs: p.modality === "image" ? 240_000 : 90_000 },
      { prompt: p.prompt, size: p.size, maxTokens: 2048 },
    );
    const ms = Date.now() - t0;
    const detail = out.ok
      ? `${ms}ms ${out.media?.url ? `url=${out.media.url.slice(0, 60)}` : out.media?.bytes ? `${out.media.bytes.length}B ${out.media.mimeType}` : `text=${JSON.stringify((out.text ?? "").slice(0, 40))}`}`
      : `${ms}ms ${out.error.slice(0, 150)}`;
    results.push({ label, ok: out.ok, detail });
    console.log(`  ${out.ok ? "OK  " : "FAIL"} ${label.padEnd(44)} ${detail}`);
  }

  const failures = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failures.length}/${results.length} adapters verified live.`);
  if (failures.length) {
    console.log("unverified (each needs a working curl before it can be trusted in a route):");
    for (const f of failures) console.log(`  - ${f.label}: ${f.detail}`);
  }
}

main().catch((e) => { console.error("FATAL", e?.message || e); process.exit(1); });
