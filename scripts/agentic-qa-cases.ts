import type { GameSpec } from "@/lib/game-spec";

/** 全语义模板 Agentic QA 用例（与 qa-template-matrix 对齐并补 racing/sniper/stealth） */
export const AGENTIC_QA_CASES: Array<{ prompt: string; expectTemplate: GameSpec["templateId"] }> = [
  { prompt: "躲开从天而降的陨石", expectTemplate: "avoider" },
  { prompt: "收集散落金币躲开尖刺", expectTemplate: "collector" },
  { prompt: "多条命生存模式躲开尖刺", expectTemplate: "survivor" },
  { prompt: "横版闯关跳跃收集钥匙过关", expectTemplate: "platformer" },
  { prompt: "塔防卫萝卜波次守住基地", expectTemplate: "towerDefense" },
  { prompt: "飞船射击消灭敌机", expectTemplate: "shooter" },
  { prompt: "blocky sniper hunter 低多边形狙击", expectTemplate: "sniper" },
  { prompt: "空中轨道过山车竞速", expectTemplate: "coaster" },
  { prompt: "赛道圈速计时竞速", expectTemplate: "racing" },
  { prompt: "色彩消除益智 match3", expectTemplate: "puzzle" },
  { prompt: "种植花园浇水收获", expectTemplate: "farming" },
  { prompt: "打击 dummy 假人解压", expectTemplate: "physics" },
  { prompt: "国际象棋对弈", expectTemplate: "chess" },
  { prompt: "汽车涂色调色盘定制", expectTemplate: "customization" },
  { prompt: "地图征服派兵占领区域", expectTemplate: "strategy" },
  { prompt: "潜行摆荡偷取宝物", expectTemplate: "stealth" },
];
