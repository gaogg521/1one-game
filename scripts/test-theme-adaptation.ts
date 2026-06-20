/**
 * 验证主题深度适配：不同主题 prompt → 不同适配值（场景/音乐/怪物/收集物）。
 * 运行：npx tsx scripts/test-theme-adaptation.ts
 */
import { enrichGameSpecForRuntime } from "../src/lib/enrich-game-spec";
import { fingerprintPrompt } from "../src/lib/prompt-fingerprint";
import { adaptThemeFromFingerprint as adapt } from "../src/lib/prompt-theme-adapter";
import type { GameSpec } from "../src/lib/game-spec";

function makeBaseSpec(templateId: string): GameSpec {
  return {
    version: 1,
    templateId: templateId as GameSpec["templateId"],
    title: "测试",
    theme: {
      backgroundColor: "#0c1226", playerColor: "#2dd4bf", hazardColor: "#9d5838",
      collectibleColor: "#c9a66b", particleTint: "#94a3b8",
    },
    gameplay: {
      playerSpeed: 300, hazardSpeed: 200, spawnIntervalMs: 800,
      winScore: 30, lives: 3, arenaPadding: 36,
      jumpStrength: 420, gravity: 980, startingCoins: 120, baseHealth: 48,
    },
    labels: { player: "玩家", hazard: "敌人", collectible: "金币", subtitle: "测试" },
  } as GameSpec;
}

const CASES: Array<{ prompt: string; expectEnemy: string; expectMusic: string; expectCollect: string }> = [
  { prompt: "森林冒险跳跃", expectEnemy: "刺藤", expectMusic: "organic", expectCollect: "松鳞" },
  { prompt: "太空星际射击", expectEnemy: "外星", expectMusic: "neon", expectCollect: "星尘" },
  { prompt: "海洋深海探险", expectEnemy: "海妖", expectMusic: "organic", expectCollect: "珍珠" },
  { prompt: "火焰熔岩挑战", expectEnemy: "炎魔", expectMusic: "pulse", expectCollect: "火晶" },
  { prompt: "冰雪山峰登顶", expectEnemy: "雪猿", expectMusic: "minimal", expectCollect: "冰莲" },
  { prompt: "赛博朋克霓虹", expectEnemy: "病毒", expectMusic: "neon", expectCollect: "数据" },
  { prompt: "武侠水墨江湖", expectEnemy: "邪派", expectMusic: "organic", expectCollect: "丹砂" },
  { prompt: "暗黑地下城", expectEnemy: "亡灵", expectMusic: "pulse", expectCollect: "魂" },
  { prompt: "可爱萌系冒险", expectEnemy: "淘气", expectMusic: "organic", expectCollect: "糖果" },
  { prompt: "沙漠金字塔", expectEnemy: "沙蝎", expectMusic: "pulse", expectCollect: "金沙" },
  { prompt: "雨林深处探险", expectEnemy: "毒蛙", expectMusic: "organic", expectCollect: "翡翠" },
  { prompt: "雪山登顶挑战", expectEnemy: "雪猿", expectMusic: "minimal", expectCollect: "冰莲" },
  { prompt: "古遗迹神庙", expectEnemy: "石像", expectMusic: "organic", expectCollect: "古币" },
  { prompt: "天空浮空岛", expectEnemy: "风灵", expectMusic: "organic", expectCollect: "云絮" },
  { prompt: "海盗船寻宝", expectEnemy: "海盗", expectMusic: "pulse", expectCollect: "金币" },
  { prompt: "机器人机械世界", expectEnemy: "故障", expectMusic: "pulse", expectCollect: "螺丝" },
  { prompt: "节日庙会灯笼", expectEnemy: "年兽", expectMusic: "pulse", expectCollect: "红包" },
  { prompt: "都市霓虹街头", expectEnemy: "黑帮", expectMusic: "neon", expectCollect: "钞票" },
];

let pass = 0;
let fail = 0;
for (const c of CASES) {
  const fp = fingerprintPrompt(c.prompt);
  const a = adapt(fp);
  const okEnemy = a.enemyRoot.startsWith(c.expectEnemy);
  const okMusic = a.musicProfile === c.expectMusic;
  const okCollect = a.collectibleRoot.startsWith(c.expectCollect);
  if (okEnemy && okMusic && okCollect) {
    pass++;
    console.log(`[OK] "${c.prompt}" → enemy=${a.enemyRoot} music=${a.musicProfile} collect=${a.collectibleRoot} bgHue=${a.bgHueBias.toFixed(2)}`);
  } else {
    fail++;
    console.error(`[FAIL] "${c.prompt}" → enemy=${a.enemyRoot}(expect ${c.expectEnemy}) music=${a.musicProfile}(expect ${c.expectMusic}) collect=${a.collectibleRoot}(expect ${c.expectCollect})`);
  }
}

// 验证 enrich 后 spec 真的用了适配值
const enriched = enrichGameSpecForRuntime(makeBaseSpec("platformer"), "火焰熔岩挑战");
const hazardReplaced = enriched.theme.hazardColor === "#dc2626"; // 火焰规则 enemyColor
const musicSet = enriched.presentation?.musicProfile === "pulse";
if (hazardReplaced && musicSet) {
  pass++;
  console.log("[OK] enrich 注入适配值：hazardColor=#dc2626 musicProfile=pulse");
} else {
  fail++;
  console.error(`[FAIL] enrich 注入：hazardColor=${enriched.theme.hazardColor} music=${enriched.presentation?.musicProfile}`);
}

console.log(`\n✅ ${pass} passed, ❌ ${fail} failed`);
if (fail > 0) process.exit(1);
