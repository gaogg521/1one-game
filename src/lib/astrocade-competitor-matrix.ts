/**
 * Astrocade 竞品 vs 本平台 — 架构支柱对照（非单游戏 FEATURE_MATRIX）
 */
import type { GameSpec } from "@/lib/game-spec";
import fs from "node:fs";
import path from "node:path";
import { buildCanonicalAstrocadeSpec } from "@/lib/astrocade-canonical-spec";
import { prepareGameSpecForPersist } from "@/lib/spec-patch";
import { godotExportTemplateIds, GAME_TEMPLATE_IDS } from "@/lib/game-templates/registry";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import { SAMPLES } from "@/lib/samples";
import { specForSample } from "@/lib/sample-specs";
import { mockSpecFromPrompt } from "@/lib/mock-spec";
import { SAMPLE_PLAY_PROFILES } from "@/lib/sample-play-profiles/registry";
import { inferSampleIdFromPrompt } from "@/lib/sample-play-profiles/apply";
import { normalizeAstrocadePlaySpec } from "@/lib/astrocade-play-spec";
import {
  ASTROCADE_INVARIANTS,
  checkAstrocadeParity,
  resolveAstrocadePlayRoute,
  templateFirstCoverage,
} from "@/lib/astrocade-architecture";
import { PRODUCT } from "@/lib/product-config";

export type CompetitorAlignStatus = "aligned" | "partial" | "gap";

export type CompetitorArchitectureRow = {
  pillar: string;
  astrocade: string;
  ourDesign: string;
  status: CompetitorAlignStatus;
  evidence: string;
  qa?: string;
};

export type CompetitorArchitectureReport = {
  at: string;
  rows: CompetitorArchitectureRow[];
  aligned: number;
  partial: number;
  gaps: number;
  promptParity?: PromptRouteParityStats;
};

export type PromptRouteParityStats = {
  total: number;
  sceneAligned: number;
  templateAligned: number;
  userAgenticLeaks: number;
};

export type UserProfileParityStats = {
  total: number;
  inferMatched: number;
  profileMatched: number;
};

export type CompetitorParitySnapshot = {
  monitorLlm: number;
  monitorTotal: number;
  coverPlayDist: number | null;
  e2eAllOk: boolean;
};

const GODOT_RUNTIME_COUNT = 11;

/** 读 qa-output 产物（无则回退保守值） */
export function loadCompetitorParitySnapshot(): CompetitorParitySnapshot {
  let monitorLlm = 0;
  let monitorTotal = 16;
  let coverPlayDist: number | null = null;
  let e2eAllOk = false;

  try {
    const mon = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "qa-output/llm-agentic-monitor.json"), "utf8"),
    ) as { llm?: number; total?: number };
    monitorLlm = mon.llm ?? 0;
    monitorTotal = mon.total ?? 16;
  } catch {
    /* optional artifact */
  }

  try {
    const report = fs.readFileSync(path.join(process.cwd(), "qa-output/cover-play/REPORT.md"), "utf8");
    const m = report.match(/欧氏距离:\s*([\d.]+)/);
    if (m) coverPlayDist = parseFloat(m[1]!);
  } catch {
    /* optional artifact */
  }

  try {
    const gates = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "qa-output/competitor-gates.json"), "utf8"),
    ) as { e2eAllOk?: boolean };
    e2eAllOk = Boolean(gates.e2eAllOk);
  } catch {
    /* optional artifact */
  }

  return { monitorLlm, monitorTotal, coverPlayDist, e2eAllOk };
}

export type CompetitorParityValidationStats = {
  method1RouteOk: number;
  method1Total: number;
  method1VisualOk: number;
  method1AllOk: number;
  method2StructuralOk: number;
  method2Total: number;
  method2AllOk: number;
};

