/**
 * 模板路由回归夹具：对每个模板跑典型 prompt，断言三套检测器一致命中预期 templateId。
 *
 * 用法：npx tsx scripts/test-template-routing.ts
 *
 * 失败时输出冲突详情，便于定位"路由漂移"。
 * 新增模板时在 CASES 里追加一条典型 prompt。
 */
import { detectTemplateFromPrompt } from "../src/lib/template-selector";
import { inferTemplateFromPrompt } from "../src/lib/game-templates/infer";
import { selectGenrePack } from "../src/lib/creative-brief/genre-packs";

type Case = {
  templateId: string;
  prompt: string;
  /** genre pack 期望（"default" 表示不命中任何 pack，走 DEFAULT_GENRE_PACK） */
  pack?: string;
  /** 允许 infer 返回这个 templateId 或同 family 的另一个 id（如 uno→card 也算通过） */
  inferAccept?: string[];
};

const CASES: Case[] = [
  // 动作 / 射击
  { templateId: "towerDefense", prompt: "保卫萝卜风格的塔防游戏，种植物打僵尸，多波次防守", pack: "tower-defense" },
  { templateId: "shooter", prompt: "雷电式竖版飞机大战，击落敌机波次" },
  { templateId: "platformer", prompt: "超级玛丽风格横版平台跳跃闯关", pack: "platformer-adventure" },
  { templateId: "survivor", prompt: "吸血鬼幸存者风格，割草不断刷怪坚持活下去", pack: "horror-survival" },

  // 卡牌真玩法（用户报告的斗地主 bug 类）
  { templateId: "dou-dizhu", prompt: "斗地主三人扑克，叫地主出牌比大小，支持春天反春，AI 互助配合" },
  { templateId: "mahjong", prompt: "四人麻将，万条筒 108 张，摸打碰杠胡，听牌提示" },
  { templateId: "mahjong-solitaire", prompt: "麻将接龙消除，选相同牌配对消除，层叠解锁" },
  { templateId: "uno", prompt: "UNO 卡牌游戏，颜色数字匹配出牌，剩 1 张喊 UNO" },
  { templateId: "poker", prompt: "德州扑克，押注比牌型大小" },
  { templateId: "solitaire", prompt: "纸牌接龙，堆叠排序完成花色" },
  { templateId: "blackjack", prompt: "21 点，要牌比点数，庄家 AI" },

  // 棋类
  { templateId: "chess", prompt: "中国象棋，楚河汉界红黑对弈" },
  { templateId: "checkers", prompt: "国际跳棋，斜走跳吃" },
  { templateId: "chinese-checkers", prompt: "中国跳棋，六角星棋盘" },
  { templateId: "junqi", prompt: "军棋陆战棋，明暗棋对弈" },
  { templateId: "aeroplane-chess", prompt: "飞行棋，飞机棋四人轮流" },

  // 益智
  { templateId: "tetris", prompt: "俄罗斯方块，方块下落消行" },
  { templateId: "breakout", prompt: "打砖块，反弹球击碎砖墙" },
  { templateId: "merge", prompt: "合成西瓜 Suika，水果合并升级" },
  { templateId: "puzzle", prompt: "开心消消乐三消，糖果消除" },
  { templateId: "word-game", prompt: "Wordle 字谜，猜 5 字母单词" },
  { templateId: "escape-room", prompt: "密室逃脱，解谜房间找线索" },
  { templateId: "hidden-object", prompt: "找茬 hidden object，找图中隐藏物品" },
  { templateId: "mystery", prompt: "侦探推理破案，悬疑解谜" },

  // 跑酷 / 运动
  { templateId: "endless-runner", prompt: "地铁跑酷神庙逃亡，无尽跑酷闪避" },
  { templateId: "fruit-ninja", prompt: "水果忍者，切水果削水果" },
  { templateId: "cut-the-rope", prompt: "割绳子喂小怪兽" },
  { templateId: "racing", prompt: "极品飞车赛车竞速" },
  { templateId: "skiing", prompt: "滑雪 downhill ski 阿尔卑斯" },
  { templateId: "sports", prompt: "篮球投篮三分球扣篮" },

  // 经营 / 养成
  { templateId: "farming", prompt: "星露谷物语，种地农场收获" },
  { templateId: "cooking", prompt: "烹饪厨房经营餐厅，做料理" },
  { templateId: "cafe", prompt: "咖啡馆经营，coffee shop" },
  { templateId: "tycoon", prompt: "主题公园大亨，sim city 经营" },
  { templateId: "pet", prompt: "电子宠物拓麻歌子，养猫养狗" },
  { templateId: "dating-sim", prompt: "恋爱模拟视觉小说，乙女相亲" },
  { templateId: "customization", prompt: "捏脸换装角色自定义，avatar maker" },
  { templateId: "coloring", prompt: "数字填色涂色画，color by number" },
  { templateId: "garden", prompt: "花园种植经营，种花" },
  { templateId: "idle", prompt: "放置挂机点击游戏，cookie clicker" },
  { templateId: "sandbox", prompt: "沙盒创造模式，我的世界 creative" },

  // 策略 / 回合
  { templateId: "strategy", prompt: "红警红色警戒即时战略，占领领地" },
  { templateId: "auto-battler", prompt: "自走棋 TFT 云顶之弈，自动对战" },
  { templateId: "turn-based", prompt: "火焰纹章回合制策略战棋" },
  { templateId: "pokemon-battle", prompt: "宝可梦宠物对战，精灵属性克制" },

  // 其他
  { templateId: "coaster", prompt: "过山车大亨，3D 空中轨道" },
  { templateId: "rhythm", prompt: "节奏光剑 beat saber，音游" },
  { templateId: "fighting", prompt: "街霸拳皇格斗对战" },
  { templateId: "moba", prompt: "王者荣耀 MOBA 5v5 推塔" },
  { templateId: "horror", prompt: "玩具熊五夜后宫 FNAF 恐怖监控" },
  { templateId: "hack-and-slash", prompt: "暗黑破坏神 Diablo 刷装备地牢爬塔" },
  { templateId: "run-and-gun", prompt: "魂斗罗 Contra run and gun 横版射击" },
  { templateId: "sniper", prompt: "狙击精英精准瞄准远程狙击" },
  { templateId: "stealth", prompt: "合金装备潜行刺杀不被发现" },
  { templateId: "physics", prompt: "愤怒的小鸟弹射弹球物理" },
  { templateId: "pong", prompt: "Pong 乒乓 paddle ball" },
  { templateId: "whack-a-mole", prompt: "打地鼠锤地鼠 whack a mole" },

  // ── i18n：英文 prompt 也应正确触发模板（验证非中文用户也能路由）──
  { templateId: "dou-dizhu", prompt: "Three-player card game, bid for the landlord role, play cards to compare sizes, support spring counter" },
  { templateId: "mahjong", prompt: "Four player mahjong, 108 tiles, draw match pong kong hu" },
  { templateId: "towerDefense", prompt: "Plants vs zombies style tower defense, plant towers to defend against zombie waves" },
  { templateId: "shooter", prompt: "Vertical shooter like Raiden, shoot down enemy aircraft waves" },
  { templateId: "platformer", prompt: "Super Mario style side-scrolling platformer, jump and collect" },
  { templateId: "tetris", prompt: "Tetris, falling blocks, clear lines" },
  { templateId: "puzzle", prompt: "Candy Crush style match 3, swap candies to eliminate" },
  { templateId: "chess", prompt: "Chinese chess Xiangqi, red vs black pieces" },
  { templateId: "endless-runner", prompt: "Subway surfers endless runner, dodge obstacles" },
  { templateId: "fruit-ninja", prompt: "Fruit Ninja, slice flying fruits" },
  { templateId: "cooking", prompt: "Cooking dash, run a restaurant kitchen" },
];

