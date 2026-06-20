/**
 * H1: detectTemplateFromPrompt 单元测试
 * 运行：npx tsx scripts/test-template-selector.ts
 */
import { detectTemplateFromPrompt } from "@/lib/template-selector";

type Case = { prompt: string; expected: string | null; label?: string };

const CASES: Case[] = [
  // ── 塔防
  { prompt: "植物大战僵尸游戏，豌豆射手保卫萝卜", expected: "towerDefense" },
  { prompt: "kingdom rush 风格塔防，波次敌人沿路进攻", expected: "towerDefense" },
  { prompt: "造塔防守敌人", expected: "towerDefense" },
  { prompt: "猴子塔防 BTD 风格", expected: "towerDefense" },
  { prompt: "保卫萝卜手机游戏", expected: "towerDefense" },

  // ── 平台跳跃
  { prompt: "超级玛丽兄弟横版跳跃", expected: "platformer" },
  { prompt: "sonic 索尼克风格跑酷关卡", expected: "platformer" },
  { prompt: "银河恶魔城 metroidvania 探索", expected: "platformer" },
  { prompt: "几何冲刺 geometry dash 节奏跳跃", expected: "platformer" },
  { prompt: "空洞骑士 hollow knight 平台闯关", expected: "platformer" },

  // ── 飞机射击
  { prompt: "雷电弹幕射击飞机大战", expected: "shooter" },
  { prompt: "太空侵略者 space invaders 复刻", expected: "shooter" },
  { prompt: "东方project 竖版射击弹幕", expected: "shooter" },
  { prompt: "星际飞机消灭敌机", expected: "shooter" },
  { prompt: "1942 经典飞行战争游戏", expected: "shooter" },

  // ── 坦克大战（Bug 修复：之前 LLM 会误判为 towerDefense）
  { prompt: "坦克大战", expected: "shooter" },
  { prompt: "经典坦克战 Battle City", expected: "shooter" },
  { prompt: "战车对战俯视角坦克射击", expected: "shooter" },
  { prompt: "battle city 复刻坦克大战", expected: "shooter" },
  { prompt: "做一个坦克大战风格的游戏", expected: "shooter" },

  // ── 幸存者
  { prompt: "吸血鬼幸存者旋转镰刀四面八方出现敌人", expected: "survivor" },
  { prompt: "vampire survivors 风格 360 度逃生", expected: "survivor" },
  { prompt: "Arena 射击 roguelite 无尽敌人", expected: null, label: "arena-roguelite (LLM 决定)" },

  // ── 农场
  { prompt: "星露谷物语风格种地农场游戏", expected: "farming" },
  { prompt: "开心农场收获季种菜", expected: "farming" },

  // ── 策略
  { prompt: "文明 civilization 风格即时战略", expected: "strategy" },
  { prompt: "部落冲突 clash of clans 领地控制", expected: "strategy" },
  { prompt: "红色警戒红警RTS战略扩张", expected: "strategy" },
  { prompt: "星际争霸 starcraft 即时战略", expected: "strategy" },

  // ── 益智扩展
  { prompt: "推箱子 sokoban 益智游戏", expected: "puzzle" },
  { prompt: "扫雷 minesweeper 经典游戏", expected: "puzzle" },
  { prompt: "2048 数字游戏", expected: "puzzle" },

  // ── 躲避
  { prompt: "炸弹人 bomberman 风格", expected: "avoider" },

  // ── 赛车（明确点名才选）
  { prompt: "赛车游戏 F1 极速竞速", expected: "racing" },
  { prompt: "马里奥赛车 mario kart", expected: "racing" },
  { prompt: "极品飞车 need for speed", expected: "racing" },

  // ── 狙击
  { prompt: "狙击精英 sniper elite 远程狙杀", expected: "sniper" },
  { prompt: "狙击手精准瞄准射击", expected: "sniper" },

  // ── 潜行
  { prompt: "合金装备 metal gear 潜行刺杀", expected: "stealth" },
  { prompt: "细胞分裂 splinter cell 不被发现", expected: "stealth" },

  // ── 物理弹射
  { prompt: "愤怒的小鸟 angry birds 弹射", expected: "physics" },
  { prompt: "弹球台球物理游戏", expected: "physics" },

  // ── 自定义
  { prompt: "捏脸换装角色自定义游戏", expected: "customization" },

  // ── 6 个新独立 family 模板
  { prompt: "节奏音游 OSU 风格", expected: "rhythm" },
  { prompt: "钢琴块别踩白块", expected: "rhythm" },
  { prompt: "篮球投篮三分球", expected: "sports" },
  { prompt: "足球射门点球 penalty", expected: "sports" },
  { prompt: "炉石传说卡牌对战", expected: "card" },
  { prompt: "街霸拳皇格斗对战", expected: "fighting" },
  { prompt: "英雄联盟 MOBA 推塔", expected: "moba" },
  { prompt: "FNAF 玩具熊五夜后宫恐怖", expected: "horror" },

  // ── 24 个复用 family 主流 templateId
  { prompt: "俄罗斯方块 tetris", expected: "tetris" },
  { prompt: "打砖块 breakout 经典街机", expected: "breakout" },
  { prompt: "乒乓 pong 对打", expected: "pong" },
  { prompt: "打地鼠 whack a mole", expected: "whack-a-mole" },
  { prompt: "2048 数字合成", expected: "merge" },
  { prompt: "suika 西瓜合成", expected: "merge" },
  { prompt: "放置挂机 idle clicker", expected: "idle" },
  { prompt: "烹饪厨房经营餐厅", expected: "cooking" },
  { prompt: "主题公园大亨 tycoon", expected: "tycoon" },
  { prompt: "宠物养成拓麻歌子", expected: "pet" },
  { prompt: "恋爱模拟视觉小说 galgame", expected: "dating-sim" },
  { prompt: "自走棋 auto battler TFT", expected: "auto-battler" },
  { prompt: "回合制策略火焰纹章", expected: "turn-based" },
  { prompt: "沙盒创造 sandbox 我的世界", expected: "sandbox" },
  { prompt: "滑雪下坡 skiing", expected: "skiing" },
  { prompt: "德州扑克 poker", expected: "poker" },
  { prompt: "纸牌接龙 solitaire", expected: "solitaire" },
  { prompt: "21 点 blackjack", expected: "blackjack" },
  { prompt: "wordle 字谜拼字", expected: "word-game" },
  { prompt: "密室逃脱 escape room", expected: "escape-room" },
  { prompt: "找茬 hidden object", expected: "hidden-object" },
  { prompt: "暗黑破坏神 hack and slash", expected: "hack-and-slash" },
  { prompt: "魂斗罗 run and gun", expected: "run-and-gun" },
  { prompt: "侦探推理 mystery 悬疑", expected: "mystery" },

  // ── 第三批 15 个主流扩展（棋牌/酷跑/悠闲）
  { prompt: "国标麻将对局", expected: "mahjong" },
  { prompt: "日本麻将 riichi", expected: "mahjong" },
  { prompt: "打麻将四人麻将", expected: "mahjong" },
  { prompt: "麻将接龙连连看", expected: "mahjong-solitaire" },
  { prompt: "mahjong solitaire 配对消除", expected: "mahjong-solitaire" },
  { prompt: "斗地主三人扑克", expected: "dou-dizhu" },
  { prompt: "dou dizhu 斗地主游戏", expected: "dou-dizhu" },
  { prompt: "UNO 乌诺牌", expected: "uno" },
  { prompt: "国际跳棋 checkers", expected: "checkers" },
  { prompt: "中国跳棋 chinese checkers", expected: "chinese-checkers" },
  { prompt: "军棋陆战棋 junqi", expected: "junqi" },
  { prompt: "飞行棋 4 人飞机棋", expected: "aeroplane-chess" },
  { prompt: "神庙逃亡 temple run", expected: "endless-runner" },
  { prompt: "地铁跑酷 subway surfers", expected: "endless-runner" },
  { prompt: "无尽跑酷酷跑", expected: "endless-runner" },
  { prompt: "水果忍者 fruit ninja 切水果", expected: "fruit-ninja" },
  { prompt: "割绳子 cut the rope", expected: "cut-the-rope" },
  { prompt: "数字填色 coloring", expected: "coloring" },
  { prompt: "花园种植种花 garden", expected: "garden" },
  { prompt: "咖啡馆经营 cafe", expected: "cafe" },
  { prompt: "宝可梦 pokemon 宠物对战", expected: "pokemon-battle" },
  { prompt: "口袋妖怪精灵对战", expected: "pokemon-battle" },

  // ── 过山车
  { prompt: "过山车大亨 rollercoaster tycoon 建设", expected: "coaster" },
  { prompt: "矿车竞速 3D 轨道飞车", expected: "coaster" },

  // ── 无匹配（返回 null，由 LLM 决定）
  { prompt: "做一个有趣的游戏", expected: null },
  { prompt: "帮我做一个有中国风的游戏", expected: null },
  { prompt: "深海探险游戏", expected: null },
];

let pass = 0;
let fail = 0;

for (const c of CASES) {
  const result = detectTemplateFromPrompt(c.prompt);
  const ok = result === c.expected;
  if (ok) {
    pass++;
  } else {
    fail++;
    const label = c.label ?? c.prompt.slice(0, 40);
    console.error(`[FAIL] "${label}"`);
    console.error(`       expected: ${c.expected ?? "null"}, got: ${result ?? "null"}`);
  }
}

console.log(`\n✅ ${pass}/${CASES.length} passed, ❌ ${fail} failed`);

if (fail > 0) {
  process.exit(1);
}