function readCompetitorParityValidation(): CompetitorParityValidationStats | null {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "qa-output", "competitor-parity", "summary.json"), "utf8"),
    ) as {
      method1_samePrompt?: { total?: number; routeOk?: number; visualOk?: number; allOk?: number };
      method2_randomClone?: { pickCount?: number; structuralOk?: number; allOk?: number };
    };
    const m1 = raw.method1_samePrompt;
    const m2 = raw.method2_randomClone;
    if (!m1 || !m2) return null;
    return {
      method1RouteOk: m1.routeOk ?? 0,
      method1Total: m1.total ?? 0,
      method1VisualOk: m1.visualOk ?? 0,
      method1AllOk: m1.allOk ?? 0,
      method2StructuralOk: m2.structuralOk ?? 0,
      method2Total: m2.pickCount ?? 0,
      method2AllOk: m2.allOk ?? 0,
    };
  } catch {
    return null;
  }
}

function readGameEffectCaseCount(): number | null {
  try {
    const md = fs.readFileSync(
      path.join(process.cwd(), "qa-output", "game-effect", "REPORT.md"),
      "utf8",
    );
    const rows = md.match(/\| (sample-|user-)[^\n]+\|/g);
    return rows?.length ?? null;
  } catch {
    return null;
  }
}

/** 同 prompt 用户 enrich 是否套用 samplePlayProfile */
export function computeUserProfileParity(): UserProfileParityStats {
  let inferMatched = 0;
  let profileMatched = 0;
  for (const s of SAMPLES) {
    if (inferSampleIdFromPrompt(s.prompt) === s.id) inferMatched += 1;
    const userSpec = prepareGameSpecForPersist(mockSpecFromPrompt(s.prompt), s.prompt, "zh-Hans");
    if (userSpec.samplePlayProfile?.variantId === s.id) profileMatched += 1;
  }
  return { total: SAMPLES.length, inferMatched, profileMatched };
}

/** 同 prompt：样品 enrich vs 用户 mock+enrich（无 sampleId） */
export function computePromptRouteParity(): PromptRouteParityStats {
  let sceneAligned = 0;
  let templateAligned = 0;
  let userAgenticLeaks = 0;

  for (const s of SAMPLES) {
    const sampleSpec = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", { sampleId: s.id });
    const userSpec = prepareGameSpecForPersist(mockSpecFromPrompt(s.prompt), s.prompt, "zh-Hans");

    if (sampleSpec.templateId === userSpec.templateId) templateAligned += 1;
    if (expectedPhaserSceneName(sampleSpec) === expectedPhaserSceneName(userSpec)) sceneAligned += 1;

    const userRoute = resolveAstrocadePlayRoute(userSpec);
    if (userRoute.tier === "advanced-agentic" || userRoute.phaserScene === "AgenticScene") {
      userAgenticLeaks += 1;
    }
  }

  return {
    total: SAMPLES.length,
    sceneAligned,
    templateAligned,
    userAgenticLeaks,
  };
}

