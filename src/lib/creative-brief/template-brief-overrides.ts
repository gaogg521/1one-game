/**
 * 60 模板 brief 兜底表：当 selectGenrePack 无关键词命中时，按 templateId 选 template-appropriate
 * world/scenes/units/gameplayHints/themeHints/negatives，避免所有未覆盖模板都走 general-arcade
 * 输出"主角/敌人/收集物"通用占位（导致创意解读与提示词无关）。
 *
 * 每条只写"该模板最该出现的场景/单位/玩法要点"，LLM 扩写时在这骨架上细化。
 */
import type { GameTemplateId } from "@/lib/game-templates/registry";

export type PlayableLoop = {
  /** 核心动词：玩家在做什么（切/射/跳/收集/出牌） */
  verb: string;
  /** 目标：怎样算赢 */
  objective: string;
  /** 反馈：做得对时系统给什么正反馈 */
  feedback: string;
  /** 失败/重试：怎样算输，如何重来 */
  failRetry: string;
};

export interface TemplateBriefOverride {
  world: string;
  scenes: string[];
  units: string[];
  gameplayHints: string[];
  /** 一句话 playable loop（移植自 threejs-game-skills gameplay-systems） */
  playableLoop?: PlayableLoop;
  themeHints: {
    backgroundColor?: string;
    playerColor?: string;
    hazardColor?: string;
    collectibleColor?: string;
    musicProfile?: "organic" | "pulse" | "minimal" | "neon";
  };
  negatives: string[];
}

