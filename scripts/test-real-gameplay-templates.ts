/**
 * 验证 4 真玩法（mahjong/tetris/endless-runner/fruit-ninja）能完整 enrich + 主题适配。
 * 运行：npx tsx scripts/test-real-gameplay-templates.ts
 */
import { enrichGameSpecForRuntime } from "../src/lib/enrich-game-spec";
import type { GameSpec } from "../src/lib/game-spec";

const TEMPLATES: Array<{ id: string; prompt: string; expectBp: string[]; expectTheme: string }> = [
  { id: "mahjong", prompt: "国标麻将对局四人", expectBp: ["variant", "startingPoints", "aiDifficulty", "rounds"], expectTheme: "#dc2626" },
  { id: "tetris", prompt: "俄罗斯方块经典", expectBp: ["gridWidth", "gridHeight", "targetLines", "startSpeedMs"], expectTheme: "pulse" },
  { id: "endless-runner", prompt: "神庙逃亡跑酷", expectBp: ["lanes", "targetScore", "speed", "obstacleDensity"], expectTheme: "pulse" },
  { id: "fruit-ninja", prompt: "水果忍者切水果", expectBp: ["targetScore", "timeLimitMs", "spawnIntervalMs", "bombChance"], expectTheme: "pulse" },
];

function makeBaseSpec(templateId: string): GameSpec {
  return {
    version: 1,
    templateId: templateId as GameSpec["templateId"],
    title: "测试",
    theme: { backgroundColor: "#0c1226", playerColor: "#2dd4bf", hazardColor: "#9d5838", collectibleColor: "#c9a66b", particleTint: "#94a3b8" },
    gameplay: { playerSpeed: 300, hazardSpeed: 200, spawnIntervalMs: 800, winScore: 30, lives: 3, arenaPadding: 36, jumpStrength: 420, gravity: 980, startingCoins: 120, baseHealth: 48 },
    labels: { player: "玩家", hazard: "敌人", collectible: "金币", subtitle: "测试" },
  } as GameSpec;
}

let pass = 0;
let fail = 0;

for (const t of TEMPLATES) {
  const enriched = enrichGameSpecForRuntime(makeBaseSpec(t.id), t.prompt);
  const bp = (enriched as Record<string, unknown>)[t.id === "endless-runner" ? "endlessRunner" : t.id === "fruit-ninja" ? "fruitNinja" : t.id] as Record<string, unknown> | undefined;
  if (!bp) {
    fail++;
    console.error(`[FAIL] ${t.id}: blueprint 缺失`);
    continue;
  }
  const missing = t.expectBp.filter((k) => bp[k] === undefined);
  if (missing.length > 0) {
    fail++;
    console.error(`[FAIL] ${t.id}: 缺字段 ${missing.join(",")}`);
    continue;
  }
  // 验证 seed 注入
  if (typeof enriched.samplePlayProfile?.seed !== "number") {
    fail++;
    console.error(`[FAIL] ${t.id}: seed 缺失`);
    continue;
  }
  pass++;
  console.log(`[OK] ${t.id}: bp=${Object.keys(bp).length}字段 seed=${enriched.samplePlayProfile.seed?.toFixed(3)} mood=${enriched.samplePlayProfile.mood} music=${enriched.presentation?.musicProfile} bgm=${enriched.presentation?.bgmTag}`);
}

console.log(`\n✅ ${pass}/${TEMPLATES.length} passed, ❌ ${fail} failed`);
if (fail > 0) process.exit(1);