type Fail = { case: Case; reason: string; details?: unknown };

const fails: Fail[] = [];
let pass = 0;

for (const c of CASES) {
  const sel = detectTemplateFromPrompt(c.prompt);
  const inf = inferTemplateFromPrompt(c.prompt);
  const pack = selectGenrePack(c.prompt).id;

  const selOk = sel === c.templateId;
  const infOk = c.inferAccept
    ? c.inferAccept.includes(inf)
    : inf === c.templateId;
  const packOk = c.pack ? pack === c.pack : true;

  if (selOk && infOk && packOk) {
    pass += 1;
    continue;
  }

  const reasons: string[] = [];
  if (!selOk) reasons.push(`detectTemplateFromPrompt="${sel}" (期望 "${c.templateId}")`);
  if (!infOk) reasons.push(`inferTemplateFromPrompt="${inf}" (期望 "${c.inferAccept?.join("|") ?? c.templateId}")`);
  if (!packOk) reasons.push(`selectGenrePack="${pack}" (期望 "${c.pack}")`);
  fails.push({ case: c, reason: reasons.join("; "), details: { sel, inf, pack } });
}

console.log(`\n模板路由回归：${pass}/${CASES.length} 通过`);
if (fails.length) {
  console.log(`\n❌ ${fails.length} 个失败：\n`);
  for (const f of fails) {
    console.log(`  · [${f.case.templateId}] "${f.case.prompt.slice(0, 50)}"`);
    console.log(`    ${f.reason}`);
  }
  process.exit(1);
} else {
  console.log("✅ 全部通过");
}
