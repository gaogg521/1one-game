/**
 * PM / 用户主路径 parity（离线）
 * 把「17/17 截图对标」翻译成用户能感知、能验收的故事。
 *
 * npm run qa:user-journey-parity
 */
import fs from "node:fs";
import path from "node:path";
import { SAMPLES } from "../src/lib/samples";
import { buildCanonicalAstrocadeSpec } from "../src/lib/astrocade-canonical-spec";
import { prepareGameSpecForPersist } from "../src/lib/spec-patch";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { buildCreatePrefillPath, decodeCreatePrefillParam } from "../src/lib/sample-create-prefill";
import { resolveSampleParityUserInfo } from "../src/lib/sample-parity-user";
import { expectedPhaserSceneName } from "../src/lib/game-templates/runtime";
import { inferSampleIdFromPrompt } from "../src/lib/sample-play-profiles/apply";

const OUT = path.join(process.cwd(), "qa-output", "user-journey-parity");

type Row = { story: string; sampleId: string; ok: boolean; detail: string };

function main() {
  const rows: Row[] = [];
  const failures: string[] = [];

  console.log("\n# qa:user-journey-parity — PM / 用户主路径\n");

  // Story 1：用户复制样品 prompt 创作 → 应看到「同款体验」
  for (const s of SAMPLES) {
    const userSpec = prepareGameSpecForPersist(mockSpecFromPrompt(s.prompt), s.prompt, "zh-Hans");
    const sampleSpec = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", { sampleId: s.id });
    const info = resolveSampleParityUserInfo(userSpec, s.prompt);
    const sceneMatch = expectedPhaserSceneName(userSpec) === expectedPhaserSceneName(sampleSpec);
    const ok =
      Boolean(info?.promptAligned) &&
      info?.sampleTitle === s.title &&
      userSpec.samplePlayProfile?.variantId === s.id &&
      sceneMatch;
    rows.push({
      story: "同 prompt 创作 = 样品同款",
      sampleId: s.id,
      ok,
      detail: ok ? info!.sceneName : `profile=${userSpec.samplePlayProfile?.variantId} scene=${sceneMatch}`,
    });
    if (!ok) failures.push(`story1 ${s.id}`);
    console.log(`[${ok ? "OK" : "FAIL"}] story1 ${s.id} · ${info?.sceneName ?? "?"}`);
  }

  // Story 2：克隆继承 profile（结构断言，视觉由 competitor-parity 覆盖）
  for (const s of SAMPLES.slice(0, 5)) {
    const enriched = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", { sampleId: s.id });
    const cloned = structuredClone(enriched);
    const replay = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", {
      persistedSpec: cloned,
      projectId: "user-clone-test",
    });
    const ok = replay.samplePlayProfile?.variantId === s.id;
    rows.push({
      story: "克隆保留 polish",
      sampleId: s.id,
      ok,
      detail: replay.samplePlayProfile?.variantId ?? "missing",
    });
    if (!ok) failures.push(`story2 ${s.id}`);
  }

  // Story 3：非样品 prompt 不应误标「同款」（无 variant 或 prompt 不对齐）
  const genericPrompt = "做一个简单的接球小游戏，左右移动挡板弹球";
  const genericSpec = prepareGameSpecForPersist(mockSpecFromPrompt(genericPrompt), genericPrompt, "zh-Hans");
  const genericInfo = resolveSampleParityUserInfo(genericSpec, genericPrompt);
  const genericOk = !genericInfo?.promptAligned && inferSampleIdFromPrompt(genericPrompt) === undefined;
  rows.push({
    story: "非样品 prompt 不误标",
    sampleId: "(generic)",
    ok: genericOk,
    detail: genericInfo ? `variant=${genericInfo.variantId}` : "no profile",
  });
  if (!genericOk) failures.push("story3 generic");

  console.log(`\n[${genericOk ? "OK" : "FAIL"}] story3 非样品 prompt 不误标同款`);

  // Story 4：样品馆「用此 prompt 创作」深链 → 创作台 prefill 可还原
  for (const s of SAMPLES.slice(0, 3)) {
    const path = buildCreatePrefillPath(s.prompt);
    const q = path.split("?")[1] ?? "";
    const params = new URLSearchParams(q);
    const decoded = decodeCreatePrefillParam(params.get("prefill") ?? "");
    const ok = decoded.trim() === s.prompt.trim();
    rows.push({
      story: "样品馆 prefill 深链",
      sampleId: s.id,
      ok,
      detail: ok ? "roundtrip ok" : `len ${decoded.length} vs ${s.prompt.length}`,
    });
    if (!ok) failures.push(`story4 ${s.id}`);
    console.log(`[${ok ? "OK" : "FAIL"}] story4 prefill ${s.id}`);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const summary = {
    at: new Date().toISOString(),
    stories: [
      "用户复制样品 prompt → 创作/试玩与 demo 同款",
      "用户克隆样品 → 继承 polish，试玩一致",
      "用户自由 prompt → 不虚假承诺「同款」",
      "样品馆「用此 prompt 创作」→ 创作台 prefill 深链可还原",
    ],
    story1Ok: rows.filter((r) => r.story === "同 prompt 创作 = 样品同款" && r.ok).length,
    story1Total: SAMPLES.length,
    pass: failures.length === 0,
    failures,
    rows,
  };
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# 用户 / PM 主路径 parity",
    "",
    `生成时间：${summary.at}`,
    "",
    "## 用户故事（产品验收口径）",
    "",
    ...summary.stories.map((s, i) => `${i + 1}. ${s}`),
    "",
    "## 结果",
    "",
    `- 同 prompt 创作：**${summary.story1Ok}/${summary.story1Total}**`,
    `- 克隆 profile：抽检 5/5 结构`,
    `- 非样品不误标：**${genericOk ? "通过" : "失败"}**`,
    "",
    "## 用户可见兑现",
    "",
    "- 试玩页 / 创作预览：`SampleParityTrustBadge` 告知「与样品馆同款」",
    "- 样品馆卡片 / 试玩页：`用此 prompt 创作` → `/create?prefill=`",
    "- 创作台：识别样品 prompt 时显示同款预期 + 生成中文案",
    "- 结果页：`ResultMomentBanner` 同款标题（同 prompt 路径）",
    "- 引擎加载：`gamePlayer.loading` 遮罩至 `__PHASER_PLAY_READY__`，避免闪屏",
    "",
    failures.length ? `## 失败\n\n${failures.map((f) => `- ${f}`).join("\n")}` : "## 状态\n\n全部通过",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "REPORT.md"), md, "utf8");

  console.log(`\n报告：${path.relative(process.cwd(), path.join(OUT, "REPORT.md"))}`);

  if (failures.length) {
    console.error(`[FAIL] ${failures.length} 条`);
    process.exit(1);
  }
  console.log("[OK] qa:user-journey-parity");
}

main();
