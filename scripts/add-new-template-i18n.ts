/**
 * 一次性脚本：给 5 语言 messages/*.json 批量加 6 个新模板的 HUD/banner key
 * 用法：npx tsx scripts/add-new-template-i18n.ts
 */
import fs from "node:fs";
import path from "node:path";

type Translations = Record<string, { hud: Record<string, string>; banner: Record<string, string> }>;

const TRANSLATIONS: Translations = {
  "zh-Hans": {
    hud: {
      rhythmScore: "得分 {score} · 连击 ×{combo}",
      rhythmProgress: "命中 {hit}/{total} · Miss ×{miss}",
      sportsScore: "得分 {score}/{target} · 剩余 {sec}s",
      cardState: "我 HP {hp} · 法力 {mana}/{maxMana} · AI HP {aiHp} · 回合 {round}",
      fightingRound: "回合 {round}/{total} · 比分 {pWins}-{aWins}",
      fightingHp: "我 {playerHp} HP · AI {aiHp} HP",
      mobaState: "HP {hp} · 我塔 {mine} · 敌塔 {enemy}",
      horrorState: "夜 {night}/{totalNights} · 电力 {power}% · 摄像头 {cam}",
    },
    banner: {
      rhythmWinTitle: "节奏完美！",
      rhythmWinMsg: "全部命中，达成通关",
      sportsWinTitle: "比赛胜利！",
      sportsWinMsg: "目标分数达成",
      cardWinTitle: "卡牌大师！",
      cardWinMsg: "AI HP 归零",
      fightingWinTitle: "格斗冠军！",
      fightingWinMsg: "赢下本场比赛",
      mobaWinTitle: "推塔成功！",
      mobaWinMsg: "敌方基地沦陷",
      horrorWinTitle: "撑到天亮！",
      horrorWinMsg: "活过所有夜晚",
    },
  },
  "zh-Hant": {
    hud: {
      rhythmScore: "得分 {score} · 連擊 ×{combo}",
      rhythmProgress: "命中 {hit}/{total} · Miss ×{miss}",
      sportsScore: "得分 {score}/{target} · 剩餘 {sec}s",
      cardState: "我 HP {hp} · 法力 {mana}/{maxMana} · AI HP {aiHp} · 回合 {round}",
      fightingRound: "回合 {round}/{total} · 比分 {pWins}-{aWins}",
      fightingHp: "我 {playerHp} HP · AI {aiHp} HP",
      mobaState: "HP {hp} · 我塔 {mine} · 敵塔 {enemy}",
      horrorState: "夜 {night}/{totalNights} · 電力 {power}% · 攝像頭 {cam}",
    },
    banner: {
      rhythmWinTitle: "節奏完美！",
      rhythmWinMsg: "全部命中，達成通關",
      sportsWinTitle: "比賽勝利！",
      sportsWinMsg: "目標分數達成",
      cardWinTitle: "卡牌大師！",
      cardWinMsg: "AI HP 歸零",
      fightingWinTitle: "格鬥冠軍！",
      fightingWinMsg: "贏下本場比賽",
      mobaWinTitle: "推塔成功！",
      mobaWinMsg: "敵方基地淪陷",
      horrorWinTitle: "撐到天亮！",
      horrorWinMsg: "活過所有夜晚",
    },
  },
  en: {
    hud: {
      rhythmScore: "Score {score} · Combo ×{combo}",
      rhythmProgress: "Hit {hit}/{total} · Miss ×{miss}",
      sportsScore: "Score {score}/{target} · {sec}s left",
      cardState: "You HP {hp} · Mana {mana}/{maxMana} · AI HP {aiHp} · Round {round}",
      fightingRound: "Round {round}/{total} · {pWins}-{aWins}",
      fightingHp: "You {playerHp} HP · AI {aiHp} HP",
      mobaState: "HP {hp} · Your towers {mine} · Enemy towers {enemy}",
      horrorState: "Night {night}/{totalNights} · Power {power}% · Cam {cam}",
    },
    banner: {
      rhythmWinTitle: "Perfect Rhythm!",
      rhythmWinMsg: "All hits landed, stage cleared",
      sportsWinTitle: "Match Won!",
      sportsWinMsg: "Target score reached",
      cardWinTitle: "Card Master!",
      cardWinMsg: "AI HP depleted",
      fightingWinTitle: "Champion!",
      fightingWinMsg: "Won the match",
      mobaWinTitle: "Base Destroyed!",
      mobaWinMsg: "Enemy base falls",
      horrorWinTitle: "Survived!",
      horrorWinMsg: "Made it through all nights",
    },
  },
  ms: {
    hud: {
      rhythmScore: "Skor {score} · Combo ×{combo}",
      rhythmProgress: "Hit {hit}/{total} · Miss ×{miss}",
      sportsScore: "Skor {score}/{target} · {sec}s lagi",
      cardState: "Anda HP {hp} · Mana {mana}/{maxMana} · AI HP {aiHp} · Pusingan {round}",
      fightingRound: "Pusingan {round}/{total} · {pWins}-{aWins}",
      fightingHp: "Anda {playerHp} HP · AI {aiHp} HP",
      mobaState: "HP {hp} · Menara anda {mine} · Menara musuh {enemy}",
      horrorState: "Malam {night}/{totalNights} · Kuasa {power}% · Kamera {cam}",
    },
    banner: {
      rhythmWinTitle: "Irama Sempurna!",
      rhythmWinMsg: "Semua hit berjaya, tahap selesai",
      sportsWinTitle: "Perlawanan Dimenangi!",
      sportsWinMsg: "Skor sasaran dicapai",
      cardWinTitle: "Master Kad!",
      cardWinMsg: "AI HP habis",
      fightingWinTitle: "Juara!",
      fightingWinMsg: "Memenangi perlawanan",
      mobaWinTitle: "Pangkalan Dimusnahkan!",
      mobaWinMsg: "Pangkalan musuh tumbang",
      horrorWinTitle: "Selamat!",
      horrorWinMsg: "Berjaya harungi semua malam",
    },
  },
  th: {
    hud: {
      rhythmScore: "คะแนน {score} · คอมโบ ×{combo}",
      rhythmProgress: "โดน {hit}/{total} · พลาด ×{miss}",
      sportsScore: "คะแนน {score}/{target} · เหลือ {sec}วิ",
      cardState: "คุณ HP {hp} · มานา {mana}/{maxMana} · AI HP {aiHp} · รอบ {round}",
      fightingRound: "ยก {round}/{total} · สกอร์ {pWins}-{aWins}",
      fightingHp: "คุณ {playerHp} HP · AI {aiHp} HP",
      mobaState: "HP {hp} · ป้อมคุณ {mine} · ป้อมศัตรู {enemy}",
      horrorState: "คืน {night}/{totalNights} · พลัง {power}% · กล้อง {cam}",
    },
    banner: {
      rhythmWinTitle: "จังหวะสมบูรณ์!",
      rhythmWinMsg: "โดนครบทุกตัว ผ่านด่าน",
      sportsWinTitle: "ชนะการแข่งขัน!",
      sportsWinMsg: "ทำคะแนนเป้าหมายสำเร็จ",
      cardWinTitle: "มาสเตอร์การ์ด!",
      cardWinMsg: "AI HP หมด",
      fightingWinTitle: "แชมป์!",
      fightingWinMsg: "ชนะการแข่งขัน",
      mobaWinTitle: "ทำลายป้อมสำเร็จ!",
      mobaWinMsg: "ป้อมศัตรูล่ม",
      horrorWinTitle: "รอดจนถึงเช้า!",
      horrorWinMsg: "ผ่านคืนทั้งหมด",
    },
  },
};

const MESSAGES_DIR = path.join(process.cwd(), "src", "messages");

for (const [locale, t] of Object.entries(TRANSLATIONS)) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`[skip] ${filePath} 不存在`);
    continue;
  }
  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  json.gameEvents = json.gameEvents ?? {};
  json.gameEvents.hud = json.gameEvents.hud ?? {};
  json.gameEvents.banner = json.gameEvents.banner ?? {};

  let added = 0;
  for (const [k, v] of Object.entries(t.hud)) {
    if (!json.gameEvents.hud[k]) {
      json.gameEvents.hud[k] = v;
      added++;
    }
  }
  for (const [k, v] of Object.entries(t.banner)) {
    if (!json.gameEvents.banner[k]) {
      json.gameEvents.banner[k] = v;
      added++;
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`[OK] ${locale}.json +${added} keys`);
}

console.log("\n✅ 5 语言 i18n key 全部补齐");
