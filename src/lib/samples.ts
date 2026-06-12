export type SampleShelf = "featured" | "trending";

/** 样品数据：竖版封面主资源在 public/samples/astrocade/（4:5 WebP/JPG）；public/samples/*.svg 为 Operone 品牌渐变回退占位。 */
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

export const SAMPLES: Sample[] = [
  {
    id: "smash-the-dummy",
    title: "Smash the Dummy",
    subtitle: "物理发泄 · 连击评分 · 夸张反馈",
    prompt:
      "做一个解压向物理小游戏：场景里有一个可被打、踢、投掷的 dummy 假人，玩家点击或拖拽武器砸向它，触发连击计数、屏幕震动和夸张粒子；要有多种打击方式、分数与连击 HUD，整体节奏爽快、反馈强。",
    tags: ["解压", "物理", "连击", "街机"],
    coverImageSrc: "/samples/astrocade/smash-the-dummy.webp",
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
    id: "rail-in-air",
    title: "Rail in Air",
    subtitle: "空中轨道 · 过山车视角 · 速度冲刺",
    prompt:
      "做一个 3D 空中轨道/过山车竞速小游戏：玩家在立体悬空的轨道上高速前进，可在第一人称与第三人称视角切换；轨道有弯道、爬升、俯冲与跳跃段，强调速度感与离心力反馈，带计时或距离得分 HUD。视觉偏明亮卡通 3D。",
    tags: ["过山车", "3D", "竞速", "视角切换"],
    coverImageSrc: "/samples/astrocade/rail-in-air.webp",
    coverAlt: "Rail in Air — 3D aerial coaster thrill ride cover",
    coverGradient: "linear-gradient(155deg, #0c4a6e 0%, #0284c7 35%, #38bdf8 68%, #fde047 100%)",
    accentGlow: "rgba(56, 189, 248, 0.4)",
    emoji: "🎢",
    plays: "3.8M",
    creator: "Majisok",
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
    coverImageSrc: "/samples/astrocade/grow-a-garden.webp",
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
    title: "Color Bloom",
    subtitle: "色彩消除 · 连锁 bloom · 治愈视觉",
    prompt:
      "做一个色彩消除类益智小游戏：点击相邻同色块形成 bloom 连锁，清除后上方方块下落；关卡目标清晰，配色柔和饱和，带连击特效与步数/时间限制。",
    tags: ["消除", "益智", "连锁", "治愈"],
    coverImageSrc: "/samples/astrocade/color-bloom.webp",
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
    id: "whimsy-differences",
    title: "Whimsy Differences",
    subtitle: "找不同 · 双图对比 · 限时挑战",
    prompt:
      "做一个找不同小游戏：左右两幅插画仅几处细节不同，玩家点击差异处圈出；有多关卡、倒计时与提示次数，画风 whimsical 手绘，差异难度递进。",
    tags: ["找不同", "观察", "限时", "手绘"],
    coverImageSrc: "/samples/astrocade/whimsy-differences.webp",
    coverAlt: "Whimsy Differences — spot-the-difference puzzle cover",
    coverGradient: "linear-gradient(160deg, #1e1b4b 0%, #6366f1 42%, #a5b4fc 70%, #fce7f3 100%)",
    accentGlow: "rgba(99, 102, 241, 0.38)",
    emoji: "🔍",
    plays: "570K",
    creator: "SkulHunter",
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
    coverImageSrc: "/samples/astrocade/gun-merge-3d-zombie-apocalypse.jpg",
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
    id: "ultimate-3d-chess",
    title: "Ultimate 3D Chess",
    subtitle: "3D 棋盘 · 回合策略 · 经典规则",
    prompt:
      "做一个 3D 视角国际象棋小游戏：标准规则，可点击棋子显示合法走法，带简单 AI 对手、悔一步与将军提示；棋盘与棋子用 stylized 3D 或等距视角，操作清晰。",
    tags: ["棋类", "策略", "3D", "回合"],
    coverImageSrc: "/samples/astrocade/ultimate-3d-chess.jpg",
    coverAlt: "Ultimate 3D Chess — stylized chess cover",
    coverGradient: "linear-gradient(150deg, #0c0a09 0%, #44403c 40%, #d6d3d1 70%, #78716c 100%)",
    accentGlow: "rgba(214, 211, 209, 0.32)",
    emoji: "♟️",
    plays: "467K",
    creator: "blackwidowink",
    shelf: "featured",
    photoCover: true,
  },
  {
    id: "elastic-thief-2",
    title: "Elastic Thief 2",
    subtitle: "伸缩潜行 · 物理摆荡 · 偷取目标",
    prompt:
      "做一个潜行物理小游戏：玩家控制可伸缩/elastic 的角色摆荡或伸长去偷取场景中的目标物品，避开守卫与激光；关卡短平快，强调物理手感与失败重试。",
    tags: ["潜行", "物理", "闯关", "解谜"],
    coverImageSrc: "/samples/astrocade/elastic-thief-2.webp",
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
    id: "state-conquest",
    title: "State Conquest",
    subtitle: "区域占领 · 数值对抗 · 地图策略",
    prompt:
      "做一个地图征服策略小游戏：若干区域节点，玩家与 AI 轮流派兵占领相邻区域，占领全部或达到分数即胜；有兵力数字、动画反馈与难度递增。",
    tags: ["策略", "占领", "地图", "回合"],
    coverImageSrc: "/samples/astrocade/state-conquest.webp",
    coverAlt: "State Conquest — territory conquest strategy cover",
    coverGradient: "linear-gradient(150deg, #1e3a8a 0%, #2563eb 40%, #93c5fd 70%, #dc2626 100%)",
    accentGlow: "rgba(37, 99, 235, 0.38)",
    emoji: "🗺️",
    plays: "1M",
    creator: "dawn",
    shelf: "trending",
    photoCover: true,
  },
  {
    id: "tiny-planet-chopper",
    title: "Tiny Planet Chopper",
    subtitle: "迷你星球 · 环绕飞行 · 收集斩击",
    prompt:
      "做一个 tiny planet 环绕飞行小游戏：小星球表面有树木/障碍，直升机或 chopper 环绕星球飞行，玩家点击斩击收集资源并躲避障碍；单指操作，节奏轻快。（原创星球与载具造型）",
    tags: ["休闲", "环绕", "收集", "单指"],
    coverImageSrc: "/samples/astrocade/tiny-planet-chopper.webp",
    coverAlt: "Tiny Planet Chopper — orbit chopper arcade cover",
    coverGradient: "linear-gradient(155deg, #064e3b 0%, #059669 38%, #6ee7b7 72%, #0ea5e9 100%)",
    accentGlow: "rgba(5, 150, 105, 0.38)",
    emoji: "🚁",
    plays: "472K",
    creator: "Sturmjager",
    shelf: "trending",
    photoCover: true,
  },
  {
    id: "blade-defender-merge",
    title: "Blade Defender Merge",
    subtitle: "剑刃合成 · 防线塔防 · 波次升级",
    prompt:
      "做一个 merge + 塔防混合游戏：在格子上合并同级 blade/剑塔提升攻击力，自动攻击沿路径前进的敌人；有多波次、金币与技能冷却，视觉偏奇幻 RPG。（原创敌人与剑塔造型）",
    tags: ["合成", "塔防", "波次", "奇幻"],
    coverImageSrc: "/samples/astrocade/blade-defender-merge.webp",
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
    id: "car-color-palette",
    title: "Car Color Palette",
    subtitle: "汽车涂色 · 调色盘 · 创意定制",
    prompt:
      "做一个汽车涂色定制小游戏：展示一辆 stylized 小车，玩家从调色盘选色填充车身、轮毂、背景；可随机配色、截图分享感 UI，操作简单儿童友好。",
    tags: ["涂色", "创意", "儿童", "定制"],
    coverImageSrc: "/samples/astrocade/car-color-palette.webp",
    coverAlt: "Car Color Palette — car coloring creative cover",
    coverGradient: "linear-gradient(145deg, #831843 0%, #db2777 35%, #fbbf24 68%, #38bdf8 100%)",
    accentGlow: "rgba(219, 39, 119, 0.38)",
    emoji: "🚗",
    plays: "82.1K",
    creator: "giovanni",
    shelf: "trending",
    photoCover: true,
  },
  {
    id: "blocky-sniper-hunter",
    title: "BLOCKY SNIPER HUNTER",
    subtitle: "方块狙击 · 瞄准射击 · 关卡目标",
    prompt:
      "做一个 blocky 低多边形狙击小游戏：第一人称或 over-shoulder 瞄准，射击关卡中的目标物体；有限子弹、部位判定与星级评价，场景像 minecraft 风格方块世界但为原创地图。",
    tags: ["射击", "狙击", "方块", "关卡"],
    coverImageSrc: "/samples/astrocade/blocky-sniper-hunter.webp",
    coverAlt: "BLOCKY SNIPER HUNTER — voxel sniper shooter cover",
    coverGradient: "linear-gradient(155deg, #14532d 0%, #166534 40%, #4ade80 70%, #1e293b 100%)",
    accentGlow: "rgba(74, 222, 128, 0.35)",
    emoji: "🎯",
    plays: "46.1K",
    creator: "Leevai",
    shelf: "trending",
    photoCover: true,
  },
  {
    id: "memory-match-mania",
    title: "Memory Match Mania",
    subtitle: "翻牌配对 · 记忆挑战 · 连击计时",
    prompt:
      "做一个翻牌记忆配对小游戏：网格背面卡牌，点击翻两张，相同则消除；有步数/计时、连击加分与多主题牌面，UI 明亮活泼。（原创牌面图案）",
    tags: ["记忆", "配对", "益智", "翻牌"],
    coverImageSrc: "/samples/astrocade/memory-match-mania.webp",
    coverAlt: "Memory Match Mania — memory card matching cover",
    coverGradient: "linear-gradient(150deg, #4c1d95 0%, #7c3aed 42%, #f472b6 75%, #fde047 100%)",
    accentGlow: "rgba(124, 58, 237, 0.38)",
    emoji: "🃏",
    plays: "27.8K",
    creator: "elion",
    shelf: "trending",
    photoCover: true,
  },
  {
    id: "kids-puzzle",
    title: "KIDS PUZZLE",
    subtitle: "儿童拼图 · 拖拽块 · 简单关卡",
    prompt:
      "做一个儿童向拼图小游戏：大块拼图拖拽到轮廓位置，完成即过关；图案可爱、块数少、有语音提示位（文字即可）与星星奖励。（原创卡通图案，不用版权 IP）",
    tags: ["拼图", "儿童", "拖拽", "益智"],
    coverImageSrc: "/samples/astrocade/kids-puzzle.webp",
    coverAlt: "KIDS PUZZLE — kids jigsaw puzzle cover",
    coverGradient: "linear-gradient(145deg, #0c4a6e 0%, #0284c7 38%, #fcd34d 72%, #fb7185 100%)",
    accentGlow: "rgba(2, 132, 199, 0.38)",
    emoji: "🧩",
    plays: "8.5K",
    creator: "Leevai",
    shelf: "trending",
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
