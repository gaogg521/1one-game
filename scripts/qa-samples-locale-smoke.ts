/**
 * Smoke: sample gallery works across locales (API + message keys).
 * Usage: tsx scripts/qa-samples-locale-smoke.ts [baseUrl]
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { locales, type AppLocale } from "../src/i18n/routing";
import { sampleProjectId } from "../src/lib/sample-gallery";

const base = process.argv[2] ?? "http://127.0.0.1:8888";

function messages(locale: AppLocale): Record<string, unknown> {
  return JSON.parse(readFileSync(join(process.cwd(), "src/messages", `${locale}.json`), "utf8")) as Record<
    string,
    unknown
  >;
}

async function main(): Promise<void> {
  for (const locale of locales) {
    const samples = messages(locale).samples as Record<string, string>;
    assert.ok(samples.desc?.length > 20, `${locale} samples.desc missing`);
    const expectedClone =
      locale === "zh-Hans" || locale === "zh-Hant"
        ? "克隆"
        : locale === "th"
          ? "โคลน"
          : locale === "ms"
            ? "Klon"
            : "Clone";
    assert.equal(samples.clone, expectedClone, `${locale} samples.clone`);
    const playGame = messages(locale).playGame as Record<string, string>;
    assert.ok(playGame.favorite, `${locale} playGame.favorite`);
    assert.ok(playGame.cloneToMine, `${locale} playGame.cloneToMine`);
    assert.ok(playGame.samplePlayHint, `${locale} playGame.samplePlayHint`);
  }
  console.log("[OK] message keys for locales:", locales.join(", "));

  const ensure = await fetch(`${base}/api/samples/ensure`, {
    method: "POST",
    headers: { "Accept-Language": "en" },
  });
  assert.equal(ensure.status, 200, `ensure HTTP ${ensure.status}`);
  const ensureBody = (await ensure.json()) as { ids?: string[] };
  assert.ok(Array.isArray(ensureBody.ids) && ensureBody.ids.length >= 14, "ensure ids");
  console.log("[OK] POST /api/samples/ensure", ensureBody.ids?.length, "projects");

  const projectId = sampleProjectId("smash-the-dummy");
  for (const locale of locales) {
    const res = await fetch(`${base}/api/projects/${projectId}`, {
      headers: { "Accept-Language": locale },
    });
    assert.equal(res.status, 200, `${locale} project GET ${res.status}`);
    const data = (await res.json()) as { project?: { isSampleGallery?: boolean }; spec?: unknown };
    assert.ok(data.spec, `${locale} missing spec`);
    assert.equal(data.project?.isSampleGallery, true, `${locale} isSampleGallery`);
    console.log(`[OK] ${locale} GET /api/projects/${projectId}`);
  }

  for (const locale of locales) {
    const page = await fetch(`${base}/${locale}/samples`, { redirect: "follow" });
    assert.ok(page.ok, `${locale} /samples HTTP ${page.status}`);
    const html = await page.text();
    assert.ok(html.includes("Sample gallery") || html.includes("样品馆") || html.includes("樣品館"), `${locale} samples page title`);
    console.log(`[OK] ${locale} page /${locale}/samples`);
  }

  console.log("qa-samples-locale-smoke: all passed");
}

main().catch((e) => {
  console.error("[FAIL]", e instanceof Error ? e.message : e);
  process.exit(1);
});
