/**
 * /en/ path acceptance: static HTML + selected API responses must not leak CJK UI copy.
 * Run with dev server on 8888: npx tsx scripts/qa-en-path-acceptance.ts
 */
import assert from "node:assert/strict";
import { QA_EN_FIXTURE } from "./qa-en-fixture-ids";

const base = process.env.BENCHMARK_BASE_URL ?? "http://127.0.0.1:8888";
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

const PAGE_ROUTES = [
  "/en",
  "/en/novel/create",
  "/en/novels",
  "/en/novel/discover",
  "/en/create",
  "/en/comic/create",
  "/en/studio",
  "/en/games",
  "/en/comics",
  "/en/discover",
  "/en/start",
  "/en/samples",
  "/en/login",
  "/en/comic/discover",
  "/en/billing",
] as const;

/** zh-Hans UI copy that must never appear on /en/ chrome (user DB titles may still contain CJK). */
const FORBIDDEN_UI_STRINGS = [
  "游戏平台",
  "短篇",
  "中篇",
  "长篇",
  "查看全部",
  "社区热门游戏",
  "社区热门小说",
  "社区热门漫画",
  "开始创作",
  "浏览社区",
  "创作台",
  "简体中文",
  "章节目录",
  "听书",
  "继续朗读",
  "上一章",
  "下一章",
  "登录 Operone",
  "开发登录",
  "退出登录",
  "游戏发现",
  "小说发现",
  "动漫发现",
  "套餐与额度",
  "小说不存在",
  "编辑正文",
  "生成漫画",
  "漫画不存在",
] as const;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findForbiddenUi(text: string): string[] {
  return FORBIDDEN_UI_STRINGS.filter((s) => text.includes(s));
}

async function checkFixtureDetailPages(): Promise<void> {
  const routes = [
    [`/en/novel/${QA_EN_FIXTURE.novelId}`, "novel"],
    [`/en/play/${QA_EN_FIXTURE.projectId}`, "project"],
    [`/en/comic/${QA_EN_FIXTURE.comicId}`, "comic"],
  ] as const;

  for (const [route, kind] of routes) {
    const probe = await fetch(`${base}${route}`, {
      headers: { "accept-language": "en", "x-app-locale": "en" },
      redirect: "follow",
    });
    if (probe.status === 404) {
      console.log(`SKIP page ${route} (fixture ${kind} missing — run qa:seed-en-fixtures)`);
      continue;
    }
    await checkPage(route);
  }
}

async function resolvePublicProjectId(): Promise<string | null> {
  const res = await fetch(`${base}/api/discover?limit=1&sort=playCount`, {
    headers: { "accept-language": "en", "x-app-locale": "en" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { projects?: Array<{ id: string }> };
  return json.projects?.[0]?.id ?? null;
}

async function resolvePublicComicId(): Promise<string | null> {
  const res = await fetch(`${base}/api/comic?limit=1&sort=playCount`, {
    headers: { "accept-language": "en", "x-app-locale": "en" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { comics?: Array<{ id: string }> };
  return json.comics?.[0]?.id ?? null;
}

async function resolvePublicNovelId(): Promise<string | null> {
  const res = await fetch(`${base}/api/novel?limit=1&sort=playCount`, {
    headers: { "accept-language": "en", "x-app-locale": "en" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { novels?: Array<{ id: string }> };
  return json.novels?.[0]?.id ?? null;
}

async function checkPage(route: string): Promise<void> {
  const res = await fetch(`${base}${route}`, {
    headers: { "accept-language": "en", "x-app-locale": "en" },
    redirect: "follow",
  });
  assert.equal(res.status, 200, `${route} should return 200, got ${res.status}`);
  const html = await res.text();
  assert.match(html, /lang="en"/i, `${route} html lang should be en`);
  const text = stripHtml(html);
  const forbidden = findForbiddenUi(text);
  assert.equal(forbidden.length, 0, `${route} leaked zh-Hans UI: ${forbidden.join(" | ")}`);
  console.log(`OK page ${route}`);
}

async function checkTtsApi(): Promise<void> {
  const res = await fetch(`${base}/api/novel/tts`, {
    headers: { "x-app-locale": "en", "accept-language": "en" },
  });
  assert.equal(res.status, 200);
  const json = (await res.json()) as {
    voices?: Array<{ id: string; label: string }>;
    voiceLabel?: string | null;
  };
  const labels = [
    ...(json.voices ?? []).map((v) => v.label),
    ...(json.voiceLabel ? [json.voiceLabel] : []),
  ];
  for (const label of labels) {
    assert.doesNotMatch(label, CJK_RE, `TTS voice label should be English: ${label}`);
  }
  if (json.voices?.length) {
    assert.match(json.voices[0]!.label, /[A-Za-z]/, "expected English voice label");
  }
  console.log("OK api /api/novel/tts (en)");
}

async function checkLocalizedApiError(): Promise<void> {
  const res = await fetch(`${base}/api/novel/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-app-locale": "en",
    },
    body: JSON.stringify({}),
  });
  const json = (await res.json()) as { error?: string };
  assert.ok(json.error, "expected localized error body");
  assert.doesNotMatch(json.error, CJK_RE, `API error should be English: ${json.error}`);
  console.log(`OK api error sample: ${json.error.slice(0, 60)}…`);
}

async function main(): Promise<void> {
  for (const route of PAGE_ROUTES) {
    await checkPage(route);
  }

  await checkFixtureDetailPages();

  const novelId = await resolvePublicNovelId();
  if (novelId && novelId !== QA_EN_FIXTURE.novelId) {
    await checkPage(`/en/novel/${novelId}`);
  }

  const projectId = await resolvePublicProjectId();
  if (projectId && projectId !== QA_EN_FIXTURE.projectId) {
    await checkPage(`/en/play/${projectId}`);
  }

  const comicId = await resolvePublicComicId();
  if (comicId && comicId !== QA_EN_FIXTURE.comicId) {
    await checkPage(`/en/comic/${comicId}`);
  }

  await checkTtsApi();
  await checkLocalizedApiError();
  console.log("qa-en-path-acceptance: ok");
}

main().catch((e) => {
  console.error("[FAIL]", e instanceof Error ? e.message : e);
  process.exit(1);
});