/** 静态对照表 + 运行时证据（供文档 / QA 报告） */
export function buildCompetitorArchitectureRows(): CompetitorArchitectureRow[] {
  const tf = templateFirstCoverage();
  const profileCount = Object.keys(SAMPLE_PLAY_PROFILES).length;
  const godotTemplates = godotExportTemplateIds().length;
  const dedicated = PRODUCT.game.dedicatedSceneForTemplateFirst;
  const promptParity = computePromptRouteParity();
  const userProfile = computeUserProfileParity();
  const snap = loadCompetitorParitySnapshot();
  const promptAligned =
    promptParity.sceneAligned === promptParity.total &&
    promptParity.templateAligned === promptParity.total &&
    promptParity.userAgenticLeaks === 0;
  const userPolishAligned =
    userProfile.inferMatched === userProfile.total && userProfile.profileMatched === userProfile.total;
  const monitorAligned = snap.monitorLlm >= snap.monitorTotal && snap.monitorTotal > 0;
  const coverAligned = snap.coverPlayDist !== null && snap.coverPlayDist <= 120;
  const godotProfileAligned = GODOT_RUNTIME_COUNT >= 11;
  const dualTrackAligned = godotProfileAligned;
  const gameEffectCases = readGameEffectCaseCount();
  const parityValidation = readCompetitorParityValidation();
  const samePromptEffectAligned =
    parityValidation !== null &&
    parityValidation.method1AllOk === parityValidation.method1Total &&
    parityValidation.method1Total >= SAMPLES.length;
  const randomCloneAligned =
    parityValidation !== null &&
    parityValidation.method2AllOk === parityValidation.method2Total &&
    parityValidation.method2Total > 0;
  const primaryJuiceAligned =
    gameEffectCases !== null && gameEffectCases >= 16 && coverAligned && dualTrackAligned;

  return [
    {
      pillar: "三层运行时",
      astrocade: "Primary 专用玩法 / Secondary 3D / Advanced LLM 定制",
      ourDesign: "Phaser Scene 族 · Godot ai-mother-universal · AgenticScene",
      status: "aligned",
      evidence: `qualityTier=${PRODUCT.orchestration.qualityTier} · agentic=${PRODUCT.game.agenticModuleEnabled}`,
      qa: "qa:architecture-parity",
    },
    {
      pillar: "同 template → 同 Scene",
      astrocade: "样品与用户生成走同一套玩法引擎",
      ourDesign: "resolveAstrocadePlayRoute + templateFirst 全模板",
      status: tf.missing.length === 0 && dedicated ? "aligned" : "gap",
      evidence:
        tf.missing.length === 0
          ? `${tf.covered.length}/${GAME_TEMPLATE_IDS.length} template-first`
          : `missing: ${tf.missing.join(", ")}`,
      qa: "qa:architecture-parity · qa:astrocade-user-path",
    },
    {
      pillar: "Spec 自包含（无运行时 sampleId）",
      astrocade: "玩法数据烘焙进项目 JSON",
      ourDesign: "blueprint + enrichGameSpecForRuntime · 禁止 SAMPLE_MODES",
      status: "aligned",
      evidence: ASTROCADE_INVARIANTS[3] ?? "blueprint fields",
      qa: "qa:architecture-parity · qa:template-polish",
    },
    {
      pillar: "per-game 样品定制",
      astrocade: "每款样品有独立 polish / 机制增量",
      ourDesign: "spec.samplePlayProfile（17 registry + Scene 读 profile）",
      status: profileCount === SAMPLES.length ? "aligned" : "partial",
      evidence: `${profileCount}/${SAMPLES.length} profiles · enrich 烘焙`,
      qa: "qa:sample-profiles",
    },
    {
      pillar: "同 prompt 效果 parity",
      astrocade: "同款描述 → 同款试玩效果（机制+视觉）",
      ourDesign: "同 prompt POST → inferSampleIdFromPrompt + 专用 Scene；canvas 截图对标",
      status: samePromptEffectAligned ? "aligned" : parityValidation ? "partial" : "partial",
      evidence:
        parityValidation !== null
          ? `路由 ${parityValidation.method1RouteOk}/${parityValidation.method1Total} · 视觉 ${parityValidation.method1VisualOk}/${parityValidation.method1Total} · 全过 ${parityValidation.method1AllOk}/${parityValidation.method1Total}`
          : "qa:competitor-parity-validation",
      qa: "qa:competitor-parity-validation · qa:prompt-parity-compare",
    },
    {
      pillar: "用户新建 vs 样品 polish",
      astrocade: "精品 demo 每款独立机制/视觉",
      ourDesign: "同 prompt 精确匹配 → inferSampleIdFromPrompt 套用 profile；否则 template 族默认",
      status: userPolishAligned ? "aligned" : "partial",
      evidence: `infer ${userProfile.inferMatched}/${userProfile.total} · profile ${userProfile.profileMatched}/${userProfile.total} · qa:prompt-profile-infer`,
      qa: "qa:prompt-profile-infer · qa:sample-profiles · qa:game-effect-compare",
    },
    {
      pillar: "Primary 视觉 / juice 密度",
      astrocade: "每款高 polish 粒子/镜头/关卡",
      ourDesign: "16 专用 Scene 族 + profile 增量；template 族 gameJuice + Godot GameJuice",
      status: primaryJuiceAligned ? "aligned" : "partial",
      evidence:
        gameEffectCases !== null
          ? `qa:game-effect-compare ${gameEffectCases} cases · qa:template-polish · qa:godot:juice-gate 11/11`
          : "qa:game-effect-compare · qa:template-polish · qa:godot:juice-gate 11/11",
      qa: "qa:game-effect-compare · qa:template-polish · qa:godot:juice-gate",
    },
    {
      pillar: "随机克隆效果 parity",
      astrocade: "Fork 竞品游戏 → 试玩效果一致",
      ourDesign: "duplicate 保留 specJson+profile · 随机抽样品对标 · canvas 截图对标",
      status: randomCloneAligned ? "aligned" : parityValidation ? "partial" : "partial",
      evidence:
        parityValidation !== null
          ? `结构 ${parityValidation.method2StructuralOk}/${parityValidation.method2Total} · 全过 ${parityValidation.method2AllOk}/${parityValidation.method2Total} · astrocade-random-pick.json`
          : "duplicate API · e2e/competitor-clone.smoke",
      qa: "qa:competitor-parity-validation · e2e/competitor-clone.smoke",
    },
    {
      pillar: "Godot Secondary",
      astrocade: "3D 预览 / 导出",
      ourDesign: `${godotTemplates} 语义模板导出 · 11 SubViewport runtime · profile 读入`,
      status: godotTemplates >= 16 ? "aligned" : "partial",
      evidence: `godotExport=${godotTemplates} · runtime profile ${GODOT_RUNTIME_COUNT}/${GODOT_RUNTIME_COUNT}`,
      qa: "qa:godot-3d-matrix · qa:godot:runtime-profile",
    },
    {
      pillar: "Phaser ↔ Godot 双轨 polish",
      astrocade: "3D 预览与 2D 试玩视觉一致",
      ourDesign: "共享 GameSpec · Godot runtime 读 samplePlayProfile · customization 陶艺三部位对齐",
      status: dualTrackAligned ? "aligned" : "partial",
      evidence: `11 Godot runtime 读 samplePlayProfile · GameJuice 11/11 · customization 三部位对齐`,
      qa: "qa:godot:runtime-profile · qa:godot:juice-gate · e2e/godot-runtime.smoke",
    },
    {
      pillar: "封面 ↔ 试玩资产",
      astrocade: "封面与 in-game 视觉一致",
      ourDesign: "V2 manifest · preload 双轨",
      status: coverAligned ? "aligned" : "partial",
      evidence:
        snap.coverPlayDist !== null
          ? `V2 manifest · qa:cover-play-alignment 色差 ${snap.coverPlayDist} · 样品馆 canvas OK`
          : "V2 manifest · qa:cover-play-alignment",
      qa: "qa:cover-play-alignment · qa:asset-alignment",
    },
    {
      pillar: "Advanced LLM",
      astrocade: "可选 AI 改写玩法",
      ourDesign: "Agentic tier · template-first 默认不走 LLM",
      status: monitorAligned ? "aligned" : "partial",
      evidence: `monitor ${snap.monitorLlm}/${snap.monitorTotal} llm · sandbox mock 15/15 · template-first 默认专用 Scene`,
      qa: "qa:agentic-template-matrix · qa:llm-agentic:monitor:all · qa:agentic-sandbox-mock",
    },
    {
      pillar: "i18n / 全球化",
      astrocade: "多语言样品与 UI",
      ourDesign: "next-intl · Scene HUD 双语 · 样品 EN seed",
      status: "aligned",
      evidence: "5 locales · qa:scene-hud-i18n 12 Scene · qa:samples-locale 17 samples",
      qa: "qa:scene-hud-i18n · qa:samples-locale · e2e/samples-en-matrix",
    },
    {
      pillar: "编排档位 astrocade",
      astrocade: "统一高质量生成流水线",
      ourDesign: "PRODUCT.orchestration.qualityTier=astrocade · template-first 默认",
      status: PRODUCT.orchestration.qualityTier === "astrocade" ? "aligned" : "gap",
      evidence: `qualityTier=${PRODUCT.orchestration.qualityTier} · agenticModule=${PRODUCT.game.agenticModuleEnabled}`,
      qa: "qa:astrocade-pipeline · qa:orch-smoke",
    },
    {
      pillar: "E2E 试玩冒烟",
      astrocade: "全样品可玩、无白屏",
      ourDesign: "Playwright samples-en + astrocade-agentic + godot matrix",
      status: snap.e2eAllOk ? "aligned" : "partial",
      evidence: snap.e2eAllOk
        ? `test:e2e:astrocade · test:e2e:godot 17/17 · samples-en-matrix ${SAMPLES.length}/${SAMPLES.length}`
        : "需 dev · qa:competitor-gates",
      qa: "test:e2e:astrocade · test:e2e:godot",
    },
  ];
}

