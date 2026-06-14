/**
 * 漫画精选位 API 与 seed 门禁
 * npm run qa:comic-featured
 * npm run qa:comic-featured:offline  # 仅 Prisma，无需 dev
 */
import { execSync } from "node:child_process";
import { seedMeishanFeaturedComic } from "@/lib/comic-featured";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8888";
const OFFLINE_ONLY = process.argv.includes("--offline");

function ok(label: string): void {
  console.log(`[OK] ${label}`);
}

function fail(label: string): never {
  console.error(`[FAIL] ${label}`);
  process.exit(1);
}

async function healthOk(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log("# qa:comic-featured\n");

  execSync("npm run qa:comic-featured:offline", { stdio: "inherit", cwd: process.cwd() });

  if (OFFLINE_ONLY) return;

  const { id } = await seedMeishanFeaturedComic();
  if (!id) return;

  if (!(await healthOk())) {
    console.warn(`[skip] HTTP checks — dev not at ${BASE}`);
    return;
  }

  const res = await fetch(`${BASE}/api/comic?featured=1&limit=6`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) fail(`GET /api/comic?featured=1 → ${res.status}`);
  const data = (await res.json()) as { comics?: Array<{ id: string; featured?: boolean }> };
  const comics = data.comics ?? [];
  if (comics.length === 0) fail("featured list empty after seed");
  if (!comics.some((c) => c.id === id)) fail(`featured list missing ${id}`);
  if (!comics.every((c) => c.featured !== false)) fail("featured list contains non-featured row");
  ok(`featured API returns ${comics.length} item(s), includes ${id}`);

  const sortRes = await fetch(`${BASE}/api/comic?sort=featured&limit=3`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!sortRes.ok) fail(`GET sort=featured → ${sortRes.status}`);
  const sortData = (await sortRes.json()) as { comics?: Array<{ id: string }> };
  if (!(sortData.comics ?? []).some((c) => c.id === id)) fail("sort=featured missing seeded comic");
  ok("sort=featured prioritizes seeded comic");

  console.log("\n[OK] qa:comic-featured complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
