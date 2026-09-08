import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto("https://operone.1oneclaw.com/zh-Hans", { waitUntil: "networkidle", timeout: 45_000 });
    const chunks = await page.locator("script[src]").evaluateAll(nodes => nodes.map(n => (n as HTMLScriptElement).src));
    for (const chunk of chunks) assert.equal((await page.request.get(chunk)).status(), 200, chunk);
    await fs.mkdir("qa-output/runtime-site", { recursive: true });
    await page.screenshot({ path: "qa-output/runtime-site/home.png", fullPage: true });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ title: await page.title(), chunks: chunks.length, errors }));
  } finally { await browser.close(); }
}
void main();
