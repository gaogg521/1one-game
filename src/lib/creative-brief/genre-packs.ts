import type { ParsedIntent } from "@/lib/creative-brief/types";

export type GenrePack = {
  id: string;
  label: string;
  /** 命中任一即激活（小写匹配） */
  match: RegExp[];
  defaultTemplate: ParsedIntent["templateHint"];
  defaultTone: ParsedIntent["tone"];
  logline: (userLine: string) => string;
  world: string;
  scenes: string[];
  factions: string[];
  units: string[];
  weapons: string[];
  vfx: string[];
  artStyle: string[];
  mood: string[];
  gameplayHints: string[];
  themeHints: {
    backgroundColor?: string;
    playerColor?: string;
    hazardColor?: string;
    collectibleColor?: string;
    musicProfile?: "organic" | "pulse" | "minimal" | "neon";
  };
  negatives: string[];
};

export const GENRE_PACKS: GenrePack[] = [
  {
    id: "space-epic",
    label: "星际科幻史诗",
    match: [
      /星际|星战|太空|宇宙|galaxy|space\s*opera|star\s*war|舰队|战舰|战机|母舰|深空|space\s*fleet|fleet\s*shooter|starship/i,
    ],
    defaultTemplate: "shooter",
    defaultTone: "epic",
    logline: (u) =>
      `在${u.includes("护航") ? "碎星航道" : "深空边境"}展开舰队级对抗：玩家驾驶精锐战机穿越星云战场，拦截敌舰波次并守住战略节点。`,
    world:
      "浩瀚宇宙、深空边境、多势力星际文明对峙；战争规模从单舰缠斗可升级为舰队集群会战。",
    scenes: [
      "宏大太空战场，远近景层次分明的星云与星港剪影",
      "巨型星际战列舰与护航编队列阵对峙",
      "陨石带与残骸环带中的穿梭追击战",
      "高能主炮充能、等离子炮火照亮舰体的瞬间",
    ],
    factions: ["星际联邦护航舰队", "深空掠夺者联盟", "未知文明先遣舰群"],
    units: [
      "轻型拦截战机（玩家）",
      "重型战列巡洋舰",
      "无人机蜂群",
      "精英旗舰（波次 Boss）",
    ],
    weapons: ["高能激光主炮", "等离子副炮", "制导鱼雷", "点防御弹幕"],
    vfx: [
      "主炮扫射光带",
      "等离子炮火冲天",
      "舰体护盾涟漪",
      "爆炸火球与金属碎片",
      "引擎尾焰与跃迁折线",
    ],
    artStyle: [
      "未来科幻金属机甲质感",
      "冷色调科技光影",
      "电影级构图",
      "手游游戏原画风格",
      "高清质感",
      "画面干净整洁",
    ],
    mood: ["大气", "热血", "史诗感", "压迫升级", "胜利高光"],
    gameplayHints: [
      "俯视角射击 templateId=shooter",
      "敌舰波次自上方压进并间歇反击",
      "2～3 分钟内经历开场—加速—精英—终局四幕",
      "含 miniBoss 与短时火力窗口 goalShift",
      "labels 使用中文舰种称谓（护航舰/敌舰/弹幕）",
      "theme 偏冷色深空：深蓝背景、青蓝玩家、橙红威胁",
      "presentation.musicProfile 建议 neon 或 pulse",
    ],
    themeHints: {
      backgroundColor: "#0a1224",
      playerColor: "#6ec8ff",
      hazardColor: "#e85d4a",
      collectibleColor: "#f0c878",
      musicProfile: "neon",
    },
    negatives: [
      "畸形人体",
      "模糊低清",
      "卡通幼态违和",
      "杂乱UI堆叠",
      "写实照片人脸",
      "版权角色复刻",
      "地面田园场景",
    ],
  },
  {
    id: "tower-defense",
    label: "塔防防线",
    match: [/塔防|保卫萝卜|植物大战僵尸|pvz|plants\s*vs\s*zombies|植物塔防|豌豆射手|向日葵|坚果墙|箭塔|炮塔|防御塔|tower\s*defense|\btd\b/i],
    defaultTemplate: "towerDefense",
    defaultTone: "neutral",
    logline: (u) => `沿固定路线抵御 ${u.slice(0, 24) || "敌军"} 的多波进攻，建造与升级防御塔守住基地。`,
    world: "边境要塞或田园要塞外缘，敌军沿道路推进。",
    scenes: ["蜿蜒土路或科幻轨道", "塔位高台与基地核心", "波次旗帜与精英怪登场"],
    factions: ["守军", "进犯军团"],
    units: ["箭塔/激光塔", "步兵群", "装甲车", "Boss 载具"],
    weapons: ["箭矢", "炮弹", "激光束"],
    vfx: ["命中火花", "爆炸烟尘", "金币掉落"],
    artStyle: ["俯视角清晰可读", "色块分明", "手游塔防 UI"],
    mood: ["紧张", "策略感", "波次节奏"],
    gameplayHints: [
      "templateId=towerDefense",
      "6～10 波胜利目标",
      "经济与基地生命平衡",
      "rush / elite 修饰波次",
    ],
    themeHints: {
      backgroundColor: "#1a2220",
      playerColor: "#8faf8c",
      hazardColor: "#a65f3f",
      collectibleColor: "#c9a66b",
      musicProfile: "organic",
    },
    negatives: ["路径不可读", "塔位重叠", "畸形单位"],
  },
  {
    id: "platformer-adventure",
    label: "平台冒险",
    match: [/平台|跳跃|闯关|横版|跑酷|platformer|马里奥/i],
    defaultTemplate: "platformer",
    defaultTone: "casual",
    logline: (u) => `横版平台跳跃闯关：${u.slice(0, 36) || "穿越多层地形收集目标并躲避陷阱"}。`,
    world: "可探索的连续关卡区块，含平台、陷阱与收集物。",
    scenes: ["多层平台", "尖刺陷阱", "终点旗标"],
    factions: ["主角", "环境危害"],
    units: ["旅行者", "陷阱机关"],
    weapons: [],
    vfx: ["落地尘土", "收集闪光"],
    artStyle: ["清晰平台轮廓", "适度对比", "可读跳跃弧线"],
    mood: ["探索", "轻快", "成就感"],
    gameplayHints: [
      "templateId=platformer",
      "winScore 为收集数量 28～48",
      "合理 jumpStrength/gravity",
    ],
    themeHints: {
      backgroundColor: "#1e293b",
      playerColor: "#7dd3fc",
      hazardColor: "#f87171",
      collectibleColor: "#fbbf24",
      musicProfile: "organic",
    },
    negatives: ["不可见碰撞", "跳跃手感失真"],
  },
  {
    id: "wuxia-jianghu",
    label: "武侠江湖",
    match: [/武侠|江湖|剑客|门派|内力|轻功|少林|武当|侠客|武林/i],
    defaultTemplate: "platformer",
    defaultTone: "epic",
    logline: (u) =>
      `江湖风云起：${u.slice(0, 32) || "侠客闯关卡，以招式与身法破敌"}，水墨意境与利落战斗并存。`,
    world: "架空古代中原江湖，门派林立、恩怨交织，山水与城镇驿站相连。",
    scenes: [
      "云雾山峦间的竹径关卡",
      "古镇牌楼与擂台",
      "瀑布崖壁的轻功跳跃段",
      "月夜竹林对决",
    ],
    factions: ["名门正派", "魔教妖人", "游侠散人"],
    units: ["游侠（玩家）", "刺客", "重甲刀客", "掌门 Boss"],
    weapons: ["长剑", "双节棍", "暗器飞镖"],
    vfx: ["剑气弧光", "尘土踏雪", "竹叶飘落", "内力波纹"],
    artStyle: [
      "国风水墨与写实结合",
      "留白构图",
      "手游武侠原画",
      "衣袂飘逸",
      "冷暖对比克制",
    ],
    mood: ["侠义", "快意恩仇", "紧张对峙", "高潮决战"],
    gameplayHints: [
      "templateId=platformer 或 shooter（若强调远程暗器）",
      "labels 用中文武侠称谓",
      "theme 偏水墨：青灰背景、素色主角、朱红威胁",
      "director 含 miniBoss 掌门战",
    ],
    themeHints: {
      backgroundColor: "#1c2420",
      playerColor: "#c8d4c8",
      hazardColor: "#b83c3c",
      collectibleColor: "#d4a84b",
      musicProfile: "organic",
    },
    negatives: ["科幻机甲", "霓虹赛博", "西式城堡", "畸形肢体", "版权武侠 IP 角色名"],
  },
  {
    id: "horror-survival",
    label: "恐怖生存",
    match: [/恐怖|惊悚|丧尸|僵尸|鬼|诡异|黑暗|生存恐怖|horror|survival horror/i],
    defaultTemplate: "survivor",
    defaultTone: "hardcore",
    logline: (u) =>
      `在压迫黑暗中求生：${u.slice(0, 36) || "躲避未知威胁、管理有限生命并撑到撤离"}。`,
    world: "封闭空间或荒废聚落，光源稀缺，威胁来自阴影与突发追击。",
    scenes: ["闪烁走廊", "破碎窗户月光", "浓雾户外", "安全屋喘息点"],
    factions: ["幸存者", "不可名状之物"],
    units: ["主角", "追猎者", "杂兵阴影"],
    weapons: ["手电筒", "简易防身"],
    vfx: ["屏闪", "颗粒噪点", "血色提示", "呼吸雾气"],
    artStyle: [
      "低饱和暗调",
      "高对比光影",
      "轻微颗粒胶片感",
      "手游恐怖氛围原画",
    ],
    mood: ["压抑", "突发惊吓", "绝望边缘", "短暂喘息"],
    gameplayHints: [
      "templateId=survivor 或 avoider",
      "lives 2～4，director 含 danger / breathingRoom",
      "theme 极暗背景、冷绿或暗红点缀",
      "musicProfile minimal 或 pulse",
    ],
    themeHints: {
      backgroundColor: "#0a0a0c",
      playerColor: "#8a9a8a",
      hazardColor: "#8b2020",
      collectibleColor: "#6a7580",
      musicProfile: "minimal",
    },
    negatives: ["明亮卡通", "可爱 Q 版", "过度血腥解剖", "跳脸低俗"],
  },
  {
    id: "anime-action",
    label: "二次元动作",
    match: [
      /二次元|动漫|番剧|萌|美少女|机甲少女|日系|anime|manga|otaku|弹幕手游/i,
    ],
    defaultTemplate: "shooter",
    defaultTone: "epic",
    logline: (u) =>
      `二次元风格高能对战：${u.slice(0, 36) || "角色释放华丽技能，清屏弹幕与连击"}。`,
    world: "明亮虚构都市或学园异空间，能量与技能特效夸张而可读。",
    scenes: ["学园屋顶黄昏", "霓虹商业街巷战", "天空母舰甲板", "技能觉醒特写背景"],
    factions: ["主角小队", "异世界入侵者"],
    units: ["主角（玩家）", "精英使徒", "弹幕杂兵", "Boss 化身"],
    weapons: ["能量炮", "元素法阵", "近战光刃"],
    vfx: ["彩色技能光效", "连击数字", "屏幕边缘速度线", "觉醒光环"],
    artStyle: [
      "日系赛璐璐",
      "清晰线稿",
      "高饱和发色与瞳色",
      "手游二次元立绘风格",
      "干净 UI 留白",
    ],
    mood: ["热血", "中二燃", "轻快节奏", "Boss 战高潮"],
    gameplayHints: [
      "templateId=shooter 或 collector",
      "theme 可偏亮：浅紫/天蓝背景，高饱和技能色",
      "presentation.musicProfile neon 或 pulse",
      "subtitle 用番剧式中二短句",
    ],
    themeHints: {
      backgroundColor: "#1a1530",
      playerColor: "#ff9ecf",
      hazardColor: "#6b4cff",
      collectibleColor: "#ffe566",
      musicProfile: "neon",
    },
    negatives: ["写实照片风", "水墨武侠", "畸形人体", "未授权动漫角色"],
  },
  {
    id: "folklore-festival",
    label: "民俗节庆",
    match: [
      /民俗|庙会|节庆|舞龙|舞狮|花灯|中秋|端午|春联|年画|乡土|非遗|folk|festival|lantern/i,
    ],
    defaultTemplate: "collector",
    defaultTone: "casual",
    logline: (u) =>
      `在${u.includes("灯") ? "灯火夜市" : "乡土庙会"}中穿行：收集节庆信物、避开喧闹人流与调皮障碍，感受热闹而温暖的氛围。`,
    world: "中国乡土或古镇节庆场景，灯笼、鼓乐、摊位与人群剪影构成层次。",
    scenes: [
      "挂满花灯的长街夜景",
      "舞狮巡游与锣鼓齐鸣的广场",
      "河畔放灯与倒影",
      "糖画摊与热气腾腾的摊位前景",
    ],
    factions: ["游逛的旅人", "节庆表演队", "调皮小障碍"],
    units: ["主角（玩家）", "花灯/福袋收集物", "缓慢移动的巡游障碍"],
    weapons: [],
    vfx: ["灯笼暖光粒子", "烟花远景点缀", "拾取金光", "鼓点节奏波纹"],
    artStyle: [
      "国潮民俗插画",
      "暖色灯笼光",
      "适度扁平",
      "手游节日活动原画",
      "画面干净可读",
    ],
    mood: ["热闹", "温暖", "节庆喜悦", "轻松收集满足"],
    gameplayHints: [
      "templateId=collector 或 avoider",
      "labels 用中文节庆称谓（花灯/福袋/巡游）",
      "theme 暖色：深红/琥珀背景、金橙收集物",
      "director 偏奖励与短 danger，节奏舒缓",
      "presentation.musicProfile organic",
    ],
    themeHints: {
      backgroundColor: "#1a1210",
      playerColor: "#e8c878",
      hazardColor: "#8b4040",
      collectibleColor: "#f0b040",
      musicProfile: "organic",
    },
    negatives: ["西式万圣节恐怖", "血腥", "赛博霓虹", "版权 IP 角色"],
  },
  {
    id: "sports-arcade",
    label: "体育街机",
    match: [
      /体育|足球|篮球|乒乓|网球|田径|赛跑|射门|投篮|点球|马拉松|sport|soccer|basketball|football|athletic/i,
    ],
    defaultTemplate: "avoider",
    defaultTone: "casual",
    logline: (u) =>
      `街机式体育挑战：${u.slice(0, 36) || "在场地中闪避防守、把握时机得分，2～3 分钟一局"}。`,
    world: "明亮球场或赛道，观众席剪影与记分牌 HUD 强化竞技感。",
    scenes: ["绿茵球场俯视角", "篮球馆木地板反光", "跑道弯道冲刺段", "终场哨响高光瞬间"],
    factions: ["玩家队", "AI 防守/障碍"],
    units: ["运动员（玩家）", "防守者", "球/目标物", "裁判提示"],
    weapons: [],
    vfx: ["得分数字弹出", "速度线", "碰撞尘土", "哨声波纹提示"],
    artStyle: [
      "现代体育插画",
      "高对比场地线",
      "手游体育小游戏风格",
      "角色剪影清晰",
    ],
    mood: ["紧张对抗", "得分快感", "逆转高潮", "轻松街机"],
    gameplayHints: [
      "templateId=avoider 或 collector（若强调捡球得分）",
      "score 与 combo 反馈明显",
      "theme 明亮：绿/蓝场地、白线、高饱和球员色",
      "director 含 goalShift 与短时加分窗口",
    ],
    themeHints: {
      backgroundColor: "#142818",
      playerColor: "#4caf88",
      hazardColor: "#c04040",
      collectibleColor: "#f0d040",
      musicProfile: "pulse",
    },
    negatives: ["写实转播照片", "暴力格斗", "畸形人体", "真实球星肖像"],
  },
  {
    id: "puzzle-logic",
    label: "解谜逻辑",
    match: [
      /解谜|益智|拼图|推箱子|机关|迷宫|逻辑|脑力|puzzle|sokoban|match.?3|riddle|brain|パズル|謎解き|鍵を集|益智ゲーム/i,
    ],
    defaultTemplate: "collector",
    defaultTone: "neutral",
    logline: (u) =>
      `逻辑解谜闯关：${u.slice(0, 36) || "在网格或机关场景中收集钥匙、触发开关并抵达出口"}。`,
    world: "抽象棋盘、遗迹机关或极简实验室风格空间，规则清晰可读。",
    scenes: ["发光地砖网格", "可推动方块与压力板", "激光门禁走廊", "出口传送门亮起"],
    factions: ["解谜者", "机关系统"],
    units: ["主角", "钥匙/宝石", "移动障碍", "机关门"],
    weapons: [],
    vfx: ["方块滑动轨迹", "机关激活闪光", "通关光环", "错误尝试轻震"],
    artStyle: [
      "极简几何",
      "高对比色块",
      "手游益智 UI 友好",
      "留白充足",
    ],
    mood: ["专注", "顿悟满足", "轻度紧张", "通关成就"],
    gameplayHints: [
      "templateId=collector 或 platformer（若强调跳跃机关）",
      "节奏偏慢，director 少弹幕式 danger",
      "labels 用中文机关名（钥匙/门/开关）",
      "theme 冷静：深蓝/灰紫背景、亮色收集物",
    ],
    themeHints: {
      backgroundColor: "#141820",
      playerColor: "#6ec8e8",
      hazardColor: "#c06080",
      collectibleColor: "#e8d060",
      musicProfile: "minimal",
    },
    negatives: ["杂乱写实场景", "恐怖跳脸", "过度文字说明 UI"],
  },
  {
    id: "cozy-collect",
    label: "治愈收集",
    match: [/治愈|休闲|收集|金币|宝石|田园|森林|cat|cozy/i],
    defaultTemplate: "collector",
    defaultTone: "cozy",
    logline: (u) => `轻松收集冒险：${u.slice(0, 40) || "在场景中拾取宝物并避开温和威胁"}。`,
    world: "柔和自然环境或童话聚落。",
    scenes: ["小径", "草丛", "光斑"],
    factions: ["旅人", "调皮障碍"],
    units: ["主角", "收集物", "缓慢威胁"],
    weapons: [],
    vfx: ["拾取闪光", "轻柔粒子"],
    artStyle: ["水彩感或扁平插画", "低饱和", "留白舒适"],
    mood: ["治愈", "轻松", "收集满足"],
    gameplayHints: ["templateId=collector 或 avoider", "节奏舒缓", "director 事件偏奖励"],
    themeHints: {
      backgroundColor: "#1a2220",
      playerColor: "#8faf8c",
      hazardColor: "#a65f3f",
      collectibleColor: "#c9a66b",
      musicProfile: "organic",
    },
    negatives: ["血腥", "恐怖", "高饱和霓虹"],
  },
  // ── 牌桌对局（卡牌/棋类真玩法：斗地主/麻将/UNO/扑克/接龙/21点/象棋/跳棋等）
  // 这类游戏不需要"世界观/势力/武器"，brief 字段全部改用牌桌语义，
  // 避免把动作游戏的"边境要塞/守军/箭塔"塞给卡牌游戏（导致 LLM 扩写乱套）。
  {
    id: "card-table",
    label: "牌桌对局",
    match: [
      /斗地主|叫地主|春天反春|三人扑克|三人牌|dou\s*dizhu|fight\s*the\s*landlord|three\s*player\s*card|three\s*player\s*poker|bid\s*landlord/i,
      /麻将|mahjong|碰杠胡|riichi|国标麻将|日本麻将/i,
      /\buno\b|乌诺牌|优诺牌/i,
      /扑克|poker|德州扑克|texas\s*hold|梭哈/i,
      /纸牌接龙|solitaire|klondike|蜘蛛纸牌/i,
      /21\s*点|blackjack|二十一点/i,
      /中国象棋|象棋|围棋|国际象棋|\bchess\b|五子棋/i,
      /国际跳棋|跳棋|checkers|draughts/i,
      /中国跳棋|chinese\s*checkers/i,
      /军棋|陆战棋|junqi/i,
      /飞行棋|飞机棋|aeroplane\s*chess/i,
    ],
    defaultTemplate: "auto",
    defaultTone: "neutral",
    logline: (u) => `牌桌对局：${u.slice(0, 36) || "按规则出牌比胜负"}，AI 对手配合，一局定胜负。`,
    world: "牌桌/棋盘对局场景，2-4 人围坐，规则清晰可读。",
    scenes: ["发牌/起手配牌阶段", "叫牌/出牌/走棋博弈阶段", "终局结算与胜负判定"],
    factions: ["玩家", "AI 对手"],
    units: ["手牌/棋子", "出牌区/棋盘", "底牌/牌堆"],
    weapons: [],
    vfx: ["出牌/落子动画", "得分提示", "胜负结算特效"],
    artStyle: ["牌桌清晰可读", "卡牌/棋子图标明确", "适度对比", "无动作游戏式爆炸光效"],
    mood: ["专注", "博弈", "胜负分明"],
    gameplayHints: [
      "templateId 必须精确（斗地主=dou-dizhu，4人麻将=mahjong，麻将接龙=mahjong-solitaire，UNO=uno，扑克=poker，接龙=solitaire，21点=blackjack，象棋=chess 等）",
      "winScore 通常为 1（一局定胜负）；lives 为 1",
      "playerSpeed/hazardSpeed/jumpStrength/gravity 填中性占位（如 200/100/420/980），不要套动作游戏数值",
      "director 节奏弱化：intensity 0.3-0.5，events 4-5 个即可",
      "labels 贴合玩法：player=对局角色，hazard=对手，collectible=牌/番数/底牌",
      "禁止套用 shooter/towerDefense 的波次/编队/弹幕叙事",
    ],
    themeHints: {
      backgroundColor: "#1a1a2e",
      playerColor: "#fbbf24",
      hazardColor: "#ef4444",
      collectibleColor: "#a3e635",
      musicProfile: "organic",
    },
    negatives: ["动作游戏式波次叙事", "边境要塞/守军/箭塔等动作世界观", "高饱和霓虹", "弹幕爆炸光效", "畸形人体"],
  },
];