export const TEMPLATE_BRIEF_OVERRIDES: Partial<Record<GameTemplateId, TemplateBriefOverride>> = {
  // ── 动作/战斗 ──
  shooter: {
    world: "俯视角/竖版战场，敌群波次压进，火力窗口与走位是核心。",
    scenes: ["敌群编队压进", "火力窗口爆发", "精英/Boss 登场", "终局清场高光"],
    units: ["玩家战机/角色", "敌机/敌兵", "精英编队", "Boss"],
    gameplayHints: ["templateId=shooter", "波次升级 3 分钟内压力抬升", "掉装/火力叠加循环", "labels 用中文敌我称谓"],
    playableLoop: { verb: "射击+走位", objective: "消灭 N 波敌机/Boss", feedback: "击落爆炸+火力升级+combo", failRetry: "被撞/被弹幕命中扣命，命 0 失败，立即重开" },
    themeHints: { backgroundColor: "#0a0e1a", playerColor: "#38bdf8", hazardColor: "#ef4444", collectibleColor: "#facc15", musicProfile: "pulse" },
    negatives: ["写实血腥", "畸形人体", "版权 IP 复刻"],
  },
  sniper: {
    world: "远处高价值目标，瞄准镜视野，有限子弹与时机选择。",
    scenes: ["瞄准镜锁定目标", "呼吸稳定窗口", "命中/未命中反馈", "关卡星级结算"],
    units: ["玩家狙击手", "目标人物", "干扰目标", "环境掩护"],
    gameplayHints: ["templateId=sniper（映射 shooter 运行时）", "有限子弹 + 星级评价", "呼吸/抖动机制", "labels 贴合狙击语境"],
    playableLoop: { verb: "瞄准+射击", objective: "有限子弹内消灭目标/达星级", feedback: "命中特写+星级结算+呼吸稳定窗口", failRetry: "子弹耗尽或目标逃脱，重开关卡" },
    themeHints: { backgroundColor: "#1a1a1a", playerColor: "#84cc16", hazardColor: "#dc2626", collectibleColor: "#fbbf24", musicProfile: "minimal" },
    negatives: ["写实血腥", "过度暴力", "畸形人体"],
  },
  "hack-and-slash": {
    world: "地下城/战场，玩家近战割草，连击与技能循环。",
    scenes: ["敌群包围", "连击技能爆发", "Boss 对峙", "战利品掉落"],
    units: ["玩家战士", "杂兵群", "精英怪", "Boss"],
    gameplayHints: ["templateId=hack-and-slash", "连击 + 技能 CD 循环", "掉装/属性成长", "director 弹幕式压迫"],
    playableLoop: { verb: "近战割草+技能", objective: "清空地下城/Boss", feedback: "连击+掉装+技能爆发", failRetry: "血量归零失败，从检查点重开" },
    themeHints: { backgroundColor: "#1a0f0a", playerColor: "#f59e0b", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "pulse" },
    negatives: ["写实血腥", "畸形人体", "版权 IP"],
  },
  "run-and-gun": {
    world: "横版战场，边跑边射，平台跳跃与火力结合。",
    scenes: ["推进式关卡段落", "平台跳跃 + 射击", "中段 Boss", "关底通关"],
    units: ["玩家战士", "敌兵", "炮台", "Boss"],
    gameplayHints: ["templateId=run-and-gun", "横版推进 + 射击 + 跳跃", "武器切换/掉装", "labels 战场语境"],
    playableLoop: { verb: "跑+跳+射", objective: "通关推进", feedback: "击杀+武器切换+关底通关", failRetry: "血量归零失败，重开关卡" },
    themeHints: { backgroundColor: "#0f1a0f", playerColor: "#22d3ee", hazardColor: "#ef4444", collectibleColor: "#facc15", musicProfile: "pulse" },
    negatives: ["写实血腥", "畸形人体"],
  },
  fighting: {
    world: "1v1 格斗擂台，招式博弈与连段是核心。",
    scenes: ["对峙开场", "招式交锋", "破防/反击瞬间", "KO 结算"],
    units: ["玩家格斗家", "AI 对手", "擂台环境"],
    gameplayHints: ["templateId=fighting", "血量/气槽双轨", "招式: 轻/重/特殊/必杀", "winScore=1（一局定胜负）"],
    playableLoop: { verb: "出招+格挡", objective: "耗空对手血量", feedback: "命中特效+连段+KO 动画", failRetry: "自己血量归零输局，三局两胜可再开" },
    themeHints: { backgroundColor: "#1a1420", playerColor: "#fbbf24", hazardColor: "#ef4444", collectibleColor: "#a3e635", musicProfile: "pulse" },
    negatives: ["写实血腥", "畸形人体", "暴力特写"],
  },
  moba: {
    world: "三路对抗地图，推线/打野/团战，基地塔为核心目标。",
    scenes: ["对线期博弈", "野区 Gank", "团战爆发", "推基地终局"],
    units: ["玩家英雄", "兵线", "野怪", "敌方英雄", "防御塔/基地"],
    gameplayHints: ["templateId=moba", "三路 + 野区", "技能 4 槽 + 装备购买", "winScore=推平基地"],
    playableLoop: { verb: "推线+技能+团战", objective: "推平敌方基地", feedback: "击杀+推塔+金币装备", failRetry: "基地被推平输局，可投降再开" },
    themeHints: { backgroundColor: "#0a1a14", playerColor: "#3b82f6", hazardColor: "#ef4444", collectibleColor: "#facc15", musicProfile: "pulse" },
    negatives: ["写实血腥", "畸形人体", "版权 IP"],
  },
  stealth: {
    world: "潜行关卡，避视野/暗杀/绕行，被发现即警报。",
    scenes: ["贴墙潜行", "视野盲区穿越", "暗杀/绕过瞬间", "警报逃脱"],
    units: ["玩家潜行者", "巡逻守卫", "摄像头/警报", "掩护物"],
    gameplayHints: ["templateId=stealth", "视野锥/听觉判定", "被发现→警报/逃脱", "labels 贴合潜行语境"],
    playableLoop: { verb: "潜行+暗杀/绕行", objective: "抵达出口/完成目标", feedback: "暗杀成功+未被发现+结算", failRetry: "被发现触发警报，逃脱或重开" },
    themeHints: { backgroundColor: "#0a0f14", playerColor: "#475569", hazardColor: "#dc2626", collectibleColor: "#fbbf24", musicProfile: "minimal" },
    negatives: ["写实血腥", "过度暴力"],
  },
  survivor: {
    world: "尸潮包围的开放区域，玩家走位输出，活到最后。",
    scenes: ["尸潮合围", "技能清场爆发", "补给拾取窗口", "终局残局"],
    units: ["玩家幸存者", "尸群", "精英变异体", "补给箱"],
    gameplayHints: ["templateId=survivor", "自动攻击 + 走位", "升级三选一", "时间存活或击杀数"],
    playableLoop: { verb: "走位+自动攻击", objective: "存活目标时间/击杀数", feedback: "升级三选一+清场+连杀", failRetry: "血量归零失败，立即重开" },
    themeHints: { backgroundColor: "#1a0a0a", playerColor: "#84cc16", hazardColor: "#dc2626", collectibleColor: "#fbbf24", musicProfile: "pulse" },
    negatives: ["写实血腥", "畸形人体"],
  },
  horror: {
    world: "阴森封闭空间，资源稀缺，未知威胁逼近。",
    scenes: ["探索阴暗走廊", "jump scare 瞬间", "解谜/找钥匙", "逃脱/对峙结局"],
    units: ["玩家受害者", "未知怪物", "关键道具", "安全屋"],
    gameplayHints: ["templateId=horror", "资源稀缺 + 躲藏/逃跑", "恐怖节奏: 静→jump", "labels 暗黑语境"],
    playableLoop: { verb: "监控+关门守夜", objective: "撑过 N 夜", feedback: "成功阻挡+电力管理+存活", failRetry: "怪物破门 jumpscare，重开当夜" },
    themeHints: { backgroundColor: "#0a0a0a", playerColor: "#6b7280", hazardColor: "#7f1d1d", collectibleColor: "#fbbf24", musicProfile: "minimal" },
    negatives: ["写实血腥", "过度暴力", "畸形人体"],
  },

  // ── 平台/移动 ──
  platformer: {
    world: "横版关卡，平台跳跃 + 收集 + 陷阱，段落式推进。",
    scenes: ["起跳平台段", "陷阱穿越", "收集段落", "关底旗帜"],
    units: ["玩家角色", "敌人/陷阱", "收集物", "移动平台"],
    gameplayHints: ["templateId=platformer", "跳跃力度 + 平台落点", "段落式关卡设计", "labels 贴合主题"],
    playableLoop: { verb: "跳跃+移动", objective: "抵达终点旗标/收集目标", feedback: "收集金币+踩怪+通关动画", failRetry: "掉坑/碰怪扣命，命 0 失败，从 checkpoint 重开" },
    themeHints: { backgroundColor: "#0f1a2a", playerColor: "#38bdf8", hazardColor: "#ef4444", collectibleColor: "#facc15", musicProfile: "organic" },
    negatives: ["畸形人体", "模糊", "杂乱"],
  },
  "endless-runner": {
    world: "三道无尽跑酷，左右切换 + 跳跃滑铲，速度递增。",
    scenes: ["三道切换", "跳跃/滑铲障碍", "金币 combo 段", "速度提升拐点"],
    units: ["玩家跑者", "障碍物", "金币", "加速带"],
    gameplayHints: ["templateId=endless-runner", "三道 + 跳/滑", "速度递增", "score=距离/金币"],
    playableLoop: { verb: "切道+跳/滑", objective: "跑尽可能远/收集目标金币", feedback: "金币 combo+距离里程碑+加速", failRetry: "撞障碍扣命，命 0 失败，立即重开" },
    themeHints: { backgroundColor: "#1a140a", playerColor: "#f59e0b", hazardColor: "#dc2626", collectibleColor: "#fbbf24", musicProfile: "pulse" },
    negatives: ["畸形人体", "模糊"],
  },
  racing: {
    world: "赛道竞速，圈速/计时，漂移与加速带。",
    scenes: ["起跑加速", "弯道漂移", "超车/被超", "终点冲线"],
    units: ["玩家赛车", "AI 对手车", "加速带", "障碍"],
    gameplayHints: ["templateId=racing（映射 coaster）", "圈速/计时", "漂移/加速机制", "labels 赛车语境"],
    playableLoop: { verb: "竞速+漂移", objective: "圈速/计时达标", feedback: "超车+漂移+冲线", failRetry: "超时未达标失败，重开" },
    themeHints: { backgroundColor: "#0a1a0f", playerColor: "#22d3ee", hazardColor: "#ef4444", collectibleColor: "#facc15", musicProfile: "pulse" },
    negatives: ["写实转播", "版权车型"],
  },
  coaster: {
    world: "空中轨道/过山车，第三人称，Boost/Brake 计时完赛。",
    scenes: ["俯冲加速段", "回环/螺旋", "Brake 减速弯", "终点计时"],
    units: ["玩家轨道车", "轨道", "Boost/Brake 段", "计时门"],
    gameplayHints: ["templateId=coaster", "Boost/Brake 时机", "3D 第三人称", "计时完赛"],
    playableLoop: { verb: "Boost/Brake 控速", objective: "计时完赛", feedback: "俯冲加速+回环+冲线", failRetry: "超时或脱轨失败，重开" },
    themeHints: { backgroundColor: "#0f0a1a", playerColor: "#a78bfa", hazardColor: "#ef4444", collectibleColor: "#facc15", musicProfile: "pulse" },
    negatives: ["写实照片", "模糊"],
  },
  skiing: {
    world: "雪山斜坡，躲避树木/岩石，速度感与转向。",
    scenes: ["陡坡加速", "树木/岩石闪避", "跳跃台", "终点计分"],
    units: ["玩家滑雪者", "树木/岩石", "跳跃台", "旗门"],
    gameplayHints: ["templateId=skiing", "转向 + 速度", "障碍闪避", "score=距离/旗门"],
    playableLoop: { verb: "转向+闪避", objective: "抵达终点/旗门全过", feedback: "速度感+跳跃+旗门", failRetry: "撞树/漏旗门扣分，重开" },
    themeHints: { backgroundColor: "#0a1420", playerColor: "#e0f2fe", hazardColor: "#1e293b", collectibleColor: "#fbbf24", musicProfile: "minimal" },
    negatives: ["写实照片", "模糊"],
  },

  // ── 益智/物理 ──
  puzzle: {
    world: "抽象棋盘/遗迹机关空间，规则清晰可读。",
    scenes: ["网格地砖", "可推方块/压力板", "激光门禁", "出口传送门"],
    units: ["主角", "钥匙/宝石", "移动障碍", "机关门"],
    gameplayHints: ["templateId=puzzle", "节奏偏慢", "director 少 danger", "labels 机关名"],
    playableLoop: { verb: "推箱/开关/解谜", objective: "抵达出口/触发通关条件", feedback: "机关激活+通关光环", failRetry: "陷入死局可重置关卡" },
    themeHints: { backgroundColor: "#141820", playerColor: "#6ec8e8", hazardColor: "#c06080", collectibleColor: "#e8d060", musicProfile: "minimal" },
    negatives: ["杂乱写实", "恐怖跳脸", "过度文字 UI"],
  },
  physics: {
    world: "物理摆动/弹射空间，重力与碰撞驱动玩法。",
    scenes: ["绳索/链条摆动", "弹弓弹射段", "碰撞连锁反应", "目标命中"],
    units: ["物理对象", "绳索/铰链", "弹射器", "目标物"],
    gameplayHints: ["templateId=physics", "重力/碰撞驱动", "切割/弹射交互", "labels 物理语境"],
    playableLoop: { verb: "物理摆动/弹射", objective: "命中目标/通关", feedback: "碰撞连锁+目标命中", failRetry: "目标未命中，重置关卡" },
    themeHints: { backgroundColor: "#1a1a1a", playerColor: "#84cc16", hazardColor: "#dc2626", collectibleColor: "#fbbf24", musicProfile: "organic" },
    negatives: ["杂乱写实", "模糊"],
  },
  "cut-the-rope": {
    world: "关卡空间，绳子吊着糖果，割绳喂怪兽。",
    scenes: ["糖果摆动", "切绳瞬间", "星星收集段", "怪兽接食"],
    units: ["糖果", "绳子", "星星", "小怪兽"],
    gameplayHints: ["templateId=cut-the-rope（复用 physics）", "切绳 + 摆动物理", "收集星星", "喂怪兽通关"],
    playableLoop: { verb: "切绳+摆动", objective: "喂怪兽+收集星星", feedback: "糖果落入怪兽嘴+星星收集", failRetry: "糖果掉落未接住，重开" },
    themeHints: { backgroundColor: "#1a140a", playerColor: "#f59e0b", hazardColor: "#dc2626", collectibleColor: "#fbbf24", musicProfile: "organic" },
    negatives: ["写实", "恐怖", "畸形"],
  },
  tetris: {
    world: "竖井式方块下落空间，7 形旋转 + 消行。",
    scenes: ["方块下落", "旋转/移动定位", "消行瞬间", "Game Over 顶部"],
    units: ["7 形方块", "下一个预览", "ghost 落点", "消行特效"],
    gameplayHints: ["templateId=tetris", "7-bag + 旋转 + wall-kick", "消行得分/连消", "速度递增"],
    playableLoop: { verb: "旋转+移动+消行", objective: "消行得目标分/撑到 N 级", feedback: "消行特效+连消+升级", failRetry: "方块堆顶 Game Over，重开" },
    themeHints: { backgroundColor: "#0a0a14", playerColor: "#38bdf8", hazardColor: "#ef4444", collectibleColor: "#a3e635", musicProfile: "pulse" },
    negatives: ["写实", "杂乱"],
  },
  breakout: {
    world: "砖墙 + 球 + 挡板，反弹消除砖块。",
    scenes: ["球反弹轨迹", "砖块消除段", "挡板接球", "清砖通关"],
    units: ["挡板", "球", "砖块", "道具"],
    gameplayHints: ["templateId=breakout", "反弹角度控制", "道具掉落", "清砖通关"],
    playableLoop: { verb: "移动挡板+反弹球", objective: "消除所有砖块", feedback: "砖块破碎+道具掉落+连击", failRetry: "球落底部扣命，命 0 失败，重开" },
    themeHints: { backgroundColor: "#0a0f1a", playerColor: "#38bdf8", hazardColor: "#ef4444", collectibleColor: "#fbbf24", musicProfile: "pulse" },
    negatives: ["写实", "杂乱"],
  },
  merge: {
    world: "网格合并空间，相同合成更大，目标合成顶级。",
    scenes: ["拖拽合并", "合成升级动画", "网格填满危机", "目标达成"],
    units: ["合成单位（递进等级）", "网格", "新生成单位", "目标单位"],
    gameplayHints: ["templateId=merge", "相同合成更大", "网格策略性放置", "目标=合成顶级"],
    playableLoop: { verb: "拖拽合并", objective: "合成目标等级方块", feedback: "合成动画+连消+目标达成", failRetry: "网格填满无法合并 Game Over，重开" },
    themeHints: { backgroundColor: "#1a140a", playerColor: "#fbbf24", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["写实", "杂乱"],
  },
  "escape-room": {
    world: "封闭房间，找线索/解谜/开锁逃出。",
    scenes: ["探索房间", "找线索道具", "解谜开锁", "逃脱成功"],
    units: ["玩家", "线索道具", "锁/机关", "出口"],
    gameplayHints: ["templateId=escape-room", "找道具 + 解谜", "多步骤开锁", "限时或步数"],
    playableLoop: { verb: "找线索+解谜", objective: "逃出房间", feedback: "开锁+解谜+逃脱", failRetry: "超时或死局，重置房间" },
    themeHints: { backgroundColor: "#14110a", playerColor: "#fbbf24", hazardColor: "#7f1d1d", collectibleColor: "#a3e635", musicProfile: "minimal" },
    negatives: ["写实恐怖", "过度文字 UI"],
  },
  "hidden-object": {
    world: "密集场景，找清单物品，时限内找齐。",
    scenes: ["场景浏览", "找到物品瞬间", "清单勾选", "全部找齐"],
    units: ["玩家视角", "目标物品", "干扰物品", "清单"],
    gameplayHints: ["templateId=hidden-object", "找清单物品", "时限 + 提示道具", "labels 物品名"],
    playableLoop: { verb: "找清单物品", objective: "时限内找齐", feedback: "找到+勾选+提示", failRetry: "超时未找齐，重开" },
    themeHints: { backgroundColor: "#1a140a", playerColor: "#fbbf24", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["杂乱到不可读", "模糊"],
  },
  "word-game": {
    world: "字母/词汇网格，拼词得分。",
    scenes: ["字母网格", "拼词瞬间", "得分反馈", "目标分通关"],
    units: ["字母块", "拼词区", "得分", "目标分"],
    gameplayHints: ["templateId=word-game", "字母拼词", "限时或步数", "score=词长得分"],
    playableLoop: { verb: "字母拼词", objective: "目标分/步数内拼词", feedback: "拼词得分+连击", failRetry: "步数耗尽未达标，重开" },
    themeHints: { backgroundColor: "#0a1420", playerColor: "#38bdf8", hazardColor: "#dc2626", collectibleColor: "#fbbf24", musicProfile: "minimal" },
    negatives: ["过度文字 UI", "杂乱"],
  },
  mystery: {
    world: "悬疑场景，找证据/对话/推理真相。",
    scenes: ["现场勘查", "证据收集", "对话盘问", "真相揭示"],
    units: ["玩家侦探", "NPC", "证据物", "嫌疑人"],
    gameplayHints: ["templateId=mystery", "找证据 + 对话选择", "推理结论", "labels 悬疑语境"],
    playableLoop: { verb: "勘查+对话+推理", objective: "揭示真相", feedback: "证据+盘问+推理结论", failRetry: "推理错误，重查" },
    themeHints: { backgroundColor: "#14110a", playerColor: "#fbbf24", hazardColor: "#7f1d1d", collectibleColor: "#a3e635", musicProfile: "minimal" },
    negatives: ["写实恐怖", "过度文字 UI"],
  },

  // ── 街机 ──
  "fruit-ninja": {
    world: "明亮厨房/水果摊，水果抛物线飞出，划屏切割。",
    scenes: ["水果抛物线起飞", "划屏切片 + 果汁飞溅", "combo 高光", "炸弹红屏闪"],
    units: ["🍉🍊🍎🍇🍓🥝🍌🍑 水果", "💣 炸弹", "刀光轨迹"],
    gameplayHints: ["templateId=fruit-ninja", "抛物线 + 划屏切割 + combo", "炸弹扣命", "winScore=目标分"],
    playableLoop: { verb: "划屏切割", objective: "切到目标分数", feedback: "果汁飞溅+combo 加分+刀光轨迹", failRetry: "切炸弹扣命+屏震，命 0 或超时未达标失败" },
    themeHints: { backgroundColor: "#0f172a", playerColor: "#38bdf8", hazardColor: "#ef4444", collectibleColor: "#22c55e", musicProfile: "pulse" },
    negatives: ["写实血腥", "动作游戏波次叙事"],
  },
  "whack-a-mole": {
    world: "地洞网格，地鼠随机冒头，敲击得分。",
    scenes: ["地鼠冒头", "敲击命中", "连击 combo", "漏掉扣分/命"],
    units: ["地鼠", "锤子", "地洞", "炸弹地鼠（误击惩罚）"],
    gameplayHints: ["templateId=whack-a-mole", "随机冒头 + 敲击", "combo 加分", "误击炸弹扣分"],
    playableLoop: { verb: "敲击地鼠", objective: "时限内达目标分", feedback: "命中+连击+漏掉扣分", failRetry: "误击炸弹扣分/超时，重开" },
    themeHints: { backgroundColor: "#1a140a", playerColor: "#f59e0b", hazardColor: "#dc2626", collectibleColor: "#84cc16", musicProfile: "organic" },
    negatives: ["写实", "暴力"],
  },
  pong: {
    world: "左右挡板对打，球反弹，先达分胜。",
    scenes: ["球弹射轨迹", "挡板接球", "得分瞬间", "终局结算"],
    units: ["玩家挡板", "AI 挡板", "球", "比分"],
    gameplayHints: ["templateId=pong", "挡板移动 + 反弹角度", "先达 N 分胜", "AI 难度递增"],
    playableLoop: { verb: "挡板移动+反弹", objective: "先达 N 分", feedback: "得分+反弹角度", failRetry: "对手先达 N 分，重开" },
    themeHints: { backgroundColor: "#0a0a0a", playerColor: "#38bdf8", hazardColor: "#ef4444", collectibleColor: "#fbbf24", musicProfile: "pulse" },
    negatives: ["写实", "杂乱"],
  },
  coloring: {
    world: "线稿填色画板，选颜色填区域。",
    scenes: ["线稿展示", "选颜色填区域", "完成填色", "作品展示"],
    units: ["线稿区域", "调色板", "填色工具", "完成作品"],
    gameplayHints: ["templateId=coloring（复用 customization）", "选色填区域", "数字填色可选", "无失败条件"],
    playableLoop: { verb: "选色填区域", objective: "完成填色", feedback: "填色+作品展示", failRetry: "无失败条件，自由填色" },
    themeHints: { backgroundColor: "#fef3c7", playerColor: "#f59e0b", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["写实", "恐怖", "暴力"],
  },

  // ── 塔/策略 ──
  towerDefense: {
    world: "路径式战场，敌人沿路行军，塔位建造升级防守。",
    scenes: ["路径行军段", "塔位建造", "波次升级压迫", "终局清场"],
    units: ["塔（多种）", "敌人（多种）", "路径", "基地"],
    gameplayHints: ["templateId=towerDefense", "塔位建造 + 升级", "波次递增", "winScore=守住 N 波"],
    playableLoop: { verb: "建塔+升级", objective: "守住 N 波不让敌人抵达基地", feedback: "击杀金币+塔升级+波次清场", failRetry: "敌人抵达基地扣血，血 0 失败，重开来塔位" },
    themeHints: { backgroundColor: "#0f1a0f", playerColor: "#84cc16", hazardColor: "#dc2626", collectibleColor: "#fbbf24", musicProfile: "pulse" },
    negatives: ["写实", "畸形人体"],
  },
  strategy: {
    world: "战略地图，多势力对抗，资源/科技/军队综合博弈。",
    scenes: ["资源采集期", "科技/兵种升级", "军队交锋", "征服/外交终局"],
    units: ["玩家势力", "AI 势力", "资源点", "军队单位"],
    gameplayHints: ["templateId=strategy", "资源 + 科技 + 军队", "回合或实时", "winScore=征服/积分"],
    playableLoop: { verb: "资源+科技+军队", objective: "征服/积分达标", feedback: "采集+升级+交锋", failRetry: "被征服失败，重开" },
    themeHints: { backgroundColor: "#0a1420", playerColor: "#3b82f6", hazardColor: "#dc2626", collectibleColor: "#fbbf24", musicProfile: "minimal" },
    negatives: ["写实", "杂乱 UI"],
  },
  "turn-based": {
    world: "回合制战场，网格移动 + 招式选择，策略博弈。",
    scenes: ["回合开始", "移动/攻击选择", "招式命中", "回合结算"],
    units: ["玩家单位", "敌方单位", "网格", "招式列表"],
    gameplayHints: ["templateId=turn-based", "回合制 + 网格", "招式/属性相克", "winScore=全歼"],
    playableLoop: { verb: "回合走子+招式", objective: "全歼对方", feedback: "命中+属性相克+结算", failRetry: "全灭失败，重开" },
    themeHints: { backgroundColor: "#141820", playerColor: "#3b82f6", hazardColor: "#dc2626", collectibleColor: "#fbbf24", musicProfile: "minimal" },
    negatives: ["写实", "杂乱 UI"],
  },
  "auto-battler": {
    world: "自动战斗棋盘，布阵后自动对战，羁绊/装备驱动。",
    scenes: ["布阵阶段", "自动战斗", "羁绊激活", "胜负结算"],
    units: ["棋子单位", "羁绊组合", "装备", "对手阵容"],
    gameplayHints: ["templateId=auto-battler", "布阵后自动打", "羁绊/装备成长", "回合制连胜"],
    playableLoop: { verb: "布阵+自动战斗", objective: "连胜/存活", feedback: "羁绊激活+装备+胜负", failRetry: "连败血量归零，重开" },
    themeHints: { backgroundColor: "#0a0f1a", playerColor: "#a78bfa", hazardColor: "#ef4444", collectibleColor: "#fbbf24", musicProfile: "pulse" },
    negatives: ["写实", "杂乱 UI"],
  },
  chess: {
    world: "棋盘对局，2 人轮流走子，将死对方为王。",
    scenes: ["开局布阵", "中盘博弈", "残局", "将死结算"],
    units: ["王/后/车/象/马/兵", "棋盘格", "玩家", "AI 对手"],
    gameplayHints: ["templateId=chess", "标准走子规则", "winScore=1（将死）", "AI 难度可调"],
    playableLoop: { verb: "走子+吃子", objective: "将死对方王", feedback: "吃子+将军提示+将死", failRetry: "被将死输局，可悔棋或再开" },
    themeHints: { backgroundColor: "#1a1a2e", playerColor: "#fbbf24", hazardColor: "#ef4444", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["写实", "动作游戏叙事"],
  },
  checkers: {
    world: "跳棋棋盘，斜走跳吃，吃光对方胜。",
    scenes: ["开局布阵", "跳吃瞬间", "升王", "吃光结算"],
    units: ["棋子", "棋盘格", "王棋", "对手"],
    gameplayHints: ["templateId=checkers", "斜走 + 跳吃 + 升王", "winScore=1（吃光/无路）", "AI 对手"],
    playableLoop: { verb: "斜走+跳吃", objective: "吃光对方/无路", feedback: "跳吃+升王+结算", failRetry: "被吃光输局，再开" },
    themeHints: { backgroundColor: "#1a1a2e", playerColor: "#fbbf24", hazardColor: "#ef4444", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["写实", "动作游戏叙事"],
  },
  "chinese-checkers": {
    world: "六角星棋盘，跨跳移动，先到对角营胜。",
    scenes: ["开局布阵", "跨跳连跳", "中盘博弈", "抵达对角营"],
    units: ["棋子", "六角星格", "玩家阵营", "对手阵营"],
    gameplayHints: ["templateId=chinese-checkers", "跨跳 + 连跳", "winScore=1（全员抵达）", "2-6 人"],
    playableLoop: { verb: "跨跳+连跳", objective: "全员抵达对角营", feedback: "连跳+抵达+结算", failRetry: "对手先抵达，再开" },
    themeHints: { backgroundColor: "#1a1a2e", playerColor: "#fbbf24", hazardColor: "#ef4444", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["写实", "动作游戏叙事"],
  },
  junqi: {
    world: "军棋棋盘，暗棋博弈，吃军旗胜。",
    scenes: ["暗棋布阵", "交锋判定", "工兵排雷", "夺旗结算"],
    units: ["军衔棋子", "棋盘", "地雷", "军旗"],
    gameplayHints: ["templateId=junqi", "暗棋 + 大小判定", "工兵排雷", "winScore=夺军旗"],
    playableLoop: { verb: "暗棋+大小判定", objective: "夺军旗", feedback: "交锋+排雷+夺旗", failRetry: "军旗被夺输局，再开" },
    themeHints: { backgroundColor: "#1a1a2e", playerColor: "#3b82f6", hazardColor: "#dc2626", collectibleColor: "#fbbf24", musicProfile: "minimal" },
    negatives: ["写实", "动作游戏叙事"],
  },
  "aeroplane-chess": {
    world: "飞行棋棋盘，掷骰起飞，绕圈抵达终点。",
    scenes: ["掷骰起飞", "绕圈行进", "撞击送回", "全员抵达"],
    units: ["飞机棋子", "骰子", "棋盘路径", "终点"],
    gameplayHints: ["templateId=aeroplane-chess", "掷骰 + 起飞规则", "撞击送回起点", "winScore=全员抵达"],
    playableLoop: { verb: "掷骰+起飞+绕圈", objective: "全员抵达终点", feedback: "撞击送回+抵达+结算", failRetry: "对手先抵达，再开" },
    themeHints: { backgroundColor: "#1a2a1a", playerColor: "#fbbf24", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["写实", "动作游戏叙事"],
  },

  // ── 卡牌 ──
  card: {
    world: "牌桌对局，2-4 人围坐，规则清晰可读。",
    scenes: ["发牌阶段", "出牌博弈", "得分结算", "终局胜负"],
    units: ["手牌", "出牌区", "牌堆", "AI 对手"],
    gameplayHints: ["templateId=card（具体到 dou-dizhu/uno/poker 等子模板）", "winScore=1（一局定胜负）", "director 弱化", "禁止动作游戏叙事"],
    playableLoop: { verb: "出牌+博弈", objective: "一局定胜负", feedback: "出牌+结算", failRetry: "输局，再开" },
    themeHints: { backgroundColor: "#1a1a2e", playerColor: "#fbbf24", hazardColor: "#ef4444", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["动作游戏波次叙事", "边境要塞/守军/箭塔", "高饱和霓虹"],
  },
  poker: {
    world: "扑克牌桌，德州/梭哈等，下注博弈 + 牌型比大小。",
    scenes: ["发底牌", "下注轮", "摊牌比牌型", "筹码结算"],
    units: ["手牌", "公共牌", "筹码", "AI 对手"],
    gameplayHints: ["templateId=poker", "下注 + 牌型比大小", "winScore=1 或筹码制", "AI 诈唬/跟注"],
    playableLoop: { verb: "下注+牌型比大小", objective: "赢筹码/一局", feedback: "下注+摊牌+筹码", failRetry: "筹码归零/输局，再开" },
    themeHints: { backgroundColor: "#0a3d2e", playerColor: "#fbbf24", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "minimal" },
    negatives: ["动作游戏叙事", "写实赌场"],
  },
  solitaire: {
    world: "单人纸牌接龙，整理牌堆到花色顺序。",
    scenes: ["翻牌布局", "移动接龙", "翻新牌", "全部接龙完成"],
    units: ["牌列", "牌堆", "花色基础堆", "翻牌区"],
    gameplayHints: ["templateId=solitaire", "红黑交替接龙", "花色升序到基础堆", "winScore=1（全完成）"],
    playableLoop: { verb: "红黑交替接龙", objective: "全部接龙完成", feedback: "接龙+翻牌+完成", failRetry: "死局可重置" },
    themeHints: { backgroundColor: "#0a3d2e", playerColor: "#fbbf24", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "minimal" },
    negatives: ["动作游戏叙事", "杂乱 UI"],
  },
  blackjack: {
    world: "21 点牌桌，要牌/停牌，逼近 21 不爆。",
    scenes: ["发底牌", "要牌/停牌", "庄家翻牌", "胜负结算"],
    units: ["手牌", "庄家牌", "筹码", "牌堆"],
    gameplayHints: ["templateId=blackjack", "逼近 21 不爆", "庄家 17 停牌", "winScore=1 或筹码制"],
    playableLoop: { verb: "要牌+停牌", objective: "逼近 21 不爆", feedback: "要牌+庄家翻牌+结算", failRetry: "爆牌/输局，再开" },
    themeHints: { backgroundColor: "#0a3d2e", playerColor: "#fbbf24", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "minimal" },
    negatives: ["动作游戏叙事", "写实赌场"],
  },
  mahjong: {
    world: "4 人麻将桌，碰杠胡，立直/国标规则。",
    scenes: ["起手配牌", "摸打碰杠", "听牌瞬间", "胡牌结算"],
    units: ["手牌", "牌河", "碰杠组", "AI 对手"],
    gameplayHints: ["templateId=mahjong", "碰杠胡规则", "winScore=1（一局定胜负）", "AI 配合/防守"],
    playableLoop: { verb: "摸打碰杠胡", objective: "胡牌定胜负", feedback: "碰杠动画+胡牌高光+番数结算", failRetry: "流局或别家胡牌，一局定胜负可再开" },
    themeHints: { backgroundColor: "#0a3d2e", playerColor: "#fbbf24", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["动作游戏叙事", "边境要塞/守军"],
  },
  "mahjong-solitaire": {
    world: "单人麻将接龙，配对消除麻将牌。",
    scenes: ["牌堆布局", "配对消除", "露新牌", "全部消除"],
    units: ["麻将牌", "牌堆", "配对提示", "洗牌道具"],
    gameplayHints: ["templateId=mahjong-solitaire", "同牌配对消除", "露牌可消", "winScore=1（全消）"],
    playableLoop: { verb: "配对消除", objective: "全部消除", feedback: "配对+露牌+消完", failRetry: "死局可洗牌" },
    themeHints: { backgroundColor: "#0a3d2e", playerColor: "#fbbf24", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["动作游戏叙事", "杂乱 UI"],
  },
  "dou-dizhu": {
    world: "斗地主牌桌，3 人叫地主出牌比大小，春天反春。",
    scenes: ["发牌 + 叫地主", "出牌博弈", "AI 互助配合", "胜负结算"],
    units: ["手牌（17+3）", "出牌区", "底牌", "AI 对手（2 家）"],
    gameplayHints: ["templateId=dou-dizhu", "叫地主 + 出牌比大小", "春天/反春判定", "winScore=1"],
    playableLoop: { verb: "叫地主+出牌比大小", objective: "先出完手牌", feedback: "出牌动画+春天反春+结算", failRetry: "对手先出完，一局定胜负可再开" },
    themeHints: { backgroundColor: "#0a3d2e", playerColor: "#fbbf24", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["动作游戏叙事", "边境要塞/守军"],
  },
  uno: {
    world: "UNO 牌桌，颜色/数字匹配出牌，特殊牌互动。",
    scenes: ["发牌", "出牌匹配", "+2/+4 反制", "UNO 喊牌结算"],
    units: ["手牌", "弃牌堆", "特殊牌", "AI 对手"],
    gameplayHints: ["templateId=uno", "颜色/数字匹配", "+2/+4/反转/跳过", "winScore=1（出完）"],
    playableLoop: { verb: "颜色/数字匹配出牌", objective: "先出完手牌", feedback: "+2/+4/反转/UNO 喊牌", failRetry: "对手先出完，再开" },
    themeHints: { backgroundColor: "#1a1a2e", playerColor: "#fbbf24", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["动作游戏叙事", "杂乱 UI"],
  },

  // ── 模拟/经营 ──
  farming: {
    world: "田园农场，种植/养殖/收获，季节循环经营。",
    scenes: ["翻地播种", "浇水成长", "收获售卖", "季节变换"],
    units: ["玩家农夫", "作物", "牲畜", "金币"],
    gameplayHints: ["templateId=farming", "种植 + 浇水 + 收获循环", "金币扩展经营", "无强失败条件"],
    playableLoop: { verb: "种植+浇水+收获", objective: "积累目标金币/等级", feedback: "作物成长+收获金币+扩建", failRetry: "无强失败，枯萎可补种" },
    themeHints: { backgroundColor: "#1a2a14", playerColor: "#84cc16", hazardColor: "#a65f3f", collectibleColor: "#fbbf24", musicProfile: "organic" },
    negatives: ["写实", "暴力", "高饱和霓虹"],
  },
  garden: {
    world: "花园种植空间，种花/浇水/装饰，休闲治愈。",
    scenes: ["种花布局", "浇水成长", "开花展示", "装饰摆放"],
    units: ["花种", "花盆/地块", "装饰物", "浇水工具"],
    gameplayHints: ["templateId=garden（复用 farming）", "种花 + 浇水 + 装饰", "无失败条件", "治愈节奏"],
    playableLoop: { verb: "种花+浇水+装饰", objective: "花园等级/美观度", feedback: "开花+装饰+扩建", failRetry: "无强失败，枯萎可补种" },
    themeHints: { backgroundColor: "#1a2220", playerColor: "#8faf8c", hazardColor: "#a65f3f", collectibleColor: "#c9a66b", musicProfile: "organic" },
    negatives: ["写实", "暴力", "恐怖"],
  },
  cafe: {
    world: "咖啡店经营空间，接单/制作/上餐，顾客满意度。",
    scenes: ["顾客进店", "点单制作", "上餐收钱", "关店结算"],
    units: ["玩家店主", "顾客", "食材/饮品", "金币"],
    gameplayHints: ["templateId=cafe", "接单 + 制作 + 上餐", "满意度/排队", "金币升级"],
    playableLoop: { verb: "接单+制作+上餐", objective: "目标营收/满意度", feedback: "收钱+满意+好评", failRetry: "满意度过低/排队爆满，重开" },
    themeHints: { backgroundColor: "#2a1a14", playerColor: "#fbbf24", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["写实", "暴力"],
  },
  cooking: {
    world: "厨房烹饪空间，按食谱备料/烹饪/出餐。",
    scenes: ["备料段", "烹饪火候", "出餐摆盘", "评分结算"],
    units: ["玩家厨师", "食材", "厨具", "菜品"],
    gameplayHints: ["templateId=cooking", "备料 + 烹饪 + 出餐", "火候/时机", "评分/连击"],
    playableLoop: { verb: "备料+烹饪+出餐", objective: "目标评分/连击", feedback: "火候+出餐+评分", failRetry: "超时/烧糊扣分，重开" },
    themeHints: { backgroundColor: "#2a1a14", playerColor: "#f59e0b", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["写实", "暴力"],
  },
  tycoon: {
    world: "经营建造空间，规划/建造/盈利，模拟经营。",
    scenes: ["规划布局", "建造设施", "盈利循环", "扩展升级"],
    units: ["玩家经营者", "设施建筑", "顾客/资源", "金币"],
    gameplayHints: ["templateId=tycoon", "建造 + 经营 + 盈利", "目标=资产/等级", "无强失败"],
    playableLoop: { verb: "建造+经营+盈利", objective: "资产/等级达标", feedback: "盈利+扩建+升级", failRetry: "破产失败，重开" },
    themeHints: { backgroundColor: "#1a1a2e", playerColor: "#fbbf24", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["写实", "杂乱 UI"],
  },
  pet: {
    world: "宠物养育空间，喂食/互动/养成，治愈陪伴。",
    scenes: ["喂食互动", "清洁玩耍", "成长阶段", "状态展示"],
    units: ["宠物", "食物/玩具", "状态条", "装饰"],
    gameplayHints: ["templateId=pet", "喂食 + 互动 + 养成", "状态衰减循环", "无强失败"],
    playableLoop: { verb: "喂食+互动+养成", objective: "宠物成长/等级", feedback: "互动+成长+状态", failRetry: "状态过低离家出走，重开" },
    themeHints: { backgroundColor: "#1a2220", playerColor: "#8faf8c", hazardColor: "#a65f3f", collectibleColor: "#fbbf24", musicProfile: "organic" },
    negatives: ["写实", "暴力", "恐怖"],
  },
  idle: {
    world: "放置挂机空间，自动产出 + 升级加速，离线收益。",
    scenes: ["自动产出", "升级加速", "里程碑解锁", "离线结算"],
    units: ["产出单位", "升级节点", "自动器", "金币"],
    gameplayHints: ["templateId=idle", "自动产出 + 升级", "离线收益", "无强失败"],
    playableLoop: { verb: "放置+升级加速", objective: "资产里程碑", feedback: "产出+升级+离线收益", failRetry: "无强失败，持续累积" },
    themeHints: { backgroundColor: "#0f0f1a", playerColor: "#a78bfa", hazardColor: "#dc2626", collectibleColor: "#fbbf24", musicProfile: "minimal" },
    negatives: ["写实", "杂乱"],
  },
  customization: {
    world: "自定义/装扮空间，选配/上色/摆放，创意表达。",
    scenes: ["选配素材", "上色/调整", "摆放布局", "作品展示"],
    units: ["素材库", "调色板", "摆放区", "作品"],
    gameplayHints: ["templateId=customization", "选配 + 上色 + 摆放", "无失败条件", "创意优先"],
    playableLoop: { verb: "选配+上色+摆放", objective: "完成作品", feedback: "创意表达+作品展示", failRetry: "无失败条件，自由创作" },
    themeHints: { backgroundColor: "#fef3c7", playerColor: "#f59e0b", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["写实", "暴力", "恐怖"],
  },
  "dating-sim": {
    world: "对话互动空间，选项推进关系，多结局分支。",
    scenes: ["对话开场", "选项分支", "关系推进", "结局达成"],
    units: ["玩家", "NPC 角色", "对话选项", "好感度"],
    gameplayHints: ["templateId=dating-sim", "选项驱动 + 好感度", "多结局分支", "无强失败"],
    playableLoop: { verb: "对话+选项", objective: "达成结局", feedback: "好感+分支+结局", failRetry: "坏结局可重选" },
    themeHints: { backgroundColor: "#2a1420", playerColor: "#f472b6", hazardColor: "#dc2626", collectibleColor: "#fbbf24", musicProfile: "organic" },
    negatives: ["写实", "过度文字 UI", "畸形人体"],
  },
  sandbox: {
    world: "开放沙盒空间，自由建造/探索，无固定目标。",
    scenes: ["自由探索", "建造/创造", "资源采集", "玩家自定目标"],
    units: ["玩家", "方块/素材", "工具", "环境"],
    gameplayHints: ["templateId=sandbox", "自由建造 + 探索", "无固定目标", "创意优先"],
    playableLoop: { verb: "自由建造+探索", objective: "玩家自定目标", feedback: "创造+采集+成就", failRetry: "无失败，自由探索" },
    themeHints: { backgroundColor: "#1a2a3a", playerColor: "#38bdf8", hazardColor: "#dc2626", collectibleColor: "#a3e635", musicProfile: "organic" },
    negatives: ["写实", "杂乱"],
  },

  // ── 收集/闪避/节奏/体育 ──
  collector: {
    world: "单屏/卷轴场景，移动收集物品 + 避威胁，节奏舒缓。",
    scenes: ["移动收集段", "威胁闪避", "连击收集", "目标分通关"],
    units: ["玩家", "收集物", "缓慢威胁", "障碍"],
    gameplayHints: ["templateId=collector", "收集 + 闪避", "winScore=收集数", "节奏偏缓"],
    playableLoop: { verb: "移动+收集+闪避", objective: "收集目标数", feedback: "拾取+连击+通关", failRetry: "碰威胁扣命，命 0 失败" },
    themeHints: { backgroundColor: "#1a2220", playerColor: "#8faf8c", hazardColor: "#a65f3f", collectibleColor: "#fbbf24", musicProfile: "organic" },
    negatives: ["写实", "暴力"],
  },
  avoider: {
    world: "单屏场景，移动闪避弹幕/障碍，存活计时。",
    scenes: ["弹幕压进", "走位闪避", "危机逼近", "存活通关"],
    units: ["玩家", "弹幕/障碍", "安全区", "计时"],
    gameplayHints: ["templateId=avoider", "闪避 + 存活", "winScore=存活时间", "弹幕密度递增"],
    playableLoop: { verb: "走位闪避", objective: "存活目标时间", feedback: "险闪+计时里程碑", failRetry: "被弹幕命中扣命/即死，重开" },
    themeHints: { backgroundColor: "#0a0f1a", playerColor: "#38bdf8", hazardColor: "#ef4444", collectibleColor: "#fbbf24", musicProfile: "pulse" },
    negatives: ["写实", "暴力"],
  },
  "pokemon-battle": {
    world: "回合制对战，属性相克 + 技能选择，HP 归零判定。",
    scenes: ["对战开场", "技能选择", "属性相克命中", "HP 归零结算"],
    units: ["玩家生物", "敌方生物", "技能列表", "HP 条"],
    gameplayHints: ["templateId=pokemon-battle", "回合制 + 属性相克", "技能 4 槽", "winScore=1（全歼）"],
    playableLoop: { verb: "回合+属性相克+技能", objective: "全歼对方", feedback: "命中+相克+结算", failRetry: "全灭失败，重开" },
    themeHints: { backgroundColor: "#0f1a2a", playerColor: "#38bdf8", hazardColor: "#ef4444", collectibleColor: "#a3e635", musicProfile: "pulse" },
    negatives: ["写实", "版权 IP", "畸形"],
  },
  rhythm: {
    world: "节奏音符轨道，按键/触屏踩拍，连击得分。",
    scenes: ["音符下落", "踩拍命中", "连击 combo", "结算评级"],
    units: ["音符", "判定线", "按键区", "连击数"],
    gameplayHints: ["templateId=rhythm", "音符踩拍", "Perfect/Good/Miss 判定", "score=连击/准确率"],
    playableLoop: { verb: "按键踩拍", objective: "完成曲目达目标准确率", feedback: "Perfect/Good 判定+combo+评级", failRetry: "Miss 过多扣血，血 0 失败，重开" },
    themeHints: { backgroundColor: "#0a0a14", playerColor: "#a78bfa", hazardColor: "#ef4444", collectibleColor: "#fbbf24", musicProfile: "pulse" },
    negatives: ["写实", "杂乱"],
  },
  sports: {
    world: "体育球场/赛道，闪避/得分/竞速，竞技感。",
    scenes: ["场地对抗", "得分/超车", "防守闪避", "终场结算"],
    units: ["运动员", "球/目标物", "防守者", "记分牌"],
    gameplayHints: ["templateId=sports", "得分/竞速", "combo 反馈", "director goalShift"],
    playableLoop: { verb: "竞技+得分/竞速", objective: "达目标分/圈速", feedback: "得分+combo+终场", failRetry: "超时未达标失败，重开" },
    themeHints: { backgroundColor: "#142818", playerColor: "#4caf88", hazardColor: "#c04040", collectibleColor: "#f0d040", musicProfile: "pulse" },
    negatives: ["写实转播", "暴力格斗", "真实球星肖像"],
  },
};

/** 兜底：未命中的 templateId 返回 null，调用方走 general-arcade */
export function getTemplateBriefOverride(templateId: string | undefined | null): TemplateBriefOverride | null {
  if (!templateId || templateId === "auto") return null;
  return TEMPLATE_BRIEF_OVERRIDES[templateId as GameTemplateId] ?? null;
}
