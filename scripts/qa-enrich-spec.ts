/**
 * 冒烟：enrichGameSpecForRuntime 补全导演/塔防蓝图/presentation
 * npm run qa:enrich-spec
 */
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { enrichGameSpecForRuntime } from "../src/lib/enrich-game-spec";

const prompts = [
  "保卫萝卜塔防，多种炮塔",
  "太空躲避陨石收集星星",
  "横版平台跳跃森林主题",
];

let failed = 0;
for (const p of prompts) {
  const raw = mockSpecFromPrompt(p);
  const enriched = enrichGameSpecForRuntime(raw, p);
  const ok =
    enriched.director?.events?.length &&
    enriched.presentation?.musicProfile &&
    (enriched.templateId !== "towerDefense" || enriched.towerDefense);
  if (!ok) {
    console.error("[FAIL]", p, enriched.templateId, {
      events: enriched.director?.events?.length,
      td: !!enriched.towerDefense,
      music: enriched.presentation?.musicProfile,
    });
    failed += 1;
  } else {
    console.log("[OK]", enriched.templateId, "events=", enriched.director?.events?.length);
  }
}

process.exit(failed > 0 ? 1 : 0);