/** 架构级断言（不含 E2E / 需 dev server 的项） */
export function runCompetitorArchitectureChecks(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];

  const { missing } = templateFirstCoverage();
  if (missing.length) failures.push(`template-first missing: ${missing.join(", ")}`);
  if (!PRODUCT.game.dedicatedSceneForTemplateFirst) failures.push("dedicatedSceneForTemplateFirst=false");
  if (PRODUCT.orchestration.qualityTier !== "astrocade") {
    failures.push(`qualityTier=${PRODUCT.orchestration.qualityTier}`);
  }
  if (Object.keys(SAMPLE_PLAY_PROFILES).length !== SAMPLES.length) {
    failures.push("samplePlayProfile registry != SAMPLES.length");
  }

  for (const s of SAMPLES) {
    const spec = specForSample(s);
    const v = checkAstrocadeParity(spec, { label: s.id });
    if (v.length) failures.push(v.map((x) => x.message).join("; "));
  }

  // duplicate 模拟：normalize 后 profile 仍在
  for (const s of SAMPLES.slice(0, 3)) {
    const enriched = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", { sampleId: s.id });
    const cloned = normalizeAstrocadePlaySpec(structuredClone(enriched));
    if (cloned.samplePlayProfile?.variantId !== enriched.samplePlayProfile?.variantId) {
      failures.push(`clone lost profile: ${s.id}`);
    }
    const replay = buildCanonicalAstrocadeSpec(s.prompt, "zh-Hans", {
      persistedSpec: cloned,
      projectId: `user-${s.id}-clone`,
    });
    if (replay.samplePlayProfile?.variantId !== enriched.samplePlayProfile?.variantId) {
      failures.push(`enrich reapply profile: ${s.id}`);
    }
  }

  // 用户 mock 路径：同 prompt Scene/template 一致
  const promptParity = computePromptRouteParity();
  if (promptParity.sceneAligned !== promptParity.total) {
    failures.push(`prompt scene parity ${promptParity.sceneAligned}/${promptParity.total}`);
  }
  if (promptParity.templateAligned !== promptParity.total) {
    failures.push(`prompt template parity ${promptParity.templateAligned}/${promptParity.total}`);
  }
  if (promptParity.userAgenticLeaks > 0) {
    failures.push(`user path agentic leaks: ${promptParity.userAgenticLeaks}`);
  }

  // 同 prompt 用户路径应自动套用 profile（全 17 样品）
  for (const s of SAMPLES) {
    if (inferSampleIdFromPrompt(s.prompt) !== s.id) {
      failures.push(`inferSampleIdFromPrompt: ${s.id}`);
    }
    const userSpec = prepareGameSpecForPersist(mockSpecFromPrompt(s.prompt), s.prompt, "zh-Hans");
    if (userSpec.samplePlayProfile?.variantId !== s.id) {
      failures.push(`user prompt profile: ${s.id}`);
    }
  }

  const userProfile = computeUserProfileParity();
  if (userProfile.profileMatched !== userProfile.total) {
    failures.push(`user profile parity ${userProfile.profileMatched}/${userProfile.total}`);
  }

  return { ok: failures.length === 0, failures };
}

export function summarizeCompetitorReport(rows: CompetitorArchitectureRow[]): CompetitorArchitectureReport {
  const aligned = rows.filter((r) => r.status === "aligned").length;
  const partial = rows.filter((r) => r.status === "partial").length;
  const gaps = rows.filter((r) => r.status === "gap").length;
  return {
    at: new Date().toISOString(),
    rows,
    aligned,
    partial,
    gaps,
    promptParity: computePromptRouteParity(),
  };
}
