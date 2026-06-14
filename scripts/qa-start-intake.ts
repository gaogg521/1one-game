/**
 * /start 统一入口 PM 验收
 * npm run qa:start-intake
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { creationEntryHref, getStarterPrompts, type CreationMode } from "../src/lib/product-ia";
import type { AppLocale } from "../src/i18n/routing";
import { resolveStartIntake } from "../src/lib/start-intake";
import { SAMPLES } from "../src/lib/samples";
import {
  buildStartPrefillPath,
  decodeCreatePrefillParam,
  decodeStartPrefillParam,
} from "../src/lib/sample-create-prefill";

const OUT = path.join(process.cwd(), "qa-output", "start-intake");

const TRUST_I18N_KEYS = [
  "start.sampleMatchTitle",
  "start.sampleMatchBody",
  "samples.startViaIntake",
  "sampleParity.titleSamePrompt",
  "literaryAdaptation.title",
] as const;

const LOCALES = ["en", "zh-Hans", "zh-Hant", "ms", "th"] as const;

function readLocaleJson(locale: string): Record<string, unknown> {
  const p = path.join(process.cwd(), "src", "messages", `${locale}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
}

function getNested(obj: Record<string, unknown>, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function checkTrustI18n(): boolean {
  let ok = true;
  for (const locale of LOCALES) {
    const json = readLocaleJson(locale);
    for (const key of TRUST_I18N_KEYS) {
      const val = getNested(json, key);
      if (typeof val !== "string" || !val.trim()) {
        console.log(`[FAIL] i18n ${locale} missing ${key}`);
        ok = false;
      }
    }
  }
  if (ok) console.log("[OK] 信任条 / start 文案五语种齐全");
  return ok;
}

function checkStarterTriplet(locale: AppLocale, label: string): boolean {
  const starters = getStarterPrompts(locale);
  const modes = starters.slice(0, 3).map((s) => resolveStartIntake(s).mode);
  const expected: CreationMode[] = ["game", "novel", "novel"];
  const ok = modes.length >= 3 && modes.every((m, i) => m === expected[i]);
  console.log(`[${ok ? "OK" : "FAIL"}] ${label} starter → game / novel / novel`);
  return ok;
}

function main() {
  const failures: string[] = [];
  console.log("\n# qa:start-intake — /start 智能分流\n");

  const sample = SAMPLES[0]!;
  const sampleIntake = resolveStartIntake(sample.prompt);
  const okSample =
    sampleIntake.mode === "game" && sampleIntake.hint?.kind === "sample_parity";
  console.log(`[${okSample ? "OK" : "FAIL"}] 样品 prompt → 游戏 + parity 提示`);
  if (!okSample) failures.push("sample→game");

  const novelIntake = resolveStartIntake("写一个三章的武侠短篇小说，要有完整结局");
  const okNovel = novelIntake.mode === "novel";
  console.log(`[${okNovel ? "OK" : "FAIL"}] 小说关键词 → novel`);
  if (!okNovel) failures.push("novel-keywords");

  const comicIntake = resolveStartIntake("把这段故事改成分镜漫画，每页四格");
  const okComic = comicIntake.mode === "comic";
  console.log(`[${okComic ? "OK" : "FAIL"}] 漫画关键词 → comic`);
  if (!okComic) failures.push("comic-keywords");

  const href = creationEntryHref("novel", "煤山崇祯", "zh-Hans");
  const params = new URLSearchParams(href.split("?")[1] ?? "");
  const okPrefill = decodeCreatePrefillParam(params.get("prefill") ?? "") === "煤山崇祯";
  console.log(`[${okPrefill ? "OK" : "FAIL"}] creationEntryHref prefill roundtrip`);
  if (!okPrefill) failures.push("prefill-href");

  const startHref = buildStartPrefillPath("煤山崇祯", "zh-Hans");
  const startParams = new URLSearchParams(startHref.split("?")[1] ?? "");
  const okStartPrefill =
    startHref.includes("/start?prefill=") &&
    decodeStartPrefillParam(startParams.get("prefill") ?? "") === "煤山崇祯";
  console.log(`[${okStartPrefill ? "OK" : "FAIL"}] buildStartPrefillPath roundtrip`);
  if (!okStartPrefill) failures.push("start-prefill-href");

  const sampleStartHref = buildStartPrefillPath(sample.prompt);
  const okSampleStart =
    sampleStartHref.startsWith("/start?prefill=") &&
    decodeStartPrefillParam(new URLSearchParams(sampleStartHref.split("?")[1] ?? "").get("prefill") ?? "") ===
      sample.prompt.slice(0, 4000);
  console.log(`[${okSampleStart ? "OK" : "FAIL"}] 样品 prompt → buildStartPrefillPath`);
  if (!okSampleStart) failures.push("sample-start-href");

  if (!checkTrustI18n()) failures.push("trust-i18n");

  for (const [locale, label] of [
    ["en", "英文"],
    ["zh-Hans", "简体中文"],
    ["zh-Hant", "繁体中文"],
    ["ms", "马来文"],
    ["th", "泰文"],
  ] as const) {
    if (!checkStarterTriplet(locale, label)) failures.push(`${locale}-starters`);
  }

  assert.equal(
    resolveStartIntake("").mode,
    "game",
    "空 prompt 默认游戏（最快 wow）",
  );

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, "REPORT.md"),
    [
      "# /start 统一入口 QA",
      "",
      `- 样品 → 游戏 parity：${okSample ? "通过" : "失败"}`,
      `- 小说/漫画关键词：${okNovel && okComic ? "通过" : "失败"}`,
      `- prefill 深链：${okPrefill ? "通过" : "失败"}`,
      `- /start prefill 深链：${okStartPrefill ? "通过" : "失败"}`,
      `- 样品 → /start 深链：${okSampleStart ? "通过" : "失败"}`,
      `- 信任条 i18n（5 语种）：${failures.includes("trust-i18n") ? "失败" : "通过"}`,
      `- starter 分流（en/zh-Hans/zh-Hant/ms/th）：${failures.some((f) => f.endsWith("-starters")) ? "失败" : "通过"}`,
      "",
    ].join("\n"),
  );

  if (failures.length) {
    console.error(`[FAIL] ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("[OK] qa:start-intake");
}

main();
