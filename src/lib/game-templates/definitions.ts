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
      { pattern: /神庙逃亡|temple run|temple runner|地铁跑酷|三线.*跑酷|lane runner/i, priority: 105 },
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
      {
        pattern:
          /射击|飞船|敌机|弹幕|战机|消灭敌机|竖版射击|俯视角射击|合金弹头|shooter|bullet hell|stg/i,
        priority: 85,
      },
      { pattern: /狙击|sniper|瞄准|第一人称.*射|over-shoulder/i, priority: 88 },
    ],
  },
  {
    id: "sniper",
    phaser: "shooter",
    godot: "shooter",
    godotExport: true,
    defaultSubtitle: "狙击瞄准 · 有限子弹 · 星级评价",
    llmSummary: "狙击/瞄准射击关卡（映射 shooter 运行时）",
    infer: [{ pattern: /blocky sniper|低多边形狙击|狙击猎人/i, priority: 92 }],
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
    infer: [{ pattern: /征服|策略|派兵|占领.*区域|state conquest|地图.*节点/i, priority: 86 }],
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
    infer: [{ pattern: /涂色|调色|color palette|填色|配色定制/i, priority: 87 }],
  },
  {
    id: "physics",
    phaser: "physics",
    godot: "physics",
    godotExport: true,
    defaultSubtitle: "物理发泄 · 连击反馈",
    llmSummary: "物理互动/打击假人/解压",
    infer: [{ pattern: /dummy|假人|解压|物理.*打|smash|发泄|连击.*粒子/i, priority: 96 }],
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
      { pattern: /躲|落下|闪避|避开|躲避|神庙逃亡|temple run|地铁跑酷|dodge|avoid|fall|drop/i, priority: 50 },
    ],
  },
];
