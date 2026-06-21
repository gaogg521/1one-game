/**
 * 规则驱动的模板预选器：在 LLM 生成前确定 templateId，减少路由错误。
 * 返回置信度高的模板 ID；返回 null 表示交给 LLM 自行判断。
 */
import type { GameTemplateId } from "@/lib/game-templates/registry";

type Rule = {
  templateId: GameTemplateId;
  /** 命中任意一个关键词即触发 */
  keywords: string[];
  /** 优先级（数值越大越优先） */
  priority: number;
};

const RULES: Rule[] = [
  // ── 塔防（最高优先，因为"僵尸+植物"很容易被误判为 survivor）
  {
    templateId: "towerDefense",
    priority: 100,
    keywords: [
      "保卫萝卜", "植物大战僵尸", "pvz", "plants vs zombies", "豌豆射手", "豌豆", "向日葵", "坚果墙", "寒冰菇",
      "kingdom rush", "王国保卫战", "皇家守卫军", "猴子塔防", "bloons", "btd",
      "放置防守", "造塔", "建塔", "塔防", "箭塔", "波次敌人", "建防线",
      "路径防守", "迎击波次", "种植物打僵尸", "炮塔防守",
      "tower defense", "tower defence", "defense tower", "plant tower", "defend against waves",
    
      "守家", "守基地", "抵御入侵", "抵挡波次", "怪来袭守", "怪物攻城", "城防", "塔楼防御", "建塔防守", "炮塔", "防御塔", "塔防游戏", "td游戏", " defend base", "wave defense", "build towers", "stop waves", "base defense",],
  },
  // ── 平台跳跃
  {
    templateId: "platformer",
    priority: 90,
    keywords: [
      "超级玛丽", "马里奥", "super mario", "索尼克", "sonic", "恶魔城", "castlevania",
      "银河恶魔城", "metroidvania", "几何冲刺", "geometry dash", "空洞骑士", "hollow knight",
      "蔚蓝", "celeste", "横版跳跃", "平台闯关", "多层地形", "跑酷关卡",
    
      "跳台", "跳跃闯关", "平台跳跃", "横版过关", "横版冒险", "2d平台", "跳来跳去", "跳平台", "关卡跳跃", "地形跳跃", "跳关", "platform game", "jump platform", "side scroller", "2d platformer",],
  },
  // ── 射击飞机
  {
    templateId: "shooter",
    priority: 92,
    keywords: [
      "雷电", "1942", "太空侵略者", "space invaders", "东方project", "弹幕射击",
      "合金弹头", "metal slug", "星际飞机", "飞机大战", "飞船", "太空战",
      "消灭敌机", "竖版飞行", "竖版射击", "击落敌机",
      "raiden", "vertical shooter", "shoot em up", "shmup", "aircraft battle", "plane shooter",
      // 经典俯视角射击（Battle City 风格）
      "坦克大战", "坦克战", "经典坦克", "战车大战", "战车对战", "battle city",
      "battlecity", "tank battle", "坦克射击", "俯视角射击", "tank shooter",
    
      "打飞机", "飞行射击", "射击飞机", "空战", "战机", "射击敌人", "射击敌机", "子弹射击", "开火射击", "飞船射击", "太空射击", "星际射击", "shoot enemies", "blast ships", "space shoot", "bullet hell",],
  },
  // ── 吸血鬼幸存者类
  {
    templateId: "survivor",
    priority: 96,
    keywords: [
      "吸血鬼幸存者", "vampire survivors", "黎明前20分钟", "20 minutes till dawn",
      "弹壳特攻队", "割草", "不断刷怪", "尽量活久", "坚持活下去",
    
      "生存", "活下去", "活到最后", "坚持生存", "末日生存", "求生", "不断刷怪活", "越拖越难", "生存挑战", "生存压力", "survive", "stay alive", "last stand", "survival game",],
  },
  // ── 消除/益智
  {
    templateId: "puzzle",
    priority: 70,
    keywords: [
      "消消乐", "三消", "candy crush", "宝石迷阵", "bejeweled", "连连看",
      "记忆翻牌", "数独", "消除游戏", "拼图",
      "推箱子", "sokoban", "华容道", "2048", "扫雷", "minesweeper",
    
      "解谜", "益智", "动脑", "脑筋急转弯", "逻辑 puzzle", "机关谜题", "推方块", "压力板", "开关门", "钥匙开门", "puzzle game", "brain teaser", "logic puzzle",],
  },
  // ── 棋类
  {
    templateId: "chess",
    priority: 65,
    keywords: [
      "中国象棋", "象棋", "围棋", "国际象棋", "chess", "五子棋",
    
      "下棋", "对弈", "棋盘对局", "棋类对局", "将死", "将军", "走棋", "play chess", "chess game", "board game chess",],
  },
  // ── 农场
  {
    templateId: "farming",
    priority: 60,
    keywords: [
      "星露谷", "stardew valley", "种地", "农场", "农业", "灌溉", "收获季",
      "丰收", "开心农场", "种菜", "耕地",
    
      "种田", "种庄稼", "耕种", "务农", "农场经营", "浇水", "施肥", "收割", "播种", "养殖", "farm game", "farming sim", "harvest", "plant crops",],
  },
  // ── 策略/RTS
  {
    templateId: "strategy",
    priority: 55,
    keywords: [
      "文明", "civilization", "部落冲突", "clash of clans", "即时战略", "rts",
      "占领节点", "领地控制", "节点控制", "战略扩张",
      "红警", "红色警戒", "命令与征服", "星际争霸", "starcraft", "魔兽争霸",
      "warcraft", "帝国时代", "age of empires",
    
      "战略", "打仗", "征服", "扩张领土", "占领地盘", "指挥军队", "调兵遣将", "排兵布阵", "战略游戏", "战争策略", "war strategy", "conquest", "territory", "command army",],
  },
  // ── 躲避类（炸弹人、推箱子、扫雷式）
  {
    templateId: "avoider",
    priority: 40,
    keywords: [
      "炸弹人", "bomberman", "泡泡龙", "puzzle bobble", "躲避弹幕",
    
      "躲避", "闪避", "避开", "躲开", "躲弹幕", "躲障碍", "走位躲避", "灵活躲避", "避开威胁", "dodge game", "avoid obstacles", "dodge bullets", "evade",],
  },
  // ── 过山车（priority 95：高于 racing 92 防止"矿车竞速"被 racing 抢；关键词本身精确）
  {
    templateId: "coaster",
    priority: 95,
    keywords: [
      "过山车", "过山车大亨", "rollercoaster tycoon", "矿车竞速", "3d轨道", "轨道飞车",
    
      "轨道车", "轨道赛车", "立体轨道", "悬空轨道", "rollercoaster", "roller coaster", "rail ride", "track ride",],
  },
  // ── 收集器（低优先，因为很多游戏都有"收集"概念）
  {
    templateId: "collector",
    priority: 30,
    keywords: [
      "吃豆人", "贪食蛇", "纯粹收集", "收集游戏",
    
      "收集", "捡东西", "拾取", "捡金币", "吃金币", "收集物品", "collect items", "gather", "pick up", "collect coins",],
  },
  // ── 赛车/竞速（明确点名才选；priority 92 高于 platformer 90 避免被"马里奥赛车"等复合词误夺）
  {
    templateId: "racing",
    priority: 92,
    keywords: [
      "赛车", "竞速", "f1", "卡丁车", "马里奥赛车", "mario kart", "跑车",
      "方程式", "拉力赛", "rally", "竞速游戏", "赛车游戏", "need for speed",
      "极品飞车", "granny Turismo", "gt赛车",
    
      "飙车", "车赛", "赛车比赛", "竞速比赛", "速度比赛", "圈速", "开车竞速", "比谁快", "race", "racing game", "speed race", "lap time",],
  },
  // ── 狙击（明确点名才选）
  {
    templateId: "sniper",
    priority: 45,
    keywords: [
      "狙击", "sniper", "狙击精英", "sniper elite", "瞄准镜", "精准射击",
      "远程狙击", "狙击手", "狙击枪", "狙击游戏",
    
      "远程射击", "远距离射击", "瞄准目标", "狙击目标", "爆头", "瞄准镜射击", "高精度射击", "一枪一个", "snipe", "sniper shot", "long range shot", "headshot",],
  },
  // ── 潜行（明确点名才选）
  {
    templateId: "stealth",
    priority: 45,
    keywords: [
      "潜行", "隐身", "刺杀", "不被发现", "stealth", "合金装备", "metal gear",
      "splinter cell", "细胞分裂", "忍者潜入", "潜行游戏",
    
      "偷偷摸摸", "悄悄走", "潜入", "暗杀", "避开守卫", "避开视野", " sneak", "infiltrate", "assassinate",],
  },
  // ── 物理（弹射/弹球，明确点名才选）
  {
    templateId: "physics",
    priority: 45,
    keywords: [
      "愤怒的小鸟", "angry birds", "弹射", "弹球", "碰碰球", "台球",
      "弹射游戏", "投掷物理", "弹弓", "physical game",
    
      "物理引擎", "物理弹射", "弹弓发射", "投掷", "抛物线", "重力", "碰撞", "摆动", "angry birds style", "physics game",],
  },
  // ── 自定义（捏脸/换装，明确点名才选）
  {
    templateId: "customization",
    priority: 45,
    keywords: [
      "捏脸", "换装", "角色自定义", "服装设计", "character creator",
      "avatar maker", "换装游戏", "捏脸游戏", "造型定制",
    
      "打扮", "装扮", "造型", "自定义角色", "dress up", "avatar", "customize character", "makeover",],
  },

  // ─────────────────────────────────────────────────────
  // 全球主流小游戏扩展（30 个新模板）
  // ─────────────────────────────────────────────────────

  // ── 节奏音游
  {
    templateId: "rhythm",
    priority: 92,
    keywords: [
      "节奏音游", "节奏游戏", "节奏大师", "音游", "osu", "cytus", "deemo",
      "beatmania", "太鼓达人", "taiko", "djmax", "rhythm game",
      "节奏光剑", "beat saber", "钢琴块", "piano tiles", "别踩白块",
    
      "踩拍", "踩点", "节奏感", "跟着音乐", "音乐节奏", "打节拍", "音符下落", "按键节奏", "rhythm", "beat game", "music game",],
  },
  // ── 体育运动
  {
    templateId: "sports",
    priority: 88,
    keywords: [
      "篮球", "投篮", "三分球", "扣篮", "basketball", "hoop shot", "free throw",
      "足球", "射门", "点球", "penalty", "soccer", "football kick",
      "网球", "tennis", "挥拍",
      "保龄球", "bowling",
      "高尔夫", "golf", "推杆", "putt",
    
      "体育运动", "竞技体育", "球类", "球场", "运动员", "体育比赛", "sport game", "athletic", "ball game",],
  },
  // ── 卡牌战斗
  {
    templateId: "card",
    priority: 88,
    keywords: [
      "炉石", "hearthstone", "万智牌", "magic the gathering",
      "卡牌", "打牌", "出牌", "抽牌", "card battle", "card game", "tcg", "ccg",
    
      "卡牌游戏", "卡牌对战", "卡牌战斗", "playing cards",],
  },
  // ── 格斗
  {
    templateId: "fighting",
    priority: 88,
    keywords: [
      "街霸", "street fighter", "拳皇", "king of fighters", "kof",
      "真人快打", "mortal kombat", "格斗", "对战格斗", "fighting game",
      "清版", "beat em up",
    
      "拳脚", "出招", "连招", "格斗游戏", "fight", "fighting", "martial arts", "combat 1v1",],
  },
  // ── MOBA 1v1
  {
    templateId: "moba",
    priority: 88,
    keywords: [
      "英雄联盟", "league of legends", "lol游戏", "dota", "王者荣耀",
      "honor of kings", "mobile legends", "moba", "英雄对战", "5v5", "推塔",
    
      "三路", "对线", "打野", "团战", "moba game", "push tower", "hero battle", "lane battle",],
  },
  // ── 恐怖监控
  {
    templateId: "horror",
    priority: 88,
    keywords: [
      "five nights", "fnaf", "freddy", "玩具熊的五夜后宫",
      "恐怖", "惊悚", "jump scare", "吓人", "恐怖游戏", "horror game",
    
      "灵异", "鬼怪", "黑暗", "阴森", "horror", "scary", "creepy", "spooky",],
  },

  // ── 复用 family 的主流 templateId（24 个）

  // 俄罗斯方块
  {
    templateId: "tetris",
    priority: 96,
    keywords: ["俄罗斯方块", "tetris", "方块下落",
      "下落方块", "消行", "填方块", "俄罗斯", "tetris game", "block game", "line clear",],
  },
  // 打砖块
  {
    templateId: "breakout",
    priority: 96,
    keywords: ["打砖块", "breakout", "arkanoid", "brick breaker",
      "弹球打砖", "挡板反弹", "砖墙", "消除砖块", "block breaker",],
  },
  // 乒乓
  {
    templateId: "pong",
    priority: 96,
    keywords: ["pong", "乒乓", "paddle ball",
      "两挡板", "球来回", "对打乒乓", "paddle", "pong game", "table tennis game",],
  },
  // 打地鼠
  {
    templateId: "whack-a-mole",
    priority: 96,
    keywords: ["打地鼠", "whack a mole", "锤地鼠",
      "砸地鼠", "地鼠冒头", "敲地鼠", "whack mole", "hit mole", "mole game",],
  },
  // 合并升级（Suika / 合成风；2048 归 puzzle）
  {
    templateId: "merge",
    priority: 96,
    keywords: [
      "数字合成", "数字合并", "number merge", "merge numbers",
      "suika", "西瓜合成", "合成西瓜", "merge fruit", "水果合并", "合并升级", "merge game", "合成游戏",
    
      "合成", "合并", "合成大西瓜", "merge blocks", "combine numbers",],
  },
  // 点击放置
  {
    templateId: "idle",
    priority: 96,
    keywords: [
      "放置", "挂机", "idle", "clicker", "clicking game", "cookie clicker", "点击游戏", "tap game",
    
      "点击放置", "自动产出", "离线收益", "idle game", "incremental",],
  },
  // 烹饪经营
  {
    templateId: "cooking",
    priority: 92,
    keywords: [
      "烹饪", "做饭", "厨房", "cooking", "chef", "cook game", "diner",
      "厨房经营", "料理", "餐厅", "restaurant", "经营餐厅",
    
      "炒菜", "厨师", "cook", "chef game", "kitchen game", "cooking game",],
  },
  // 大亨经营
  {
    templateId: "tycoon",
    priority: 92,
    keywords: [
      "大亨", "tycoon", "theme park", "rollercoaster tycoon", "sim city",
      "经营游戏", "management game", "经营",
    
      "管理", "建造经营", "tycoon game", "management", "business sim",],
  },
  // 宠物养成
  {
    templateId: "pet",
    priority: 92,
    keywords: [
      "宠物", "养成宠物", "pet game", "tamagotchi", "电子宠物", "拓麻歌子",
      "养猫", "养狗", "猫咪养成", "puppy", "kitten raise",
    
      "养宠物", "宠物养成", "raise pet", "virtual pet",],
  },
  // 恋爱模拟
  {
    templateId: "dating-sim",
    priority: 92,
    keywords: [
      "恋爱模拟", "dating sim", "视觉小说", "visual novel", "galgame", "乙女", "恋爱", "相亲", "dating game",
    
      "约会", "谈恋爱", "好感度", "dating", "romance",],
  },
  // 自走棋
  {
    templateId: "auto-battler",
    priority: 96,
    keywords: ["自走棋", "auto battler", "auto chess", "teamfight tactics", "tft", "云顶之弈",
      "自动战斗", "布阵自动打", "羁绊", "auto battle",],
  },
  // 回合制策略
  {
    templateId: "turn-based",
    priority: 92,
    keywords: [
      "回合制", "turn based", "fire emblem", "火焰纹章", "advance wars", "高级战争", "文明回合",
    
      "回合对战", "你一回合我一回合", "turn game", "tactical rpg",],
  },
  // 沙盒建造
  {
    templateId: "sandbox",
    priority: 92,
    keywords: ["沙盒", "sandbox", "我的世界创造", "minecraft creative", "创造模式",
      "自由建造", "我的世界", "minecraft", "sandbox game", "creative mode", "build freely",],
  },
  // 滑雪
  {
    templateId: "skiing",
    priority: 92,
    keywords: ["滑雪", "skiing", "ski game", "阿尔卑斯", "downhill ski",
      "雪山", "下坡", "滑下坡", "ski", "skiing game", "downhill",],
  },
  // 扑克
  {
    templateId: "poker",
    priority: 96,
    keywords: ["扑克", "poker", "德州扑克", "texas hold", "梭哈", "stud poker",
      "下注", "牌局", "texas holdem", "bet",],
  },
  // 接龙
  {
    templateId: "solitaire",
    priority: 96,
    keywords: ["接龙", "solitaire", "klondike", "蜘蛛纸牌", "spider solitaire",
      "纸牌接龙", "单人纸牌", "card sort",],
  },
  // 21 点
  {
    templateId: "blackjack",
    priority: 96,
    keywords: ["21点", "blackjack", "二十一点",
      "要牌停牌", "逼近21", "21 game", "beat dealer",],
  },
  // 字谜
  {
    templateId: "word-game",
    priority: 92,
    keywords: ["字谜", "wordle", "word game", "拼字", "crossword", "填字", "猜词",
      "word puzzle",],
  },
  // 密室逃脱
  {
    templateId: "escape-room",
    priority: 92,
    keywords: ["密室", "escape room", "逃脱房间", "解谜房间",
      "解谜逃脱", "找线索", "开锁", "room escape", "break out",],
  },
  // 找茬
  {
    templateId: "hidden-object",
    priority: 92,
    keywords: ["找茬", "hidden object", "spot the difference", "whimsy",
      "找东西", "找隐藏", "找物品", "spot difference", "find objects",],
  },
  // 暗黑刷怪
  {
    templateId: "hack-and-slash",
    priority: 95,
    keywords: ["暗黑", "diablo", "hack and slash", "刷装备", "地牢爬塔", "dungeon crawler",
      "刷怪", "地牢", "loot", "hack slash",],
  },
  // 魂斗罗式横版射击
  {
    templateId: "run-and-gun",
    priority: 95,
    keywords: ["魂斗罗", "contra", "run and gun", "合金弹头横版",
      "横版射击", "边跑边射", "side scrolling shooter",],
  },
  // 推理
  {
    templateId: "mystery",
    priority: 92,
    keywords: ["推理", "mystery", "detective", "侦探", "破案", "悬疑",
      "探案", "investigation",],
  },

  // ── 第三批主流扩展（15 个，复用现有 family）

  // 麻将（4 人麻将）
  {
    templateId: "mahjong",
    priority: 110,
    keywords: [
      "国标麻将", "日本麻将", "riichi", "richi麻将", "麻将对局", "打麻将",
      "四人麻将", "麻将", "mahjong", "four player mahjong", "4 player mahjong",
    
      "碰杠胡",],
  },
  // 麻将接龙/消除（priority 97 高于 solitaire 96 避免"接龙"误夺）
  {
    templateId: "mahjong-solitaire",
    priority: 115,
    keywords: ["麻将接龙", "麻将消除", "麻将连连看", "mahjong solitaire", "mahjong connect",
      "配对麻将", "tile match",],
  },
  // 斗地主（priority 125 高于 poker 96 避免"扑克"误夺；priority 125 高于 card 88 避免被"卡牌"误夺）
  // 注：不放"出牌"——太泛，会误夺 UNO/扑克等其他出牌类
  {
    templateId: "dou-dizhu",
    priority: 125,
    keywords: [
      "斗地主", "都斗地主", "dou dizhu", "dou di zhu", "斗地主游戏",
      "fight the landlord", "landlord card",
      "叫地主", "春天反春", "春反", "地主牌", "农民",
      "三人牌", "三人扑克", "三人斗地主",
      "bid landlord", "spring counter", "three player poker", "three player card",
    
      "地主农民",],
  },
  // UNO
  {
    templateId: "uno",
    priority: 125,
    keywords: ["uno", "乌诺牌", "优诺牌",
      "颜色匹配出牌", "uno cards",],
  },
  // 跳棋（国际跳棋）
  {
    templateId: "checkers",
    priority: 95,
    keywords: ["国际跳棋", "跳棋", "checkers", "draughts",
      "斜走跳吃",],
  },
  // 中国跳棋
  {
    templateId: "chinese-checkers",
    priority: 96,
    keywords: ["中国跳棋", "chinese checkers", "六角跳棋",
      "跨跳",],
  },
  // 军棋
  {
    templateId: "junqi",
    priority: 95,
    keywords: ["军棋", "陆战棋", "land battle chess", "junqi",
      "暗棋", "夺军旗", "land battle",],
  },
  // 飞行棋
  {
    templateId: "aeroplane-chess",
    priority: 95,
    keywords: ["飞行棋", "飞机棋", "aeroplane chess", "airplane chess",
      "掷骰起飞",],
  },
  // 无尽跑酷
  {
    templateId: "endless-runner",
    priority: 95,
    keywords: [
      "神庙逃亡", "temple run", "地铁跑酷", "subway surfers",
      "无尽跑酷", "endless runner", "酷跑", "跑酷游戏",
    
      "三道跑酷", "左右切道", "跑酷",],
  },
  // 水果忍者
  {
    templateId: "fruit-ninja",
    priority: 96,
    keywords: ["水果忍者", "fruit ninja", "切水果", "削水果",
      "砍水果", "切西瓜", "飞刀切水果", "滑动切割", "水果飞过来切", "slice fruit",],
  },
  // 割绳子
  {
    templateId: "cut-the-rope",
    priority: 115,
    keywords: ["割绳子", "割绳", "切绳子", "切绳", "cut the rope", "cut rope", "喂小怪兽", "喂怪兽", "切绳喂",
      "糖果摆动",],
  },
  // 填色
  {
    templateId: "coloring",
    priority: 92,
    keywords: ["填色", "涂色", "coloring", "color by number", "数字填色", "涂色画",
      "画色", "paint by number",],
  },
  // 花园种植（priority 110 高于 tycoon 92 避免"经营"误夺）
  {
    templateId: "garden",
    priority: 110,
    keywords: ["花园", "garden game", "种花", "花园经营", "花园模拟",
      "花园装饰", "种花浇水", "flower garden",],
  },
  // 咖啡馆（priority 93 高于 tycoon 92 避免"经营"误夺）
  {
    templateId: "cafe",
    priority: 93,
    keywords: ["咖啡馆", "cafe", "咖啡店", "咖啡经营", "coffee shop",
      "接单做咖啡", "barista",],
  },
  // 宠物对战
  {
    templateId: "pokemon-battle",
    priority: 95,
    keywords: ["宝可梦", "pokemon", "口袋妖怪", "宠物对战", "宠物小精灵", "精灵对战",
      "pokemon battle", "creature battle",],
  },
];

