/**
 * 一次性脚本：给 5 语言 messages/*.json 批量加 4 真玩法（mahjong/tetris/endless-runner/fruit-ninja）的 i18n key
 */
import fs from "node:fs";
import path from "node:path";

type T = Record<string, { hud: Record<string, string>; banner: Record<string, string> }>;

const T_MAP: T = {
  "zh-Hans": {
    hud: {
      mahjongState: "点数 {points} · 第 {round}/{totalRounds} 局",
      mahjongTenpai: "听牌中",
      tetrisScore: "得分 {score} · 消行 {lines}/{target}",
      endlessRunnerScore: "分数 {score}/{target} · 命 {lives}",
      fruitNinjaScore: "分数 {score}/{target} · 命 {lives} · {sec}s",
    },
    banner: {
      mahjongWinTitle: "和牌！",
      mahjongWinMsg: "荣和获胜",
      tetrisWinTitle: "方块大师！",
      tetrisWinMsg: "达成消行目标",
      endlessRunnerWinTitle: "极速通关！",
      endlessRunnerWinMsg: "到达终点距离",
      fruitNinjaWinTitle: "刀法精湛！",
      fruitNinjaWinMsg: "达成切水果目标",
    },
  },
  "zh-Hant": {
    hud: {
      mahjongState: "點數 {points} · 第 {round}/{totalRounds} 局",
      mahjongTenpai: "聽牌中",
      tetrisScore: "得分 {score} · 消行 {lines}/{target}",
      endlessRunnerScore: "分數 {score}/{target} · 命 {lives}",
      fruitNinjaScore: "分數 {score}/{target} · 命 {lives} · {sec}s",
    },
    banner: {
      mahjongWinTitle: "和牌！",
      mahjongWinMsg: "榮和獲勝",
      tetrisWinTitle: "方塊大師！",
      tetrisWinMsg: "達成消行目標",
      endlessRunnerWinTitle: "極速通關！",
      endlessRunnerWinMsg: "到達終點距離",
      fruitNinjaWinTitle: "刀法精湛！",
      fruitNinjaWinMsg: "達成切水果目標",
    },
  },
  en: {
    hud: {
      mahjongState: "Points {points} · Round {round}/{totalRounds}",
      mahjongTenpai: "Tenpai",
      tetrisScore: "Score {score} · Lines {lines}/{target}",
      endlessRunnerScore: "Score {score}/{target} · Lives {lives}",
      fruitNinjaScore: "Score {score}/{target} · Lives {lives} · {sec}s",
    },
    banner: {
      mahjongWinTitle: "Mahjong!",
      mahjongWinMsg: "Ron — you win",
      tetrisWinTitle: "Block Master!",
      tetrisWinMsg: "Lines target reached",
      endlessRunnerWinTitle: "Speed Clear!",
      endlessRunnerWinMsg: "Reached target distance",
      fruitNinjaWinTitle: "Blade Master!",
      fruitNinjaWinMsg: "Fruit target reached",
    },
  },
  ms: {
    hud: {
      mahjongState: "Mata {points} · Pusingan {round}/{totalRounds}",
      mahjongTenpai: "Tenpai",
      tetrisScore: "Skor {score} · Baris {lines}/{target}",
      endlessRunnerScore: "Skor {score}/{target} · Nyawa {lives}",
      fruitNinjaScore: "Skor {score}/{target} · Nyawa {lives} · {sec}s",
    },
    banner: {
      mahjongWinTitle: "Menang!",
      mahjongWinMsg: "Ron — anda menang",
      tetrisWinTitle: "Master Blok!",
      tetrisWinMsg: "Sasaran baris dicapai",
      endlessRunnerWinTitle: "Laju Selesai!",
      endlessRunnerWinMsg: "Jarak sasaran dicapai",
      fruitNinjaWinTitle: "Master Pisau!",
      fruitNinjaWinMsg: "Sasaran buah dicapai",
    },
  },
  th: {
    hud: {
      mahjongState: "แต้ม {points} · ตา {round}/{totalRounds}",
      mahjongTenpai: "เท็นไพ",
      tetrisScore: "คะแนน {score} · ลบบรรทัด {lines}/{target}",
      endlessRunnerScore: "คะแนน {score}/{target} · ชีวิต {lives}",
      fruitNinjaScore: "คะแนน {score}/{target} · ชีวิต {lives} · {sec}วิ",
    },
    banner: {
      mahjongWinTitle: "ชนะ!",
      mahjongWinMsg: "รอง — คุณชนะ",
      tetrisWinTitle: "มาสเตอร์บล็อก!",
      tetrisWinMsg: "ครบเป้าบรรทัด",
      endlessRunnerWinTitle: "ผ่านด่วน!",
      endlessRunnerWinMsg: "ถึงระยะเป้าหมาย",
      fruitNinjaWinTitle: "มาสเตอร์ใบมีด!",
      fruitNinjaWinMsg: "ครบเป้าผลไม้",
    },
  },
};

const DIR = path.join(process.cwd(), "src", "messages");
for (const [locale, t] of Object.entries(T_MAP)) {
  const fp = path.join(DIR, `${locale}.json`);
  const json = JSON.parse(fs.readFileSync(fp, "utf8"));
  json.gameEvents = json.gameEvents ?? {};
  json.gameEvents.hud = json.gameEvents.hud ?? {};
  json.gameEvents.banner = json.gameEvents.banner ?? {};
  let added = 0;
  for (const [k, v] of Object.entries(t.hud)) {
    if (!json.gameEvents.hud[k]) { json.gameEvents.hud[k] = v; added++; }
  }
  for (const [k, v] of Object.entries(t.banner)) {
    if (!json.gameEvents.banner[k]) { json.gameEvents.banner[k] = v; added++; }
  }
  fs.writeFileSync(fp, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`[OK] ${locale}.json +${added} keys`);
}
console.log("\n✅ 4 真玩法 5 语言 i18n key 全部补齐");
