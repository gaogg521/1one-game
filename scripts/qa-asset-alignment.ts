/**
 * 封面背景 + 精灵 prompt 与 template 视觉风格对齐校验
 * npm run qa:asset-alignment
 */
import type { GameSpec } from "../src/lib/game-spec";
import { mockSpecFromPrompt } from "../src/lib/mock-spec";
import { buildBackgroundPrompt, resolveBackgroundTemplateStyle } from "../src/lib/game-background-gen";
import { buildSpritePrompt } from "../src/lib/game-sprite-gen";
import {
  TEMPLATE_VISUAL_STYLES,
  templateVisualStyle,
} from "../src/lib/assets/template-visual-styles";

const MATRIX: Array<{ id: GameSpec["templateId"]; prompt: string }> = [
  { id: "avoider", prompt: "躲开从天而降的陨石" },
  { id: "collector", prompt: "收集散落金币躲开尖刺" },
  { id: "survivor", prompt: "多条命生存模式躲开尖刺" },
  { id: "platformer", prompt: "横版闯关跳跃收集钥匙过关" },
  { id: "towerDefense", prompt: "塔防波次守住基地" },
  { id: "shooter", prompt: "飞船射击消灭敌机" },
  { id: "coaster", prompt: "空中轨道过山车竞速" },
  { id: "puzzle", prompt: "色彩消除益智 match3" },
  { id: "farming", prompt: "种植花园浇水收获" },
  { id: "physics", prompt: "打击 dummy 假人解压" },
  { id: "chess", prompt: "国际象棋对弈" },
  { id: "customization", prompt: "汽车涂色调色盘定制" },
  { id: "strategy", prompt: "地图征服派兵占领区域" },
];

const SPRITE_KINDS = ["player", "hazard", "gem"] as const;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function checkTemplate(id: GameSpec["templateId"], prompt: string) {
  const spec = mockSpecFromPrompt(prompt);
  assert(spec.templateId === id, `mock template ${id} got ${spec.templateId}`);

  const style = resolveBackgroundTemplateStyle(spec);
  assert(Boolean(TEMPLATE_VISUAL_STYLES[id]), `missing TEMPLATE_VISUAL_STYLES[${id}]`);

  const bg = buildBackgroundPrompt(spec);
  assert(bg.includes(style), `[${id}] background prompt missing style: ${style.slice(0, 40)}…`);
  assert(bg.includes(id), `[${id}] background prompt missing templateId`);

  for (const kind of SPRITE_KINDS) {
    const sp = buildSpritePrompt(spec, kind);
    assert(sp.length > 20, `[${id}] empty sprite prompt for ${kind}`);
    assert(
      sp.includes(style) || sp.includes("game mood:"),
      `[${id}] sprite ${kind} missing template scene context`,
    );
  }
}

function main() {
  for (const row of MATRIX) {
    checkTemplate(row.id, row.prompt);
    console.log(`[OK] ${row.id} asset prompts aligned`);
  }
  console.log("[OK] qa-asset-alignment complete");
}

main();