export const DEFAULT_GENRE_PACK: GenrePack = {
  id: "general-arcade",
  label: "通用街机",
  match: [],
  defaultTemplate: "auto",
  defaultTone: "neutral",
  logline: (u) => `把「${u.slice(0, 48) || "一句话创意"}」落地为 2～3 分钟可玩的网页小游戏，节奏清晰、目标明确。`,
  world: "抽象或轻度主题化的单屏/卷轴场景。",
  scenes: ["主玩法区域", "HUD 信息区"],
  factions: ["玩家", "威胁/障碍"],
  units: ["主角", "敌人或障碍", "收集物"],
  weapons: [],
  vfx: ["命中反馈", "拾取反馈"],
  artStyle: ["现代扁平", "可读优先", "适度对比"],
  mood: ["清晰", "反馈及时"],
  gameplayHints: ["根据全文选择最贴切的 templateId", "四幕 director 节奏", "中文 labels"],
  themeHints: {},
  negatives: ["畸形", "模糊", "杂乱", "版权 IP 复刻"],
};

export function selectGenrePack(prompt: string): GenrePack {
  const p = prompt.trim();
  for (const pack of GENRE_PACKS) {
    if (pack.match.some((re) => re.test(p))) return pack;
  }
  return DEFAULT_GENRE_PACK;
}
