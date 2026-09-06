/**
 * Repoints scene model routes, but only after proving each model actually
 * answers on the gateway.
 *
 * This guard exists because the previously configured image model
 * (doubao-seedream-5-0-pro) was listed by /v1/models yet returned 404 on every
 * endpoint, and the failure surfaced only as silently degraded art.
 */
import "dotenv/config";
import { getRuntimeConfigPublicView, loadRuntimeConfig, saveRuntimeConfig } from "../src/lib/runtime-config";

const PRIMARY = process.env.FIX_TEXT_PRIMARY || "minimax-2-7";
const FALLBACK = process.env.FIX_TEXT_FALLBACK || "glm-latest";
/** Scenes that generate text/JSON for the game and literary lines. */
const TEXT_SCENES = ["game_text", "game_vision", "game_bgm", "novel", "novel_plan", "comic_storyboard"];

async function probeModel(base: string, key: string, model: string): Promise<{ ok: boolean; detail: string }> {
  const url = `${base}${base.endsWith("/v1") ? "" : "/v1"}/chat/completions`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      // Reasoning models spend budget on reasoning_content before emitting
      // content at all, so a small cap makes a healthy model look dead.
      body: JSON.stringify({ model, messages: [{ role: "user", content: 'Reply with JSON only: {"ok":true}' }], max_tokens: 2048 }),
      signal: AbortSignal.timeout(120000),
    });
    const text = await res.text();
    const ms = Date.now() - t0;
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status} (${ms}ms) ${text.slice(0, 160).replace(/\s+/g, " ")}` };
    const json = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";
    return { ok: content.trim().length > 0, detail: `HTTP 200 (${ms}ms) content=${JSON.stringify(content.slice(0, 60))}` };
  } catch (e) {
    return { ok: false, detail: `THREW (${Date.now() - t0}ms) ${(e as Error).message.slice(0, 140)}` };
  }
}

async function main() {
  await loadRuntimeConfig();
  const base = (process.env.OPENAI_BASE_URL || "").replace(/\/$/, "");
  const key = process.env.OPENAI_API_KEY || "";

  console.log("=== probing models before writing any config ===");
  const results = await Promise.all([PRIMARY, FALLBACK].map(async (m) => ({ model: m, ...(await probeModel(base, key, m)) })));
  for (const r of results) console.log(`  ${r.model.padEnd(20)} ${r.ok ? "OK  " : "FAIL"} ${r.detail}`);
  const broken = results.filter((r) => !r.ok);
  if (broken.length) {
    console.error(`\n[abort] ${broken.map((b) => b.model).join(", ")} did not answer — refusing to write a route that would silently degrade output.`);
    process.exit(1);
  }

  const before = await getRuntimeConfigPublicView();
  const routes = before.routes.map((r) => ({ scene: r.scene, providerId: r.providerId, primary: r.primary, fallbacks: r.fallbacks }));
  const changes: string[] = [];
  for (const scene of TEXT_SCENES) {
    const route = routes.find((r) => r.scene === scene);
    if (!route) { console.log(`  (skip) no route configured for ${scene}`); continue; }
    if (route.primary === PRIMARY && route.fallbacks.join(",") === FALLBACK) continue;
    changes.push(`${scene}: ${route.primary} [${route.fallbacks.join(",")}] -> ${PRIMARY} [${FALLBACK}]`);
    route.primary = PRIMARY;
    route.fallbacks = [FALLBACK];
  }

  if (!changes.length) { console.log("\n[ok] routes already correct, nothing written"); return; }
  console.log("\n=== applying ===");
  for (const c of changes) console.log("  " + c);
  const after = await saveRuntimeConfig({ routes }, before.updatedByUserId ?? null);
  console.log("\n=== persisted ===");
  for (const scene of TEXT_SCENES) {
    const r = after.routes.find((x) => x.scene === scene);
    if (r) console.log(`  ${scene.padEnd(18)} ${r.primary} [${r.fallbacks.join(",")}]`);
  }
}
main().catch((e) => { console.error("FATAL", e?.message || e); process.exit(1); });