/**
 * 从用户 prompt 中规则匹配最高优先级的模板 ID。
 * 返回 null 表示无高置信命中，交由 LLM 决定。
 */
export function detectTemplateFromPrompt(prompt: string): GameTemplateId | null {
  const normalized = prompt.toLowerCase().replace(/\s+/g, "");
  let best: Rule | null = null;
  const matches: Array<{ templateId: GameTemplateId; priority: number; keyword: string }> = [];

  for (const rule of RULES) {
    const hit = rule.keywords.some((kw) => normalized.includes(kw.toLowerCase().replace(/\s+/g, "")));
    if (hit) {
      const hitKeyword = rule.keywords.find((kw) => normalized.includes(kw.toLowerCase().replace(/\s+/g, ""))) || "";
      matches.push({ templateId: rule.templateId, priority: rule.priority, keyword: hitKeyword });
      if (!best || rule.priority > best.priority) {
        best = rule;
      }
    }
  }

  // 调试日志：当有多个匹配时，记录详情（便于诊断路由错误）
  if (matches.length > 1) {
    console.debug(`[template-selector] 多个匹配: ${matches.map((m) => `${m.templateId}(${m.priority}|"${m.keyword}"`).join(", ")}; 选中: ${best?.templateId}`);
  }

  return best?.templateId ?? null;
}
