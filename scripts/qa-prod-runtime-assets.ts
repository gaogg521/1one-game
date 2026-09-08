import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { request } from "playwright";

const base = "https://operone.1oneclaw.com";

function collectUrls(value: unknown, output = new Set<string>()): Set<string> {
  if (typeof value === "string" && /^\/game-(?:bg|sprites)\//.test(value)) output.add(value);
  else if (Array.isArray(value)) for (const item of value) collectUrls(item, output);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectUrls(item, output);
  return output;
}

async function main() {
  if (process.env.QA_PROD_RUNTIME_ASSETS !== "1") throw new Error("Explicit production QA opt-in required");
  const projectId = process.env.QA_PROJECT_ID;
  const statePath = process.env.QA_RESUME_STATE;
  assert.ok(projectId && statePath, "QA_PROJECT_ID and QA_RESUME_STATE are required");
  const context = await request.newContext({ storageState: statePath });
  try {
    const response = await context.get(`${base}/api/projects/${projectId}`);
    assert.equal(response.status(), 200);
    const detail = await response.json() as { core?: { revision?: { artifacts?: Array<{ kind: string; content?: unknown }> } } };
    const manifest = detail.core?.revision?.artifacts?.find(item => item.kind === "asset_manifest")?.content;
    const urls = [...collectUrls(manifest)];
    assert.ok(urls.length > 0, "No runtime asset URLs found");
    const results = [];
    for (const url of urls) {
      const asset = await context.get(`${base}${url}`);
      results.push({ url, status: asset.status(), fallback: asset.headers()["x-operone-asset-fallback"] ?? null });
    }
    assert.ok(results.every(item => item.status === 200), JSON.stringify(results));
    assert.ok(results.every(item => item.fallback === null), JSON.stringify(results));
    await fs.mkdir("qa-output/prod-runtime-assets", { recursive: true });
    await fs.writeFile("qa-output/prod-runtime-assets/REPORT.json", JSON.stringify({ projectId, pass: true, assets: results }, null, 2));
    console.log(JSON.stringify({ projectId, count: results.length, status: "all_200_non_fallback" }));
  } finally {
    await context.dispose();
  }
}

void main();
