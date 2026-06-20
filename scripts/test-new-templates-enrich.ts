/**
 * 验证 6 个新模板（rhythm/sports/card/fighting/moba/horror）的 enrich 端无错误。
 * 用 mock-spec 生成基础 spec → 模拟 LLM 路由到各模板 → enrich → 校验 blueprint 字段就位。
 *
 * 运行：npx tsx scripts/test-new-templates-enrich.ts
 */
import { enrichGameSpecForRuntime } from "../src/lib/enrich-game-spec";
import type { GameSpec } from "../src/lib/game-spec";

const TEMPLATES = ["rhythm", "sports", "card", "fighting", "moba", "horror"] as const;

function makeBaseSpec(templateId: string): GameSpec {
  return {
    version: 1,
    templateId: templateId as GameSpec["templateId"],
    title: `${templateId} 测试游戏`,
    theme: {
      backgroundColor: "#0c1226",
      playerColor: "#2dd4bf",
      hazardColor: "#ef4444",
      collectibleColor: "#fbbf24",
      particleTint: "#94a3b8",
    },
    gameplay: {
      playerSpeed: 300,
      hazardSpeed: 200,
      spawnIntervalMs: 800,
      winScore: 30,
      lives: 3,
      arenaPadding: 36,
      jumpStrength: 420,
      gravity: 980,
      startingCoins: 120,
      baseHealth: 48,
    },
    labels: {
      player: "玩家",
      hazard: "威胁",
      collectible: "收集物",
      subtitle: `${templateId} 模板测试`,
    },
  } as GameSpec;
}

let pass = 0;
let fail = 0;

for (const tid of TEMPLATES) {
  const base = makeBaseSpec(tid);
  try {
    const enriched = enrichGameSpecForRuntime(base, `测试 ${tid}`);
    const bp = (enriched as Record<string, unknown>)[tid] as Record<string, unknown> | undefined;
    if (!bp || typeof bp !== "object") {
      throw new Error(`enrich 后 ${tid} blueprint 缺失`);
    }
    // 校验关键字段存在
    const requiredKeys: Record<string, string[]> = {
      rhythm: ["bpm", "lanes", "patternDensity", "hitWindowMs", "totalNotes"],
      sports: ["sport", "targetScore", "timeLimitMs", "aiDifficulty"],
      card: ["startingHand", "maxMana", "deckSize", "aiDifficulty", "playerHp"],
      fighting: ["rounds", "playerHp", "aiDifficulty"],
      moba: ["towersToWin", "playerHp", "aiDifficulty", "abilities"],
      horror: ["nights", "cameras", "monsterSpawnIntervalMs", "doorCooldownMs", "powerMax"],
    };
    for (const k of requiredKeys[tid]) {
      if (bp[k] === undefined) {
        throw new Error(`${tid} blueprint 缺字段: ${k}`);
      }
    }
    // 校验 visual.shaderPack 也已 enrich
    if (!enriched.visual?.shaderPack) {
      throw new Error(`${tid} enrich 后 visual.shaderPack 缺失`);
    }
    console.log(`[OK] ${tid}: blueprint 完整 (shaderPack=${enriched.visual.shaderPack}, ${Object.keys(bp).length} 字段)`);
    pass++;
  } catch (e) {
    console.error(`[FAIL] ${tid}: ${e instanceof Error ? e.message : String(e)}`);
    fail++;
  }
}

console.log(`\n✅ ${pass}/${TEMPLATES.length} passed, ❌ ${fail} failed`);
if (fail > 0) process.exit(1);
