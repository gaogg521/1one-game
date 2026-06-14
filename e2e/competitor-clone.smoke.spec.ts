/**
 * 平台架构 E2E：随机抽样品 duplicate → normalize → 专用 Scene + canvas
 * npx playwright test e2e/competitor-clone.smoke.spec.ts
 */
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { SAMPLES } from "@/lib/samples";
import { sampleProjectId } from "@/lib/sample-gallery";
import { buildCanonicalAstrocadeSpec } from "@/lib/astrocade-canonical-spec";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import { shouldUseAgenticRuntime } from "@/lib/agentic/game-module";
import { ensureOwnerSession } from "./helpers/owner";
import { gotoPlay } from "./helpers/play";

function pickCloneSmoke(count: number): typeof SAMPLES {
  const day = process.env.COMPETITOR_PICK_SEED ?? new Date().toISOString().slice(0, 10);
  const seed = createHash("sha256").update(day).digest();
  const scored = SAMPLES.map((s, i) => ({
    s,
    score: seed[i % seed.length]! + seed[(i * 7) % seed.length]!,
  }));
  scored.sort((a, b) => a.score - b.score);
  const picked: typeof SAMPLES = [];
  const usedTemplates = new Set<string>();
  for (const { s } of scored) {
    if (picked.length >= count) break;
    const tid = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", { sampleId: s.id }).templateId;
    if (usedTemplates.has(tid)) continue;
    picked.push(s);
    usedTemplates.add(tid);
  }
  for (const { s } of scored) {
    if (picked.length >= count) break;
    if (picked.some((p) => p.id === s.id)) continue;
    picked.push(s);
  }
  return picked.slice(0, count);
}

const CLONE_SMOKE = pickCloneSmoke(Number(process.env.COMPETITOR_CLONE_PICK ?? "3"));

test.describe.configure({ mode: "serial" });

for (const row of CLONE_SMOKE) {
  test(`随机克隆 ${row.id} → 专用 Scene`, async ({ page }) => {
    const sourceId = sampleProjectId(row.id);
    const titlePart = row.title.split(" ")[0]!;
    await ensureOwnerSession(page);

    const dup = await page.request.post(`/api/projects/${sourceId}/duplicate`);
    expect(dup.ok()).toBeTruthy();
    const { project } = (await dup.json()) as { project?: { id?: string } };
    expect(project?.id).toBeTruthy();

    const get = await page.request.get(`/api/projects/${project!.id}`);
    const body = (await get.json()) as {
      spec?: { templateId?: string; agenticModule?: unknown; samplePlayProfile?: { variantId?: string } };
    };
    expect(body.spec?.agenticModule).toBeFalsy();
    expect(shouldUseAgenticRuntime(body.spec!)).toBe(false);
    expect(expectedPhaserSceneName(body.spec!)).not.toBe("AgenticScene");
    expect(body.spec?.samplePlayProfile?.variantId).toBe(row.id);

    await gotoPlay(page, project!.id!);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(titlePart, { timeout: 20_000 });
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 25_000 });
  });
}
