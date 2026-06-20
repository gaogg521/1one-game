/**
 * 千人千面验证：同模板不同 prompt → 不同 seed / 不同 labels / 不同 blueprint 数值。
 * 同 prompt 多次调用 → 相同结果（确定性）。
 *
 * 运行：npx tsx scripts/test-personalization.ts
 */
import { enrichGameSpecForRuntime } from "../src/lib/enrich-game-spec";
import type { GameSpec } from "../src/lib/game-spec";
import { fingerprintPrompt } from "../src/lib/prompt-fingerprint";

function makeBaseSpec(templateId: string): GameSpec {
  return {
    version: 1,
    templateId: templateId as GameSpec["templateId"],
    title: `${templateId} 测试`,
    theme: {
      backgroundColor: "#0c1226",
      playerColor: "#2dd4bf",
      hazardColor: "#ef4444",
      collectibleColor: "#fbbf24",
      particleTint: "#94a3b8",
    },
    gameplay: {
      playerSpeed: 300, hazardSpeed: 200, spawnIntervalMs: 800,
      winScore: 30, lives: 3, arenaPadding: 36,
      jumpStrength: 420, gravity: 980, startingCoins: 120, baseHealth: 48,
    },
    labels: { player: "玩家", hazard: "敌人", collectible: "金币", subtitle: "测试" },
  } as GameSpec;
}

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`[FAIL] ${name} ${detail}`);
  }
}

// ── 测试 1：不同 prompt → 不同 seed
const fp1 = fingerprintPrompt("赛博朋克射击弹幕");
const fp2 = fingerprintPrompt("森林冒险跳跃");
const fp3 = fingerprintPrompt("赛博朋克射击弹幕"); // 同 fp1
check("不同 prompt 不同 seed", fp1.seed !== fp2.seed, `fp1=${fp1.seed} fp2=${fp2.seed}`);
check("同 prompt 同 seed（确定性）", fp1.seed === fp3.seed, `fp1=${fp1.seed} fp3=${fp3.seed}`);

// ── 测试 2：主题词提取
check("主题词非空", fp1.themeWords.length > 0, `words=${JSON.stringify(fp1.themeWords)}`);
check("mood 推断", fp1.mood === "dark" || fp1.mood === "lively" || fp1.mood === "mysterious", `mood=${fp1.mood}`);

// ── 测试 3：enrich 后 samplePlayProfile 含 seed/mood/themeWords
const enriched1 = enrichGameSpecForRuntime(makeBaseSpec("platformer"), "森林冒险跳跃");
const spp = enriched1.samplePlayProfile;
check("enrich 注入 seed", typeof spp?.seed === "number" && spp.seed >= 0 && spp.seed <= 1, `seed=${spp?.seed}`);
check("enrich 注入 mood", typeof spp?.mood === "string" && spp.mood.length > 0, `mood=${spp?.mood}`);
check("enrich 注入 themeWords", Array.isArray(spp?.themeWords) && (spp?.themeWords?.length ?? 0) > 0, `words=${JSON.stringify(spp?.themeWords)}`);

// ── 测试 4：主题深度注入——通用 labels 被替换
const enriched2 = enrichGameSpecForRuntime(makeBaseSpec("shooter"), "太空星际战机大战外星入侵者");
check("主题注入 player 非通用", !["玩家", "主角", "英雄"].includes(enriched2.labels.player), `player=${enriched2.labels.player}`);
check("主题注入 hazard 非通用", !["敌人", "敌军", "障碍"].includes(enriched2.labels.hazard), `hazard=${enriched2.labels.hazard}`);

// ── 测试 5：seed 驱动 blueprint 数值微调——同模板不同 prompt 出不同 levelLayers
const bp1 = enrichGameSpecForRuntime(makeBaseSpec("platformer"), "森林冒险跳跃收集松果");
const bp2 = enrichGameSpecForRuntime(makeBaseSpec("platformer"), "暗黑地下城挑战精准跳跃");
const layers1 = bp1.platformer?.levelLayers ?? 0;
const layers2 = bp2.platformer?.levelLayers ?? 0;
check("seed 驱动 levelLayers 差异", layers1 !== layers2, `prompt1=${layers1} prompt2=${layers2}`);

// ── 测试 6：确定性——同 prompt 两次 enrich 出同结果
const bp1b = enrichGameSpecForRuntime(makeBaseSpec("platformer"), "森林冒险跳跃收集松果");
const layers1b = bp1b.platformer?.levelLayers ?? 0;
check("确定性 levelLayers", layers1 === layers1b, `first=${layers1} second=${layers1b}`);

console.log(`\n✅ ${pass} passed, ❌ ${fail} failed`);
if (fail > 0) process.exit(1);
