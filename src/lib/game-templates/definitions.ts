import type { GameTemplateDefinition } from "@/lib/game-templates/types";

/**
 * 新增玩法模板：在此追加一条定义 + 实现对应 Phaser 场景族 / Godot 场景（若需专用）。
 * 样品馆 sampleId 可写在 SAMPLE_TEMPLATE_OVERRIDES（sample-specs.ts）。
 */
export const GAME_TEMPLATE_DEFINITIONS: GameTemplateDefinition[] = [
  {
    id: "towerDefense",
    phaser: "towerDefense",
    godot: "towerDefense",
    godotExport: true,
    blueprint: "towerDefense",
    defaultSubtitle: "波次防守 · 构筑火力网",
    llmSummary: "塔防：路径行军 + 塔位建造升级 + 波次",
    infer: [
      { pattern: /植物大战僵尸|pvz|plants\s*vs\s*zombies|豌豆射手|向日葵|坚果墙/i, priority: 120 },
      {
        pattern:
          /塔防|保卫萝卜|防御塔|箭塔|炮塔|放置塔|波次防守|防线|塔位|建造防御|放置防守|抵御入侵|kingdom rush|王国保卫战|猴子塔防|bloons|\btd\b|tower\s*defen[cs]e/i,
        priority: 110,
      },
      { pattern: /合并.*枪|gun merge|merge.*僵尸|blade defender|合成.*塔/i, priority: 95 },
    ],
  },
  {
    id: "coaster",
    phaser: "coaster",
    godot: "coaster",
    godotExport: true,
    blueprint: "coaster",
    defaultSubtitle: "空中轨道 · 速度冲刺 · 计时完赛",
    llmSummary: "3D 空中轨道/过山车：Boost/Brake、计时完赛、第三人称",
    infer: [
      { pattern: /rail in air|空中轨道|过山车|過山車|coaster|轨道路|minecart|矿车|立体悬空.*轨道/i, priority: 115 },
    ],
  },
  {
    id: "racing",
    phaser: "coaster",
    godot: "coaster",
    godotExport: true,
    blueprint: "coaster",
    defaultSubtitle: "竞速冲刺 · 计时挑战",
    llmSummary: "轨道/赛道竞速（与 coaster 同引擎，偏计时）",
    infer: [
      { pattern: /神庙逃亡|temple run|temple runner|地铁跑酷|三线.*跑酷|lane runner|无尽跑酷|endless.*runner|跑道.*闪避/i, priority: 105 },
      { pattern: /竞速|赛车|racing|赛道|圈速|计时赛|crashy roads|无尽公路|撞车/i, priority: 75 },
    ],
  },
  {
    id: "shooter",
    phaser: "shooter",
    godot: "shooter",
    godotExport: true,
    defaultSubtitle: "射击迎击 · 波次升级",
    llmSummary: "俯视角/竖版射击，波次敌群与火力窗口",
    infer: [
      {
        pattern:
          /飞机大战|飞机游戏|空战|航空战|飞行射击|flight\s*battle|plane\s*battle|air\s*combat|aircraft\s*battle/i,
        priority: 115,
      },
      { pattern: /tiny planet|chopper|直升机|太空战|打飞机|1942|雷电|raiden|space invaders/i, priority: 90 },
      { pattern: /狙击|sniper|瞄准|第一人称.*射|over-shoulder/i, priority: 88 },
      {
        pattern:
          /射击|飞船|敌机|战机|消灭敌机|竖版射击|俯视角射击|合金弹头|shooter|stg/i,
        priority: 85,
      },
    ],
  },
  {
    id: "sniper",
    phaser: "shooter",
    godot: "shooter",
    godotExport: true,
    defaultSubtitle: "狙击瞄准 · 有限子弹 · 星级评价",
    llmSummary: "狙击/瞄准射击关卡（映射 shooter 运行时）",
    infer: [
      { pattern: /blocky\s*sniper|低多边形狙击|狙击猎人|狙击精英|sniper\s*elite|狙击手|狙击枪|瞄准镜|远程狙击|精准射击|狙击游戏/i, priority: 115 },
    ],
  },
  {
    id: "platformer",
    phaser: "platformer",
    godot: "platformer",
    godotExport: true,
    defaultSubtitle: "关卡推进 · 平台跳跃",
    llmSummary: "横版平台跳跃闯关，收集与陷阱",
    infer: [
      {
        pattern:
          /平台跳跃|跳台|横版闯关|超级玛丽|马里奥|mario|索尼克|sonic|恶魔城|metroidvania|空洞骑士|celeste|geometry dash|platformer|闯关|跑酷闯关|二段跳/i,
        priority: 80,
      },
    ],
  },
  {
    id: "stealth",
    phaser: "platformer",
    godot: "platformer",
    godotExport: true,
    defaultSubtitle: "潜行窃取 · 物理摆荡",
    llmSummary: "潜行/摆荡物理关卡（映射 platformer 运行时）",
    infer: [{ pattern: /潜行|elastic thief|偷取|守卫.*激光|摆荡/i, priority: 82 }],
  },
  {
    id: "strategy",
    phaser: "strategy",
    godot: "strategy",
    godotExport: true,
    blueprint: "strategy",
    defaultSubtitle: "区域争夺 · 派兵占领",
    llmSummary: "地图节点征服/派兵策略",
    infer: [
      { pattern: /征服|策略|派兵|占领.*区域|state conquest|地图.*节点|红警|红色警戒|命令与征服|星际争霸|魔兽争霸|帝国时代|civilization|文明|部落冲突|clash\s*of\s*clans|即时战略|\brts\b|领地控制|节点控制|战略扩张|starcraft|warcraft|age\s*of\s*empires/i, priority: 95 },
    ],
  },
  {
    id: "farming",
    phaser: "farming",
    godot: "farming",
    godotExport: true,
    blueprint: "farming",
    defaultSubtitle: "种植养成 · 浇水收获",
    llmSummary: "网格种植/浇水/收获/轻度经济",
    infer: [{ pattern: /种植|农场|garden|grow a garden|播种|浇水|收获|养成模拟/i, priority: 90 }],
  },
  {
    id: "puzzle",
    phaser: "puzzle",
    godot: "puzzle",
    godotExport: true,
    blueprint: "puzzle",
    defaultSubtitle: "益智解谜 · 连锁消除",
    llmSummary: "消除/找不同/记忆配对/拼图等益智",
    infer: [
      { pattern: /2048|数字合成|数字合并|number merge|merge numbers/i, priority: 95 },
      { pattern: /找不同|spot the difference|whimsy differences/i, priority: 93 },
      { pattern: /记忆配对|memory match|翻牌配对/i, priority: 91 },
      { pattern: /儿童.*拼图|kids puzzle|jigsaw|拼图小游戏|拖拽.*拼图/i, priority: 90 },
      { pattern: /数独|sudoku|填数|扫雷|minesweeper|华容道|滑块.*拼图|滑动拼图/i, priority: 89 },
      { pattern: /打地鼠|whack.?a.?mole|地鼠|锤地鼠/i, priority: 88 },
      { pattern: /3消|三消|消消乐|糖果传奇|candy crush|bejeweled|宝石消除/i, priority: 87 },
      { pattern: /消除|益智|puzzle|match.?3|bloomy|color bloom|连连看/i, priority: 84 },
    ],
  },
  {
    id: "chess",
    phaser: "chess",
    godot: "chess",
    godotExport: true,
    defaultSubtitle: "棋类对弈 · 合法走法提示",
    llmSummary: "棋类/回合策略盘面",
    infer: [{ pattern: /围棋|斗兽棋|动物棋|国际象棋|象棋|chess|go board|baduk|jungle chess|将杀|将军提示/i, priority: 94 }],
  },
  {
    id: "customization",
    phaser: "customization",
    godot: "customization",
    godotExport: true,
    defaultSubtitle: "涂色定制 · 随机配色",
    llmSummary: "涂色/调色盘定制",
    infer: [{ pattern: /涂色|调色|color palette|填色|配色定制|换装|角色自定义|造型定制|avatar maker|捏脸|服装设计/i, priority: 87 }],
  },
  {
    id: "physics",
    phaser: "physics",
    godot: "physics",
    godotExport: true,
    defaultSubtitle: "物理发泄 · 连击反馈",
    llmSummary: "物理互动/打击假人/解压",
    infer: [
      { pattern: /dummy|假人|解压|物理.*打|smash|发泄|连击.*粒子|愤怒的小鸟|angry\s*birds|弹射|弹球|碰碰球|台球|弹弓|投掷物理|弹射游戏/i, priority: 110 },
    ],
  },
  {
    id: "survivor",
    phaser: "arena",
    godot: "survivor",
    arenaMode: "survivor",
    godotExport: true,
    defaultSubtitle: "越撑越险 · 生存压力",
    llmSummary: "生存模式，生命值与持久压力",
    infer: [
      {
        pattern:
          /生存|血条|多条命|尽量久|割草|吸血鬼幸存者|vampire survivors|黎明前20分钟|surviv|持久战|无尽模式/i,
        priority: 70,
      },
    ],
  },
  {
    id: "collector",
    phaser: "arena",
    godot: "collector",
    arenaMode: "collector",
    godotExport: true,
    defaultSubtitle: "收集冲刺 · 限时目标",
    llmSummary: "四向移动收集物并躲避威胁",
    infer: [
      { pattern: /捕鱼|钓鱼|打渔|捞鱼|fishing|fish.*catch|抓金币|抓宝石/i, priority: 75 },
      { pattern: /收集|捡|金币|宝石|吃豆|拾取|pac-man|贪食蛇|snake|collect|coin|gem/i, priority: 65 },
    ],
  },
  {
    id: "avoider",
    phaser: "arena",
    godot: "avoider",
    arenaMode: "avoider",
    godotExport: true,
    defaultSubtitle: "躲避威胁 · 撑到目标",
    llmSummary: "底部横移躲避落下物（默认回落模板）",
    infer: [
      { pattern: /弹幕闪避|弹幕躲避|避弹|子弹地狱|bullet.*hell|dodge.*bullet|flappy|像素鸟|别碰墙|别撞墙/i, priority: 92 },
      { pattern: /躲|落下|闪避|避开|躲避|dodge|avoid|fall|drop/i, priority: 50 },
    ],
  },

  // ─────────────────────────────────────────────────────
  // 全球主流小游戏扩展（6 个独立 family + 24 个复用 family templateId）
  // ─────────────────────────────────────────────────────

  // ── 节奏音游（独立 family）
  {
    id: "rhythm",
    phaser: "rhythm",
    godot: "rhythm",
    godotExport: true,
    blueprint: "rhythm",
    defaultSubtitle: "节奏音游 · 命中判定 · 连击",
    llmSummary: "节奏音游：多轨道节点下落 + 按键命中 + Perfect/Good/Miss 判定",
    infer: [
      { pattern: /节奏.*光剑|beat\s*saber|光剑.*节奏/i, priority: 95 },
      { pattern: /钢琴块|piano\s*tiles|别踩白块/i, priority: 94 },
      { pattern: /节奏|音游|osu|cytus|deemo|beatmania|太鼓达人|taiko|djmax|节奏大师|rhythm\s*game/i, priority: 92 },
    ],
  },

  // ── 体育运动（独立 family）
  {
    id: "sports",
    phaser: "sports",
    godot: "sports",
    godotExport: true,
    blueprint: "sports",
    defaultSubtitle: "体育竞技 · 投篮/射门/挥拍",
    llmSummary: "体育运动：篮球投篮/足球射门/网球对打等抛物线物理 + 命中计分",
    infer: [
      { pattern: /篮球|投篮|三分球|扣篮|basketball|hoop\s*shot|free\s*throw/i, priority: 95 },
      { pattern: /足球|射门|点球|penalty|soccer|football.*kick/i, priority: 95 },
      { pattern: /网球|tennis|挥拍|对打/i, priority: 92 },
      { pattern: /保龄球|bowling/i, priority: 92 },
      { pattern: /高尔夫|golf|推杆|putt/i, priority: 92 },
      { pattern: /体育|运动|sports/i, priority: 60 },
    ],
  },

  // ── 卡牌战斗（独立 family）
  {
    id: "card",
    phaser: "card",
    godot: "card",
    godotExport: true,
    blueprint: "card",
    defaultSubtitle: "卡牌对战 · 出牌策略 · 击败 AI",
    llmSummary: "卡牌战斗：手牌管理 + 法力消耗 + 攻防 + AI 对手",
    infer: [
      { pattern: /炉石|hearthstone|万智牌|magic.*the.*gathering/i, priority: 96 },
      { pattern: /卡牌|打牌|出牌|抽牌|card.*battle|card.*game|tcg|ccg/i, priority: 90 },
    ],
  },

  // ── 格斗（独立 family）
  {
    id: "fighting",
    phaser: "fighting",
    godot: "fighting",
    godotExport: true,
    blueprint: "fighting",
    defaultSubtitle: "格斗对战 · 普攻/重击/格挡",
    llmSummary: "1v1 横版格斗：血量 + 普攻/重击/格挡 + AI 对手",
    infer: [
      { pattern: /街霸|street\s*fighter|拳皇|king\s*of\s*fighters|kof|真人快打|mortal\s*kombat/i, priority: 96 },
      { pattern: /格斗|对战.*格斗|fighting\s*game|beat\s*em\s*up|清版/i, priority: 90 },
    ],
  },

  // ── MOBA 1v1（独立 family）
  {
    id: "moba",
    phaser: "moba",
    godot: "moba",
    godotExport: true,
    blueprint: "moba",
    defaultSubtitle: "英雄对战 · 技能组合 · 推塔获胜",
    llmSummary: "简化 MOBA：1v1 战斗 + 3 技能 + 推塔 + AI 英雄",
    infer: [
      { pattern: /英雄联盟|league\s*of\s*legends|lol游戏|dota|王者荣耀|honor\s*of\s*kings|mobile\s*legends/i, priority: 96 },
      { pattern: /moba|英雄.*对战|5v5|推塔/i, priority: 90 },
    ],
  },

  // ── 恐怖监控（独立 family）
  {
    id: "horror",
    phaser: "horror",
    godot: "horror",
    godotExport: true,
    blueprint: "horror",
    defaultSubtitle: "恐怖监控 · 切换摄像头 · 躲避跳跃惊吓",
    llmSummary: "FNAF 式监控：多摄像头切换 + AI 怪物随机出现 + 关门应对",
    infer: [
      { pattern: /five\s*nights|fnaf|freddy's|玩具熊的五夜后宫/i, priority: 96 },
      { pattern: /恐怖|惊悚|jump\s*scare|吓人|恐怖游戏|horror\s*game/i, priority: 90 },
    ],
  },

  // ── 复用现有 family 的主流 templateId（24 个，仅注册 + 路由）

  // 俄罗斯方块（独立 family，真方块下落玩法）
  {
    id: "tetris",
    phaser: "tetris",
    godot: "tetris",
    godotExport: true,
    blueprint: "tetris",
    defaultSubtitle: "方块下落 · 旋转消除 · 经典俄罗斯方块",
    llmSummary: "真俄罗斯方块：7 形 Tetromino + 旋转 + 行消除 + 7-bag + wall-kick",
    infer: [{ pattern: /俄罗斯方块|tetris|tetris-like|方块下落/i, priority: 96 }],
  },
  // 打砖块（独立 family，真挡板弹球玩法）
  {
    id: "breakout",
    phaser: "breakout",
    godot: "breakout",
    godotExport: true,
    blueprint: "breakout",
    defaultSubtitle: "弹球打砖块 · 经典街机",
    llmSummary: "真打砖块：挡板 + 弹球 + 砖块消除 + 多关卡",
    infer: [{ pattern: /打砖块|breakout|arkanoid|brick\s*breaker/i, priority: 115 }],
  },
  // 乒乓（复用 physics）
  {
    id: "pong",
    phaser: "physics",
    godot: "physics",
    godotExport: true,
    defaultSubtitle: "乒乓对打 · 经典街机",
    llmSummary: "乒乓：两挡板 + 球来回（复用 physics family）",
    infer: [{ pattern: /\bpong\b|乒乓|paddle\s*ball/i, priority: 96 }],
  },
  // 打地鼠（复用 puzzle）
  {
    id: "whack-a-mole",
    phaser: "puzzle",
    godot: "puzzle",
    godotExport: true,
    defaultSubtitle: "打地鼠 · 反应速度",
    llmSummary: "打地鼠：地鼠随机出现 + 锤击计分（复用 puzzle family）",
    infer: [{ pattern: /打地鼠|whack.?a.?mole|锤地鼠/i, priority: 96 }],
  },
  // 合并升级（独立 family，真 2048/Suika 合并玩法）
  {
    id: "merge",
    phaser: "merge2048",
    godot: "merge2048",
    godotExport: true,
    blueprint: "merge2048",
    defaultSubtitle: "合并升级 · 2048 / Suika 风",
    llmSummary: "真合并升级：2048 滑动合并 / Suika 水果合成",
    infer: [
      { pattern: /2048|数字合成|数字合并|number merge|merge numbers/i, priority: 96 },
      { pattern: /suika|西瓜合成|合成.*西瓜|merge.*fruit|水果合并/i, priority: 95 },
      { pattern: /合并.*升级|merge.*game|合成.*游戏/i, priority: 90 },
    ],
  },
  // 点击放置（复用 farming）
  {
    id: "idle",
    phaser: "farming",
    godot: "farming",
    godotExport: true,
    defaultSubtitle: "点击放置 · 资源累积",
    llmSummary: "放置点击：点击累积资源 + 升级自动化（复用 farming family）",
    infer: [
      { pattern: /放置|挂机|idle|clicker|clicking\s*game|cookie\s*clicker/i, priority: 96 },
      { pattern: /点击.*游戏|tap\s*game/i, priority: 90 },
    ],
  },
  // 烹饪经营（复用 farming）
  {
    id: "cooking",
    phaser: "farming",
    godot: "farming",
    godotExport: true,
    defaultSubtitle: "烹饪经营 · 接单做菜",
    llmSummary: "烹饪经营：接单 + 备料 + 上菜（复用 farming family）",
    infer: [
      { pattern: /烹饪|做饭|厨房|cooking|chef|cook\s*game|diner|厨房.*经营|料理/i, priority: 96 },
      { pattern: /餐厅|restaurant|经营.*餐厅/i, priority: 92 },
    ],
  },
  // 大亨经营（复用 strategy）
  {
    id: "tycoon",
    phaser: "strategy",
    godot: "strategy",
    godotExport: true,
    defaultSubtitle: "经营大亨 · 资源调度",
    llmSummary: "大亨经营：建店 + 雇员 + 收益扩张（复用 strategy family）",
    infer: [
      { pattern: /大亨|tycoon|theme\s*park|rollercoaster.*tycoon|sim\s*city|经营.*游戏/i, priority: 95 },
      { pattern: /经营|管理.*游戏|management\s*game/i, priority: 80 },
    ],
  },
  // 宠物养成（复用 farming）
  {
    id: "pet",
    phaser: "farming",
    godot: "farming",
    godotExport: true,
    defaultSubtitle: "宠物养成 · 喂养互动",
    llmSummary: "宠物养成：喂食 + 互动 + 成长（复用 farming family）",
    infer: [
      { pattern: /宠物|养成.*宠物|pet\s*game|tamagotchi|电子宠物|拓麻歌子/i, priority: 95 },
      { pattern: /养.*猫|养.*狗|猫咪.*养成|puppy|kitten\s*raise/i, priority: 92 },
    ],
  },
  // 恋爱模拟（复用 customization）
  {
    id: "dating-sim",
    phaser: "customization",
    godot: "customization",
    godotExport: true,
    defaultSubtitle: "恋爱模拟 · 对话选择",
    llmSummary: "恋爱模拟：角色对话 + 选项分支 + 好感度（复用 customization family）",
    infer: [
      { pattern: /恋爱.*模拟|dating\s*sim|视觉小说|visual\s*novel|galgame|乙女/i, priority: 95 },
      { pattern: /恋爱|相亲|dating\s*game/i, priority: 80 },
    ],
  },
  // 自走棋（复用 strategy）
  {
    id: "auto-battler",
    phaser: "strategy",
    godot: "strategy",
    godotExport: true,
    defaultSubtitle: "自走棋 · 自动战斗",
    llmSummary: "自走棋：购买棋子 + 自动战斗（复用 strategy family）",
    infer: [
      { pattern: /自走棋|auto\s*battler|auto\s*chess|teamfight\s*tactics|tft|云顶之弈/i, priority: 96 },
    ],
  },
  // 回合制策略（复用 chess）
  {
    id: "turn-based",
    phaser: "chess",
    godot: "chess",
    godotExport: true,
    defaultSubtitle: "回合制策略 · 移动攻击",
    llmSummary: "回合制策略：网格移动 + 单位攻击（复用 chess family）",
    infer: [
      { pattern: /回合制|turn\s*based|fire\s*emblem|火焰纹章|advance\s*wars|高级战争|文明.*回合/i, priority: 110 },
    ],
  },
  // 沙盒建造（复用 customization）
  {
    id: "sandbox",
    phaser: "customization",
    godot: "customization",
    godotExport: true,
    defaultSubtitle: "沙盒建造 · 自由创造",
    llmSummary: "沙盒建造：放置方块 + 自由创作（复用 customization family）",
    infer: [
      { pattern: /沙盒|sandbox|我的世界.*创造|minecraft.*creative|创造模式/i, priority: 92 },
    ],
  },
  // 滑雪（复用 coaster）
  {
    id: "skiing",
    phaser: "coaster",
    godot: "coaster",
    godotExport: true,
    defaultSubtitle: "滑雪下坡 · 闪避障碍",
    llmSummary: "滑雪下坡：左右闪避树木/岩石（复用 coaster family）",
    infer: [
      { pattern: /滑雪|skiing|ski\s*game|阿尔卑斯|downhill\s*ski/i, priority: 92 },
    ],
  },
  // 扑克（复用 card）
  {
    id: "poker",
    phaser: "card",
    godot: "card",
    godotExport: true,
    defaultSubtitle: "扑克 · 牌型比大小",
    llmSummary: "扑克：手牌组合 + 比大小 + 押注（复用 card family）",
    infer: [
      { pattern: /扑克|poker|德州扑克|texas\s*hold|梭哈|stud\s*poker/i, priority: 115 },
    ],
  },
  // 接龙（复用 card）
  {
    id: "solitaire",
    phaser: "card",
    godot: "card",
    godotExport: true,
    defaultSubtitle: "纸牌接龙 · 经典单机",
    llmSummary: "接龙：堆叠排序 + 完成花色（复用 card family）",
    infer: [
      { pattern: /纸牌接龙|solitaire|klondike|蜘蛛纸牌|spider\s*solitaire/i, priority: 115 },
      { pattern: /接龙/i, priority: 100 },
    ],
  },
  // 21 点（复用 card）
  {
    id: "blackjack",
    phaser: "card",
    godot: "card",
    godotExport: true,
    defaultSubtitle: "21 点 · 庄家对赌",
    llmSummary: "21 点：要牌 + 比点数 + 庄家 AI（复用 card family）",
    infer: [
      { pattern: /21\s*点|blackjack|二十一点/i, priority: 115 },
    ],
  },
  // 字谜（复用 puzzle）
  {
    id: "word-game",
    phaser: "puzzle",
    godot: "puzzle",
    godotExport: true,
    defaultSubtitle: "字谜 · 单词拼写",
    llmSummary: "字谜游戏：字母组合 + 单词识别（复用 puzzle family）",
    infer: [
      { pattern: /字谜|wordle|word\s*game|拼字|crossword|填字|猜词/i, priority: 92 },
    ],
  },
  // 密室逃脱（复用 puzzle）
  {
    id: "escape-room",
    phaser: "puzzle",
    godot: "puzzle",
    godotExport: true,
    defaultSubtitle: "密室逃脱 · 解谜找线索",
    llmSummary: "密室逃脱：找线索 + 解谜 + 逃出（复用 puzzle family）",
    infer: [
      { pattern: /密室|escape\s*room|逃脱房间|解谜.*房间/i, priority: 92 },
    ],
  },
  // 找茬（复用 puzzle）
  {
    id: "hidden-object",
    phaser: "puzzle",
    godot: "puzzle",
    godotExport: true,
    defaultSubtitle: "找茬 · 隐藏物品",
    llmSummary: "找茬：找出图中隐藏物品/差异（复用 puzzle family）",
    infer: [
      { pattern: /找茬|hidden\s*object|spot\s*the\s*difference|whimsy/i, priority: 92 },
    ],
  },
  // 暗黑刷怪（复用 survivor）
  {
    id: "hack-and-slash",
    phaser: "arena",
    godot: "survivor",
    arenaMode: "survivor",
    godotExport: true,
    defaultSubtitle: "暗黑刷怪 · 装备掉落",
    llmSummary: "暗黑破坏神式俯视角刷怪 + 装备掉落（复用 survivor family）",
    infer: [
      { pattern: /暗黑|diablo|hack\s*and\s*slash|刷装备|地牢爬塔|dungeon\s*crawler/i, priority: 95 },
    ],
  },
  // 魂斗罗式横版射击（复用 platformer + shooter）
  {
    id: "run-and-gun",
    phaser: "platformer",
    godot: "platformer",
    godotExport: true,
    defaultSubtitle: "横版射击 · 魂斗罗式",
    llmSummary: "魂斗罗式横版射击：移动 + 跳跃 + 射击（复用 platformer family）",
    infer: [
      { pattern: /魂斗罗|contra|run\s*and\s*gun|metal\s*slug.*横版|合金弹头.*横版/i, priority: 95 },
    ],
  },
  // 推理（复用 puzzle）
  {
    id: "mystery",
    phaser: "puzzle",
    godot: "puzzle",
    godotExport: true,
    defaultSubtitle: "推理 · 线索收集",
    llmSummary: "推理游戏：收集线索 + 推理结论（复用 puzzle family）",
    infer: [
      { pattern: /推理|mystery|detective|侦探|破案|悬疑/i, priority: 92 },
    ],
  },

  // ─────────────────────────────────────────────────────
  // 第三批主流扩展（15 个，复用现有 family）
  // ─────────────────────────────────────────────────────

  // 麻将（4 人对局，独立 family，真麻将玩法）
  {
    id: "mahjong",
    phaser: "mahjong",
    godot: "mahjong",
    godotExport: true,
    blueprint: "mahjong",
    defaultSubtitle: "麻将 · 4 人对局 · 万条筒 · 碰杠胡",
    llmSummary: "真麻将：4 人对局 + 万条筒 108 张 + 摸打碰杠胡 + 听牌提示 + 和风 BGM",
    infer: [
      { pattern: /国标麻将|日本麻将|riichi|richi麻将|麻将对局|打麻将|四人麻将/i, priority: 120 },
      { pattern: /麻将|mahjong/i, priority: 110 },
    ],
  },
  // 麻将接龙/消除（独立 family，真配对消除玩法）
  {
    id: "mahjong-solitaire",
    phaser: "mahjongSolitaire",
    godot: "mahjongSolitaire",
    godotExport: true,
    blueprint: "mahjongSolitaire",
    defaultSubtitle: "麻将接龙 · 配对消除",
    llmSummary: "真麻将接龙：选相同牌配对消除 + 层叠解锁",
    infer: [
      { pattern: /麻将接龙|麻将消除|麻将连连看|mahjong solitaire|mahjong connect/i, priority: 125 },
    ],
  },
  // 斗地主（独立 family，真 3 人扑克玩法）
  {
    id: "dou-dizhu",
    phaser: "douDizhu",
    godot: "douDizhu",
    godotExport: true,
    blueprint: "douDizhu",
    defaultSubtitle: "斗地主 · 3 人扑克 · 叫地主",
    llmSummary: "真斗地主：3 人扑克 + 叫地主 + 出牌比大小 + 春天/反春",
    infer: [
      { pattern: /斗地主|dou\s*dizhu|dou\s*di\s*zhu|都斗地主|斗地主游戏|fight\s*the\s*landlord|landlord\s*card|three\s*player\s*card/i, priority: 125 },
      { pattern: /叫地主|春天反春|春反|三人扑克|三人牌|三人斗地主|bid\s*landlord|spring\s*counter|three\s*player\s*poker/i, priority: 115 },
    ],
  },
  // UNO（卡牌，复用 card）
  {
    id: "uno",
    phaser: "card",
    godot: "card",
    godotExport: true,
    defaultSubtitle: "UNO · 卡牌出牌 · 剩 1 张喊 UNO",
    llmSummary: "UNO：颜色/数字匹配出牌 + 特殊牌（复用 card family）",
    infer: [
      { pattern: /\buno\b|乌诺牌|优诺牌/i, priority: 125 },
    ],
  },
  // 跳棋（国际跳棋，复用 chess）
  {
    id: "checkers",
    phaser: "chess",
    godot: "chess",
    godotExport: true,
    defaultSubtitle: "跳棋 · 斜走跳吃",
    llmSummary: "国际跳棋：斜走 + 跳吃 + 王棋（复用 chess family）",
    infer: [
      { pattern: /国际跳棋|跳棋|checkers|draughts/i, priority: 95 },
    ],
  },
  // 中国跳棋（6 角星，复用 chess）
  {
    id: "chinese-checkers",
    phaser: "chess",
    godot: "chess",
    godotExport: true,
    defaultSubtitle: "中国跳棋 · 6 角星 · 跳跃前进",
    llmSummary: "中国跳棋：6 角星棋盘 + 跳跃前进（复用 chess family）",
    infer: [
      { pattern: /中国跳棋|chinese\s*checkers|六角跳棋/i, priority: 96 },
    ],
  },
  // 军棋（中国军棋，复用 chess）
  {
    id: "junqi",
    phaser: "chess",
    godot: "chess",
    godotExport: true,
    defaultSubtitle: "军棋 · 等级吃子 · 工兵排雷",
    llmSummary: "军棋：等级吃子 + 工兵排雷 + 夺旗（复用 chess family）",
    infer: [
      { pattern: /军棋|陆战棋|land\s*battle\s*chess|junqi/i, priority: 95 },
    ],
  },
  // 飞行棋（4 人，复用 chess）
  {
    id: "aeroplane-chess",
    phaser: "chess",
    godot: "chess",
    godotExport: true,
    defaultSubtitle: "飞行棋 · 4 人 · 掷骰起飞",
    llmSummary: "飞行棋：4 人 + 掷骰 + 起飞 + 撞机送回（复用 chess family）",
    infer: [
      { pattern: /飞行棋|飞机棋|aeroplane\s*chess|airplane\s*chess/i, priority: 95 },
    ],
  },
  // 无尽跑酷（独立 family，真 3 道跑酷玩法）
  {
    id: "endless-runner",
    phaser: "endlessRunner",
    godot: "endlessRunner",
    godotExport: true,
    blueprint: "endlessRunner",
    defaultSubtitle: "无尽跑酷 · 左右闪避 · 收集金币",
    llmSummary: "真无尽跑酷：3 道左右切换 + 跳跃滑铲 + 金币 combo + 速度递增",
    infer: [
      { pattern: /神庙逃亡|temple\s*run|地铁跑酷|subway\s*surfers|无尽跑酷|endless\s*runner|酷跑|跑酷游戏/i, priority: 115 },
    ],
  },
  // 水果忍者（独立 family，真切水果玩法）
  {
    id: "fruit-ninja",
    phaser: "fruitNinja",
    godot: "fruitNinja",
    godotExport: true,
    blueprint: "fruitNinja",
    defaultSubtitle: "水果忍者 · 切水果 · 避炸弹",
    llmSummary: "真水果忍者：水果抛物线 + 划屏切割 + 半片分裂 + combo + 炸弹惩罚",
    infer: [
      { pattern: /水果忍者|fruit\s*ninja|切水果|削水果/i, priority: 96 },
    ],
  },
  // 割绳子（物理益智，复用 physics）
  {
    id: "cut-the-rope",
    phaser: "physics",
    godot: "physics",
    godotExport: true,
    defaultSubtitle: "割绳子 · 物理益智 · 喂小怪兽",
    llmSummary: "割绳子：物理摆动 + 切绳 + 收集星星 + 喂怪兽（复用 physics family）",
    infer: [
      { pattern: /割绳子|cut\s*the\s*rope|喂小怪兽|切绳子/i, priority: 96 },
    ],
  },
  // 填色（儿童填色，复用 customization）
  {
    id: "coloring",
    phaser: "customization",
    godot: "customization",
    godotExport: true,
    defaultSubtitle: "填色 · 数字填色 · 涂色画",
    llmSummary: "填色游戏：选颜色填区域 + 数字填色（复用 customization family）",
    infer: [
      { pattern: /填色|涂色|coloring|color\s*by\s*number|数字填色|涂色画/i, priority: 92 },
    ],
  },
  // 花园种植（休闲花园，复用 farming）
  {
    id: "garden",
    phaser: "farming",
    godot: "farming",
    godotExport: true,
    defaultSubtitle: "花园种植 · 种花 · 装饰",
    llmSummary: "花园种植：种花 + 浇水 + 装饰花园（复用 farming family）",
    infer: [
      { pattern: /花园|garden\s*game|种花|花园经营|花园模拟/i, priority: 110 },
    ],
  },
  // 咖啡馆（咖啡馆经营，复用 farming）
  {
    id: "cafe",
    phaser: "farming",
    godot: "farming",
    godotExport: true,
    defaultSubtitle: "咖啡馆经营 · 接单做咖啡",
    llmSummary: "咖啡馆经营：接单 + 做咖啡 + 升级设备（复用 farming family）",
    infer: [
      { pattern: /咖啡馆|cafe|咖啡店|咖啡经营|coffee\s*shop/i, priority: 92 },
    ],
  },
  // 宠物对战（Pokémon 风格回合对战，复用 chess 即 turn-based）
  {
    id: "pokemon-battle",
    phaser: "chess",
    godot: "chess",
    godotExport: true,
    defaultSubtitle: "宠物对战 · 回合制 · 属性克制",
    llmSummary: "宠物对战：回合制 + 属性克制 + 技能选择（复用 chess/turn-based family）",
    infer: [
      { pattern: /宝可梦|pokemon|口袋妖怪|宠物对战|宠物小精灵|精灵对战/i, priority: 115 },
    ],
  },
];
