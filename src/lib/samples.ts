export type SampleShelf = "featured" | "trending";

/** 样品数据：试玩截图封面在 public/samples/{id}.png；astrocade 旧 WebP 逐步替换为实机 PNG。 */
export type Sample = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  tags: string[];
  /** 竖版封面（可换为 WebP 截图，路径在 public/） */
  coverImageSrc: string;
  coverAlt: string;
  /** 图片加载失败时的底衬 */
  coverGradient: string;
  /** 角标装饰色 */
  accentGlow: string;
  emoji: string;
  plays: string;
  creator: string;
  shelf: SampleShelf;
  badge?: "hot" | "new";
  /** 真实截图封面：不在图上叠标题/emoji，标题移到卡片下方 */
  photoCover?: boolean;
};

/** 已从样品馆下架（DB seed 时会清理对应 project） */
export const PRUNED_SAMPLE_IDS = [
  "ultimate-3d-chess",
  "rail-in-air",
  "whimsy-differences",
  "memory-match-mania",
  "kids-puzzle",
  "car-color-palette",
  "state-conquest",
  "tiny-planet-chopper",
  "blocky-sniper-hunter",
] as const;

export const SAMPLES: Sample[] = [
  {
    id: "number-merge-2048",
    title: "2048 Neon Merge",
    subtitle: "数字合成 · 4x4 滑动 · 鲜明色块",
    prompt:
      "做一个 2048 数字合成小游戏：4x4 棋盘，玩家上下左右滑动数字块，相同数字合并升级，目标合成 2048；色彩鲜明、按钮清晰、带分数/最高分/重新开始/悔一步，节奏轻快。",
    tags: ["2048", "数字合成", "益智", "鲜明色彩"],
    coverImageSrc: "/samples/number-merge-2048.png",
    coverAlt: "2048 Neon Merge — colorful number merge board cover",
    coverGradient: "linear-gradient(145deg, #facc15 0%, #fb923c 36%, #ef4444 62%, #22d3ee 100%)",
    accentGlow: "rgba(251, 146, 60, 0.45)",
    emoji: "🔢",
    plays: "128K",
    creator: "operone",
    shelf: "featured",
    badge: "new",
    photoCover: true,
  },
  {
    id: "classic-xiangqi-board",
    title: "Chinese Xiangqi",
    subtitle: "中国象棋 · 楚河汉界 · 红黑对弈",
    prompt:
      "做一个中国象棋小游戏：9x10 棋盘，红黑双方完整子力，有楚河汉界、帅将车马炮兵卒，点击棋子显示合法走法，AI 会回应，棋盘清晰、古典木纹、红黑棋子醒目。",
    tags: ["中国象棋", "棋盘", "策略", "红黑对弈"],
    coverImageSrc: "/samples/classic-xiangqi-board.png",
    coverAlt: "Chinese Xiangqi — readable wooden xiangqi board cover",
    coverGradient: "linear-gradient(145deg, #f59e0b 0%, #fde68a 36%, #b91c1c 68%, #7c2d12 100%)",
    accentGlow: "rgba(185, 28, 28, 0.42)",
    emoji: "♟",
    plays: "118K",
    creator: "operone",
    shelf: "featured",
    badge: "new",
    photoCover: true,
  },
  {
    id: "classic-international-chess",
    title: "International Chess",
    subtitle: "国际象棋 · 8x8 棋盘 · 合法走法",
    prompt:
      "做一个国际象棋小游戏：8x8 棋盘，黑白双方国王和兵等棋子，点击棋子显示合法走法，AI 会回应；棋盘和棋子要高对比、清楚、有经典桌游质感。",
    tags: ["国际象棋", "Chess", "策略", "高对比"],
    coverImageSrc: "/samples/classic-international-chess.png",
    coverAlt: "International Chess — high contrast classic chess board cover",
    coverGradient: "linear-gradient(145deg, #111827 0%, #64748b 42%, #f8fafc 70%, #fbbf24 100%)",
    accentGlow: "rgba(248, 250, 252, 0.36)",
    emoji: "♔",
    plays: "104K",
    creator: "operone",
    shelf: "featured",
    badge: "new",
    photoCover: true,
  },
  {
    id: "temple-relic-runner",
    title: "Temple Relic Runner",
    subtitle: "神庙逃亡 · 三线跑酷 · 遗迹躲避",
    prompt:
      "做一个类似神庙逃亡的竖向跑酷小游戏：玩家在丛林神庙遗迹里自动向前奔跑，用左右键或点击左右半屏在三条石板路之间换道，躲避滚石、断柱和尖刺，收集金币遗物，距离越远速度越快；画面要有金色夕阳、绿色藤蔓、古代石门和强烈速度感。",
    tags: ["神庙逃亡", "跑酷", "三线躲避", "遗迹"],
    coverImageSrc: "/samples/temple-relic-runner.png",
    coverAlt: "Temple Relic Runner — jungle temple lane runner cover",
    coverGradient: "linear-gradient(145deg, #064e3b 0%, #16a34a 30%, #f59e0b 62%, #7c2d12 100%)",
    accentGlow: "rgba(245, 158, 11, 0.42)",
    emoji: "🏃",
    plays: "136K",
    creator: "operone",
    shelf: "featured",
    badge: "new",
    photoCover: true,
  },
  {
    id: "zen-go-board",
    title: "Zen Go Board",
    subtitle: "围棋落子 · 黑白对弈 · 木纹棋盘",
    prompt:
      "做一个围棋小游戏：19x19 木纹棋盘，黑白双方轮流落子，显示坐标、最近一手、提子反馈和简单 AI 回应；视觉要清爽明亮，棋子立体有光泽，适合快速体验围棋布局。",
    tags: ["围棋", "棋盘", "策略", "木纹"],
    coverImageSrc: "/samples/zen-go-board.png",
    coverAlt: "Zen Go Board — bright wooden Go board cover",
    coverGradient: "linear-gradient(145deg, #f59e0b 0%, #fef3c7 42%, #111827 68%, #f8fafc 100%)",
    accentGlow: "rgba(245, 158, 11, 0.38)",
    emoji: "⚫",
    plays: "96K",
    creator: "operone",
    shelf: "featured",
    badge: "new",
    photoCover: true,
  },
  {
    id: "jungle-animal-chess",
    title: "Jungle Animal Chess",
    subtitle: "斗兽棋 · 动物子力 · 陷阱兽穴",
    prompt:
      "做一个斗兽棋小游戏：7x9 棋盘，有河流、陷阱和兽穴，双方动物棋子包括象狮虎豹狼狗猫鼠；点击棋子显示合法走法，吃子有鲜明反馈，整体色彩明亮、儿童友好。",
    tags: ["斗兽棋", "动物", "策略", "儿童友好"],
    coverImageSrc: "/samples/jungle-animal-chess.png",
    coverAlt: "Jungle Animal Chess — colorful animal strategy board cover",
    coverGradient: "linear-gradient(145deg, #38bdf8 0%, #86efac 32%, #fef08a 62%, #f97316 100%)",
    accentGlow: "rgba(56, 189, 248, 0.42)",
    emoji: "🦁",
    plays: "84K",
    creator: "operone",
    shelf: "featured",
    badge: "new",
    photoCover: true,
  },
  {
    id: "smash-the-dummy",
    title: "Smash the Dummy",
    subtitle: "物理发泄 · 连击评分 · 夸张反馈",
    prompt:
      "做一个解压向物理小游戏：场景里有一个可被打、踢、投掷的 dummy 假人，玩家点击或拖拽武器砸向它，触发连击计数、屏幕震动和夸张粒子；要有多种打击方式、分数与连击 HUD，整体节奏爽快、反馈强。",
    tags: ["解压", "物理", "连击", "街机"],
    coverImageSrc: "/samples/smash-the-dummy.png",
    coverAlt: "Smash the Dummy — stress-relief physics game cover",
    coverGradient: "linear-gradient(155deg, #1a0a2e 0%, #7c2d12 45%, #f97316 78%, #fde047 100%)",
    accentGlow: "rgba(249, 115, 22, 0.42)",
    emoji: "💥",
    plays: "6.2M",
    creator: "zhenhua.qi",
    shelf: "featured",
    badge: "hot",
    photoCover: true,
  },
  {
    id: "grow-a-garden",
    title: "Grow a Garden",
    subtitle: "种植养成 · 浇水收获 · 轻度模拟",
    prompt:
      "做一个休闲种植小游戏：网格地块上播种、浇水、等待生长并收获；有金币经济、可购买新种子与装饰，UI 清新可爱，带简单教程与进度目标。",
    tags: ["种植", "休闲", "模拟", "养成"],
    coverImageSrc: "/samples/grow-a-garden.png",
    coverAlt: "Grow a Garden — casual farming sim cover",
    coverGradient: "linear-gradient(150deg, #052e16 0%, #15803d 40%, #86efac 75%, #fef9c3 100%)",
    accentGlow: "rgba(34, 197, 94, 0.38)",
    emoji: "🌱",
    plays: "863K",
    creator: "dawn",
    shelf: "featured",
    photoCover: true,
  },
  {
    id: "color-bloom",
    title: "开心消消乐",
    subtitle: "动物三消 · 交换消除 · 关卡目标",
    prompt:
      "做一个开心消消乐风格三消益智游戏：9x9 棋盘上有青蛙、河马、狐狸、猫头鹰、小鸡五种可爱动物，玩家交换相邻动物连成 3 个及以上消除，上方显示关卡、分数进度和剩余步数，配色明亮、木质边框、蓝天绿叶背景。",
    tags: ["开心消消乐", "三消", "动物", "益智"],
    coverImageSrc: "/samples/color-bloom.png",
    coverAlt: "Color Bloom — color-matching puzzle cover",
    coverGradient: "linear-gradient(145deg, #312e81 0%, #7c3aed 38%, #f472b6 72%, #fde68a 100%)",
    accentGlow: "rgba(244, 114, 182, 0.4)",
    emoji: "🎨",
    plays: "503K",
    creator: "emanfatima",
    shelf: "featured",
    photoCover: true,
  },
  {
    id: "gun-merge-3d-zombie-apocalypse",
    title: "Gun Merge 3D: Zombie Apocalypse",
    subtitle: "枪械合成 · 塔防射击 · 僵尸潮",
    prompt:
      "做一个 3D 俯视射击+合成游戏：玩家合并同级枪械升级火力，在场地边缘布置或手持射击，抵御多波僵尸；有 merge 网格、波次、金币掉落与基地 HP，氛围偏末日但 Q 版低多边形。",
    tags: ["合成", "射击", "塔防", "僵尸"],
    coverImageSrc: "/samples/gun-merge-3d-zombie-apocalypse.png",
    coverAlt: "Gun Merge 3D: Zombie Apocalypse — merge shooter cover",
    coverGradient: "linear-gradient(155deg, #0f172a 0%, #14532d 35%, #84cc16 68%, #713f12 100%)",
    accentGlow: "rgba(132, 204, 22, 0.35)",
    emoji: "🔫",
    plays: "355K",
    creator: "archeologist",
    shelf: "featured",
    badge: "new",
    photoCover: true,
  },
  {
    id: "elastic-thief-2",
    title: "Elastic Thief 2",
    subtitle: "伸缩潜行 · 物理摆荡 · 偷取目标",
    prompt:
      "做一个潜行物理小游戏：玩家控制可伸缩/elastic 的角色摆荡或伸长去偷取场景中的目标物品，避开守卫与激光；关卡短平快，强调物理手感与失败重试。",
    tags: ["潜行", "物理", "闯关", "解谜"],
    coverImageSrc: "/samples/elastic-thief-2.png",
    coverAlt: "Elastic Thief 2 — elastic stealth puzzle cover",
    coverGradient: "linear-gradient(155deg, #172554 0%, #1d4ed8 38%, #38bdf8 72%, #fbbf24 100%)",
    accentGlow: "rgba(56, 189, 248, 0.38)",
    emoji: "🥷",
    plays: "2.2M",
    creator: "SkulHunter",
    shelf: "trending",
    badge: "hot",
    photoCover: true,
  },
  {
    id: "blade-defender-merge",
    title: "Blade Defender Merge",
    subtitle: "剑刃合成 · 防线塔防 · 波次升级",
    prompt:
      "做一个 merge + 塔防混合游戏：在格子上合并同级 blade/剑塔提升攻击力，自动攻击沿路径前进的敌人；有多波次、金币与技能冷却，视觉偏奇幻 RPG。（原创敌人与剑塔造型）",
    tags: ["合成", "塔防", "波次", "奇幻"],
    coverImageSrc: "/samples/blade-defender-merge.png",
    coverAlt: "Blade Defender Merge — merge tower defense cover",
    coverGradient: "linear-gradient(150deg, #312e81 0%, #7e22ce 40%, #c084fc 70%, #1e293b 100%)",
    accentGlow: "rgba(192, 132, 252, 0.38)",
    emoji: "⚔️",
    plays: "113K",
    creator: "SkulHunter",
    shelf: "trending",
    photoCover: true,
  },
  {
    id: "pottery-master-3d",
    title: "Pottery Master 3D",
    subtitle: "3D 陶艺 · 拉坯转盘 · 釉色定制",
    prompt:
      "做一个 3D 陶艺拉坯小游戏：转盘上的湿 clay 随点击拉高成花瓶，玩家从调色盘选釉色/口沿/底座颜色，转盘旋转展示成品；操作简单、反馈即时，完成若干次上色即过关。",
    tags: ["陶艺", "3D", "定制", "创意"],
    coverImageSrc: "/samples/pottery-master-3d.png",
    coverAlt: "Pottery Master 3D — pottery wheel creative cover",
    coverGradient: "linear-gradient(155deg, #78350f 0%, #b45309 38%, #fcd34d 72%, #fef3c7 100%)",
    accentGlow: "rgba(180, 83, 9, 0.38)",
    emoji: "🏺",
    plays: "1.1M",
    creator: "Majisok",
    shelf: "trending",
    badge: "new",
    photoCover: true,
  },
  {
    id: "crashy-roads",
    title: "Crashy Roads",
    subtitle: "无尽公路 · 换道躲避 · 距离得分",
    prompt:
      "做一个无尽公路驾驶小游戏：车辆自动前进，玩家用左右键换道躲避障碍与抛锚车辆，强调距离得分与碰撞减命；伪 3D 透视公路，节奏越来越快。",
    tags: ["竞速", "无尽", "躲避", "街机"],
    coverImageSrc: "/samples/crashy-roads.png",
    coverAlt: "Crashy Roads — endless swerve driving cover",
    coverGradient: "linear-gradient(150deg, #1e3a8a 0%, #2563eb 40%, #fbbf24 70%, #ef4444 100%)",
    accentGlow: "rgba(37, 99, 235, 0.38)",
    emoji: "🚗",
    plays: "890K",
    creator: "highsmith",
    shelf: "trending",
    badge: "hot",
    photoCover: true,
  },
];

const SHELF_META: Record<
  SampleShelf,
  { title: string; description: string; cardClass: string }
> = {
  featured: {
    title: "Players' Choice",
    description: "Community favorites — tap to play instantly",
    cardClass: "w-[min(88vw,280px)] shrink-0 snap-start sm:w-[260px]",
  },
  trending: {
    title: "Trending",
    description: "Rising hits across merge, strategy, puzzle and arcade",
    cardClass: "w-[min(78vw,200px)] shrink-0 snap-start sm:w-[200px]",
  },
};

export function samplesByShelf(shelf: SampleShelf): Sample[] {
  return SAMPLES.filter((s) => s.shelf === shelf);
}

export function shelfConfig(shelf: SampleShelf) {
  return SHELF_META[shelf];
}

export const SAMPLE_SHELVES: SampleShelf[] = ["featured", "trending"];
