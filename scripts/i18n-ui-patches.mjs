/** UI component i18n patches — imported by i18n-bulk-catalog.mjs */

export const novelEditorZhHans = {
  titleLabel: "书名（{count}/{max} 字）",
  titlePlaceholder: "请输入书名",
  chapterLabel: "第 {num} 章",
  chapterTitlePlaceholder: "章节标题",
  chapterBodyPlaceholder: "章节正文…",
  minChapterError: "至少保留一章内容",
  emptyBodyError: "第{num}章正文不能为空",
  titleEmpty: "标题不能为空",
  titleTooLong: "标题不能超过 {max} 个字",
  saveFailed: "保存失败",
  networkError: "网络错误",
  saving: "保存中…",
  save: "保存修改",
  cancel: "取消",
  defaultChapterTitle: "第{num}章",
};

export const novelEditorEn = {
  titleLabel: "Title ({count}/{max} chars)",
  titlePlaceholder: "Enter title",
  chapterLabel: "Chapter {num}",
  chapterTitlePlaceholder: "Chapter title",
  chapterBodyPlaceholder: "Chapter body…",
  minChapterError: "Keep at least one chapter",
  emptyBodyError: "Chapter {num} body cannot be empty",
  titleEmpty: "Title cannot be empty",
  titleTooLong: "Title cannot exceed {max} characters",
  saveFailed: "Save failed",
  networkError: "Network error",
  saving: "Saving…",
  save: "Save changes",
  cancel: "Cancel",
  defaultChapterTitle: "Chapter {num}",
};

export const novelDisplayZhHans = {
  untitledNovel: "未命名小说",
  untitledShort: "未命名",
};

export const novelDisplayEn = {
  untitledNovel: "Untitled novel",
  untitledShort: "Untitled",
};

export const novelListenZhHans = {
  unsupported: "听书不可用：请配置火山引擎 TTS（.env）或使用支持朗读的浏览器。",
  synthesizing: "正在合成语音…",
  reading: "朗读中",
  paused: "已暂停",
  listen: "听书",
  chapterHeading: "第{num}章 {title}",
  voiceAria: "朗读音色",
  voiceTitle: "选择朗读音色",
  rateTitle: "切换语速",
  prevChapter: "上一章",
  nextChapter: "下一章",
  pause: "暂停朗读",
  resume: "继续朗读",
  start: "开始朗读",
  stop: "停止",
  audioPlayFailed: "音频播放失败",
  readFailed: "朗读失败",
  voiceSwitched: "已切换音色，请重新播放",
  providerDoubao: "豆包语音",
  providerDoubaoNamed: "豆包 · {name}",
  providerSystem: "系统朗读",
  providerSystemNamed: "系统 · {name}",
  synthesizingProgress: "正在合成语音 {current}/{total}…",
    ttsRequestFailed: "语音合成失败（{status}）",
    ttsChapterIntro: "第{num}章，{title}。",
  volcVoices: {
    BV701_streaming: "擎苍（有声阅读男）",
    BV104_streaming: "温柔淑女",
    BV115_streaming: "古风少御",
    BV700_streaming: "灿灿",
    BV001_streaming: "通用女声",
    BV002_streaming: "通用男声",
  },
};

export const novelListenEn = {
  unsupported: "Listen unavailable: configure Volcengine TTS (.env) or use a browser that supports speech.",
  synthesizing: "Synthesizing speech…",
  reading: "Reading aloud",
  paused: "Paused",
  listen: "Listen",
  chapterHeading: "Ch. {num} {title}",
  voiceAria: "Narration voice",
  voiceTitle: "Choose narration voice",
  rateTitle: "Cycle speech rate",
  prevChapter: "Previous chapter",
  nextChapter: "Next chapter",
  pause: "Pause narration",
  resume: "Resume narration",
  start: "Start narration",
  stop: "Stop",
  audioPlayFailed: "Audio playback failed",
  readFailed: "Read-aloud failed",
  voiceSwitched: "Voice changed — press play again",
  providerDoubao: "Doubao voice",
  providerDoubaoNamed: "Doubao · {name}",
  providerSystem: "System voice",
  providerSystemNamed: "System · {name}",
  synthesizingProgress: "Synthesizing speech {current}/{total}…",
  ttsRequestFailed: "Speech synthesis failed ({status})",
  ttsChapterIntro: "Chapter {num}, {title}. ",
  volcVoices: {
    BV701_streaming: "Qingcang (audiobook male)",
    BV104_streaming: "Gentle lady",
    BV115_streaming: "Classic young female",
    BV700_streaming: "Cancan",
    BV001_streaming: "General female",
    BV002_streaming: "General male",
  },
};

export const childrenReaderZhHans = {
  structure: "本篇结构",
  ending: "结尾",
  readingBg: "阅读背景",
  parentReading: "亲子共读",
  unnamed: "未命名",
  interpretDefault: "创意解读",
  storyDefault: "儿童故事",
};

export const childrenReaderEn = {
  structure: "Story structure",
  ending: "Ending",
  readingBg: "Reading theme",
  parentReading: "Read together",
  unnamed: "Untitled",
  interpretDefault: "Creative read",
  storyDefault: "Children's story",
};

export const comicButtonZhHans = {
  defaultLabel: "生成漫画",
  connecting: "连接漫画生成服务…",
  generating: "生成中…",
  redirecting: "正在跳转…",
};

export const comicButtonEn = {
  defaultLabel: "Generate comic",
  connecting: "Connecting to comic generation service…",
  generating: "Generating…",
  redirecting: "Redirecting…",
};

export const comicBannerZhHans = {
  title: "按章连载改编",
  adapted: "已改编 {adapted}/{total} 章",
  percent: "（{pct}%）",
  nextChapter: " · 下一章：{label}",
  allCovered: " · 全书章节已覆盖",
  resumeDraft: "续跑分镜草稿",
  adaptNext: "改编下一章",
};

export const comicBannerEn = {
  title: "Serial chapter adaptation",
  adapted: "Adapted {adapted}/{total} chapters",
  percent: " ({pct}%)",
  nextChapter: " · Next: {label}",
  allCovered: " · All chapters covered",
  resumeDraft: "Resume storyboard draft",
  adaptNext: "Adapt next chapter",
};

export const gamePlayerZhHans = {
  gameAria: "游戏画面",
  audioHint: "点击画面或按任意键开启背景音乐",
  fullscreen: "全屏",
  restart: "重开",
  victory: "胜利",
  gameOver: "游戏结束",
  score: "得分",
  playAgain: "再来一局",
  landscapeHint: "提示：横屏或全屏可获得更大视野。",
};

export const gamePlayerEn = {
  gameAria: "Game view",
  audioHint: "Click the view or press any key to start background music",
  fullscreen: "Fullscreen",
  restart: "Restart",
  victory: "Victory",
  gameOver: "Game over",
  score: "Score",
  playAgain: "Play again",
  landscapeHint: "Tip: landscape or fullscreen gives a wider view.",
};

export const gameRuntimeZhHans = {
  hint: "先点 <godot>Godot（在线）</godot> 在浏览器里试完整版；Phaser 用于秒开预览。玩得满意再在 Godot 标签里展开导出。",
  engineLabel: "试玩引擎",
  engineShort: "引擎",
  preferenceTitle: "默认试玩引擎；试玩区可随时切换",
  godotOnline: "Godot（在线）",
  godotOnlineShort: "Godot 在线",
  godotTitle: "浏览器内在线试玩 Godot 完整运行时",
  phaserPreview: "Phaser（秒开预览）",
  building: "正在构建在线版…",
  cached: "在线版已缓存 · 同规格无需重复构建",
  buildingGodot: "正在构建 Godot 在线试玩（约 10～30 秒）…",
  readyHint: "完成后即可在页面内直接玩",
  buildFailed: "在线版构建失败",
  retry: "重试",
  godotReady: "Godot 在线版已在后台就绪，可切换到「Godot（在线）」试玩完整版。",
};

export const gameRuntimeEn = {
  hint: "Try <godot>Godot (online)</godot> first for the full browser build; Phaser is for instant preview. Export from the Godot tab when satisfied.",
  engineLabel: "Play engine",
  engineShort: "Engine",
  preferenceTitle: "Default play engine; switch anytime in the preview area",
  godotOnline: "Godot (online)",
  godotOnlineShort: "Godot online",
  godotTitle: "Play the full Godot runtime in the browser",
  phaserPreview: "Phaser (instant preview)",
  building: "Building online build…",
  cached: "Online build cached · same spec won't rebuild",
  buildingGodot: "Building Godot online play (~10–30s)…",
  readyHint: "You can play in-page when ready",
  buildFailed: "Online build failed",
  retry: "Retry",
  godotReady: "Godot online build is ready in the background — switch to Godot (online) for the full version.",
};

export const creativeBriefZhHans = {
  summary: "AI 深度理解（可展开 / 可修订）",
  expandPack: "知识包",
  expandModel: "知识包+模型",
  originalPrompt: "原话：",
  worldLabel: "世界观",
  addonLabel: "补充说明（可选）",
  saveRevision: "保存修订",
  cancel: "取消",
  scenes: "场景",
  factions: "势力",
  weaponsVfx: "武器与特效",
  artStyle: "画风",
  mood: "氛围",
  negatives: "负面约束",
  templateHint: "倾向模板：",
  tone: "调性",
  difficulty: "难度",
  pace: "节奏",
  editBrief: "修订扩写理解",
  regenerateBrief: "按当前理解重新生成",
  medium: {
    game: { hints: "玩法落地", unitSection: "单位", addonPlaceholder: "例如：更偏弹幕射击、Boss 要更大、色调再冷一点…" },
    novel: { hints: "叙事结构", unitSection: "角色", addonPlaceholder: "例如：第三人称、感情线更重、结局偏开放式…" },
    comic: { hints: "分镜节奏", unitSection: "角色造型", addonPlaceholder: "例如：电影感分镜、对白少一点、每页一个大转折…" },
  },
};

export const creativeBriefEn = {
  summary: "AI deep understanding (expand / revise)",
  expandPack: "Genre scaffold",
  expandModel: "Scaffold + model",
  originalPrompt: "Original prompt:",
  worldLabel: "Worldbuilding",
  addonLabel: "Notes (optional)",
  saveRevision: "Save revision",
  cancel: "Cancel",
  scenes: "Scenes",
  factions: "Factions",
  weaponsVfx: "Weapons & VFX",
  artStyle: "Art style",
  mood: "Mood",
  negatives: "Avoid",
  templateHint: "Template hint:",
  tone: "Tone",
  difficulty: "Difficulty",
  pace: "Pace",
  editBrief: "Revise brief",
  regenerateBrief: "Regenerate with current understanding",
  medium: {
    game: { hints: "Gameplay", unitSection: "Units", addonPlaceholder: "e.g. more bullet-hell, bigger boss, colder palette…" },
    novel: { hints: "Narrative structure", unitSection: "Characters", addonPlaceholder: "e.g. third person, heavier romance, open ending…" },
    comic: { hints: "Panel rhythm", unitSection: "Character design", addonPlaceholder: "e.g. cinematic panels, less dialogue, big twist per page…" },
  },
};

export const specTuneZhHans = {
  summary: "⚡ 实时微调面板 — 金币、怪物、配色、速率",
  desc: "修改会立即驱动左侧试玩重载。调整金币、怪物强度、颜色、速度等参数；保存作品时以当前调试结果为准。",
  colors: "配色",
  colorBg: "背景",
  colorPlayer: "主角/塔主色",
  colorHazard: "威胁/敌军",
  colorCollectible: "收集/货币",
  colorParticle: "粒子 Tint",
  musicProfile: "铺底音乐气质（presentation）",
  musicHint: "与主题色同源推断；改写后环境与蜂鸣会与试玩外壳一起重载对齐。",
  musicOrganic: "organic · 舒缓自然",
  musicPulse: "pulse · 轻律动",
  musicMinimal: "minimal · 极轻",
  musicNeon: "neon · 锐利电子",
  titleMood: "标题与氛围",
  workTitle: "作品标题",
  subtitle: "副标题 / 氛围（labels.subtitle）",
  baseHealth: "基地生命（Gameplay.baseHealth）",
  startingCoins: "开局金币（Gameplay.startingCoins）",
  hazardSpeed: "敌军移速倍率（Gameplay.hazardSpeed，影响行军快慢）",
  spawnInterval: "全局刷怪间隔基底（Gameplay.spawnIntervalMs，越小越密；回退波次会参考它）",
  towerFireRate: "塔射速偏好（Gameplay.playerSpeed，数值越高冷却越短）",
  directorIntensity: "导演紧张度（director.intensity，0~1）",
  lives: "生命 / 容错（Gameplay.lives）",
  winScore: "胜利目标分/收集（winScore）",
  enemyHp: "敌军血量（BOSS 常为当前编队中 HP 最高者，约 {max}）",
  bossTag: "首领向",
  towerDamage: "首发箭塔 · 单次伤害（towers[0].damage）",
  towerCooldown: "首发箭塔 · 射击间隔 ms（越低越快）",
  playerSpeed: "主角移速（playerSpeed）",
  threatSpeed: "威胁移速（hazardSpeed）",
  labels: "称谓（简短）",
  labelPlayer: "主角/塔",
  labelHazard: "威胁物",
  labelCollectible: "收集物/货币",
  debugAct: "调试",
};

export const specTuneEn = {
  summary: "⚡ Live tune panel — coins, enemies, colors, rates",
  desc: "Changes reload the left play preview immediately. Tune coins, enemy strength, colors, speed; save uses current debug values.",
  colors: "Colors",
  colorBg: "Background",
  colorPlayer: "Player / tower",
  colorHazard: "Threat / enemies",
  colorCollectible: "Collectible / currency",
  colorParticle: "Particle tint",
  musicProfile: "Music profile (presentation)",
  musicHint: "Inferred from theme colors; environment and buzz reload with the play shell.",
  musicOrganic: "organic · calm natural",
  musicPulse: "pulse · light rhythm",
  musicMinimal: "minimal · very light",
  musicNeon: "neon · sharp electronic",
  titleMood: "Title & mood",
  workTitle: "Work title",
  subtitle: "Subtitle / mood (labels.subtitle)",
  baseHealth: "Base health (Gameplay.baseHealth)",
  startingCoins: "Starting coins (Gameplay.startingCoins)",
  hazardSpeed: "Enemy speed multiplier (Gameplay.hazardSpeed)",
  spawnInterval: "Global spawn interval base (Gameplay.spawnIntervalMs)",
  towerFireRate: "Tower fire-rate preference (Gameplay.playerSpeed)",
  directorIntensity: "Director intensity (director.intensity, 0–1)",
  lives: "Lives / forgiveness (Gameplay.lives)",
  winScore: "Win target score/collect (winScore)",
  enemyHp: "Enemy HP (boss is often highest, ~{max})",
  bossTag: "Boss-like",
  towerDamage: "First tower · damage (towers[0].damage)",
  towerCooldown: "First tower · cooldown ms (lower = faster)",
  playerSpeed: "Player speed (playerSpeed)",
  threatSpeed: "Threat speed (hazardSpeed)",
  labels: "Short labels",
  labelPlayer: "Player / tower",
  labelHazard: "Threat",
  labelCollectible: "Collectible / currency",
  debugAct: "Debug",
};

export const samplesZhHans = {
  hot: "热门",
  prompt: "提示词",
  expand: "（展开）",
  creating: "创建中…",
  play: "试玩",
  tune: "微调",
  generateFailed: "生成失败",
  saveFailed: "保存失败",
  networkError: "网络异常",
  title: "样品馆",
  descPrefix: "横向浏览灵感卡片，参考",
  descMid: "式陈列：竖版封面可换为试玩截图，改数据里的",
  descSuffix: "即可；当前为 SVG 海报，加载失败时回退渐变。",
  swipeHint: "左右滑动",
};

export const samplesEn = {
  hot: "Hot",
  prompt: "Prompt",
  expand: "(expand)",
  creating: "Creating…",
  play: "Play",
  tune: "Tune",
  generateFailed: "Generation failed",
  saveFailed: "Save failed",
  networkError: "Network error",
  title: "Sample gallery",
  descPrefix: "Browse inspiration cards horizontally, inspired by",
  descMid: "layout: swap vertical covers for play screenshots via",
  descSuffix: "in data; SVG posters with gradient fallback on load failure.",
  swipeHint: "Swipe sideways",
};

export const studioErrorsZhHans = {
  gamesListFailed: "游戏列表加载失败（HTTP {status}）",
  gamesListError: "游戏列表：{error}",
  novelsListFailed: "小说列表加载失败（HTTP {status}）",
  novelsListError: "小说列表：{error}",
  novelsJsonFailed: "小说列表返回内容无法解析（可能不是 JSON）",
  comicsListFailed: "动漫列表加载失败（HTTP {status}）",
  comicsListError: "动漫列表：{error}",
  comicsJsonFailed: "动漫列表返回内容无法解析（可能不是 JSON）",
  unknownError: "未知错误",
  loadFailed: "加载失败：{msg}",
  coverAlt: "《{title}》封面",
  deleteProjectNotFound: "游戏 {id} 不存在",
  deleteProjectForbidden: "无权删除游戏 {id}",
  deleteNovelNotFound: "小说 {id} 不存在",
  deleteNovelForbidden: "无权删除小说 {id}",
  deleteComicNotFound: "动漫 {id} 不存在",
  deleteComicForbidden: "无权删除动漫 {id}",
  deleteFailed: "{type} {id} 删除失败：{reason}",
  duplicateCopySuffix: "（副本）",
  confirmDeleteOne: "确定删除该作品？",
  confirmBatchDelete: "确定删除已选 {count} 个作品？此操作不可撤销。",
  duplicateFailed: "复制失败",
  batchDeletePartial: "已删除，但部分失败：\n{errors}",
  batchDeleteFailed: "批量删除失败，请重试",
  batchDeleteError: "错误：{msg}",
  listWarningSeparator: "；",
};

export const studioErrorsEn = {
  gamesListFailed: "Failed to load games (HTTP {status})",
  gamesListError: "Games: {error}",
  novelsListFailed: "Failed to load novels (HTTP {status})",
  novelsListError: "Novels: {error}",
  novelsJsonFailed: "Novel list response could not be parsed (may not be JSON)",
  comicsListFailed: "Failed to load comics (HTTP {status})",
  comicsListError: "Comics: {error}",
  comicsJsonFailed: "Comic list response could not be parsed (may not be JSON)",
  unknownError: "Unknown error",
  loadFailed: "Load failed: {msg}",
  coverAlt: "Cover for \"{title}\"",
  deleteProjectNotFound: "Game {id} not found",
  deleteProjectForbidden: "Not allowed to delete game {id}",
  deleteNovelNotFound: "Novel {id} not found",
  deleteNovelForbidden: "Not allowed to delete novel {id}",
  deleteComicNotFound: "Comic {id} not found",
  deleteComicForbidden: "Not allowed to delete comic {id}",
  deleteFailed: "Failed to delete {type} {id}: {reason}",
  duplicateCopySuffix: " (copy)",
  confirmDeleteOne: "Delete this work?",
  confirmBatchDelete: "Delete {count} selected work(s)? This cannot be undone.",
  duplicateFailed: "Failed to duplicate",
  batchDeletePartial: "Deleted with partial failures:\n{errors}",
  batchDeleteFailed: "Batch delete failed. Please try again.",
  batchDeleteError: "Error: {msg}",
  listWarningSeparator: "; ",
};

export const comicReadZhHans = {
  loadFailedHttp: "加载失败（HTTP {status}）",
  notFound: "漫画不存在",
  loadFailed: "加载失败",
  clearingPage: "正在清空第 {page} 页配图并重新生成…",
  clearingAll: "正在清空已有配图并重新生成…",
  connectingImage: "正在连接文生图服务…",
  renderFailed: "配图生成失败（{status}）",
  noStream: "服务器未返回流式进度，请稍后重试",
  panelsPending: "共 {total} 格待生成",
  panelProgress: "正在生成第 {index}/{total} 格配图…",
  panelDone: "第 {index}/{total} 格已完成（{elapsed}{api}）· 已有 {withImage} 张图",
  panelFailed: "第 {index} 格失败（{elapsed}）：{error}",
  panelDoneApi: "，网关 {api}",
  renderComplete: "配图完成",
  renderFailedGeneric: "配图生成失败",
  renderRequestFailed: "配图请求失败，请稍后重试",
  confirmRegenAll: "将清空全部 {count} 格已有配图，按小说都市题材重生成封面与配图（不使用旧玄幻图作参考）。\n\n过程较长，请勿关闭页面。确定继续？",
  confirmRegenPage: "将清空第 {page} 页的配图并重新生成（按本页全部分镜格重新绘制）。\n\n确定继续？",
  loading: "加载中…",
  subtitle: "基于《{novel}》· {total} 页分镜{scope}",
  scopeSuffix: " · {scope}",
  adaptNext: "连载：改编下一章",
  basedOn: "基于",
  layoutChildren: "儿童小人书 5 格",
  layoutGrid: "每页 8 格",
  readModeFull: " · 全书精读",
  metaHint: "对白/时间地点可叠在图上；旁白在图下展示且不重复。缺图格会先展示分镜文字。",
  connectingWait: "正在连接文生图服务，请稍候…",
  rendering: "正在生成中",
  renderingDefault: "漫画分镜配图生成中，与列表封面无关，请勿关闭页面。",
  progress: "进度 {current}/{total} 格 · 已完成配图 {withImage} 张",
  elapsed: " · 当前格已用时 {elapsed}",
  etaHint: " · 单格通常约 2～8 分钟（视网关负载），请勿关闭页面",
  panelArtTitle: "漫画分镜配图（不是封面）",
  panelArtPending: "分镜脚本已就绪，共 {total} 格尚未出图。图内只保留少量必要叠字，旁白放在图下；配图应为无字纯画面。",
  panelArtDone: "配图已全部完成（{withImage}/{total} 格）。若不满意可重新生成；续画会跳过已有图。",
  panelArtPartial: "配图未完成：已完成 {withImage}/{total} 格。续画逐格串行，以首张分镜+封面为风格锚点（需 GEMINI_API_KEY），跳过已有图。",
  continueRender: "继续生成配图",
  startRender: "开始生成配图",
  regenAll: "重新生成全部",
  regenPage: "重新生成本页",
  loginToRender: "请<login>登录账号</login>后继续配图；登录后会自动合并本机作品。",
  noPanels: "暂无分镜数据",
  prevPage: "上一页",
  pageOf: "第 {current} / {total} 页",
  nextPage: "下一页",
  unknownError: "未知错误",
};

export const comicReadEn = {
  loadFailedHttp: "Load failed (HTTP {status})",
  notFound: "Comic not found",
  loadFailed: "Load failed",
  clearingPage: "Clearing page {page} art and regenerating…",
  clearingAll: "Clearing existing art and regenerating…",
  connectingImage: "Connecting to image generation service…",
  renderFailed: "Panel art failed ({status})",
  noStream: "Server did not return stream progress — retry later",
  panelsPending: "{total} panels pending",
  panelProgress: "Generating panel {index}/{total}…",
  panelDone: "Panel {index}/{total} done ({elapsed}{api}) · {withImage} images ready",
  panelFailed: "Panel {index} failed ({elapsed}): {error}",
  panelDoneApi: ", gateway {api}",
  renderComplete: "Panel art complete",
  renderFailedGeneric: "Panel art generation failed",
  renderRequestFailed: "Panel art request failed — retry later",
  confirmRegenAll: "Clear all {count} existing panel images and regenerate cover + panels for the urban theme.\n\nThis takes a while — keep this page open. Continue?",
  confirmRegenPage: "Clear page {page} art and regenerate all panels on this page.\n\nContinue?",
  loading: "Loading…",
  subtitle: "Based on \"{novel}\" · {total} storyboard pages{scope}",
  scopeSuffix: " · {scope}",
  adaptNext: "Serial: adapt next chapter",
  basedOn: "Based on",
  layoutChildren: "Children picture book · 5 panels",
  layoutGrid: "8 panels per page",
  readModeFull: " · full-book read",
  metaHint: "Dialogue/time overlays on art; narration below without duplication. Missing art shows storyboard text first.",
  connectingWait: "Connecting to image service, please wait…",
  rendering: "Generating",
  renderingDefault: "Generating comic panel art (not the list cover) — keep this page open.",
  progress: "Progress {current}/{total} panels · {withImage} images done",
  elapsed: " · current panel elapsed {elapsed}",
  etaHint: " · each panel ~2–8 min depending on gateway load — keep page open",
  panelArtTitle: "Comic panel art (not cover)",
  panelArtPending: "Storyboard ready — {total} panels still need art. Minimal on-image text; narration below; art should be text-free.",
  panelArtDone: "All panel art done ({withImage}/{total}). Regenerate if needed; resume skips existing images.",
  panelArtPartial: "Partial art: {withImage}/{total} done. Resume is serial, anchored to first panel + cover (needs GEMINI_API_KEY), skipping existing.",
  continueRender: "Continue panel art",
  startRender: "Start panel art",
  regenAll: "Regenerate all",
  regenPage: "Regenerate this page",
  loginToRender: "Please <login>sign in</login> to continue panel art; local works merge after login.",
  noPanels: "No storyboard data",
  prevPage: "Previous page",
  pageOf: "Page {current} / {total}",
  nextPage: "Next page",
  unknownError: "Unknown error",
};

function hantify(obj) {
  return JSON.parse(
    JSON.stringify(obj)
      .replace(/加载/g, "載入")
      .replace(/失败/g, "失敗")
      .replace(/网络/g, "網路")
      .replace(/保存/g, "保存")
      .replace(/章节/g, "章節")
      .replace(/阅读/g, "閱讀")
      .replace(/听书/g, "聽書")
      .replace(/朗读/g, "朗讀")
      .replace(/暂停/g, "暫停")
      .replace(/继续/g, "繼續")
      .replace(/生成/g, "生成")
      .replace(/漫画/g, "漫畫")
      .replace(/改编/g, "改編")
      .replace(/全书/g, "全書")
      .replace(/覆盖/g, "覆蓋")
      .replace(/游戏/g, "遊戲")
      .replace(/全屏/g, "全螢幕")
      .replace(/胜利/g, "勝利")
      .replace(/得分/g, "得分")
      .replace(/试玩/g, "試玩")
      .replace(/构建/g, "構建")
      .replace(/在线/g, "線上")
      .replace(/知识包/g, "知識包")
      .replace(/世界观/g, "世界觀")
      .replace(/场景/g, "場景")
      .replace(/画风/g, "畫風")
      .replace(/氛围/g, "氛圍")
      .replace(/调性/g, "調性")
      .replace(/难度/g, "難度")
      .replace(/节奏/g, "節奏")
      .replace(/修订/g, "修訂")
      .replace(/扩写/g, "擴寫")
      .replace(/微调/g, "微調")
      .replace(/配色/g, "配色")
      .replace(/敌军/g, "敵軍")
      .replace(/威胁/g, "威脅")
      .replace(/收集/g, "收集")
      .replace(/主角/g, "主角")
      .replace(/作品/g, "作品")
      .replace(/样品馆/g, "樣品館")
      .replace(/提示词/g, "提示詞")
      .replace(/创建/g, "創建")
      .replace(/动漫/g, "動漫")
      .replace(/列表/g, "列表")
      .replace(/未知/g, "未知")
      .replace(/封面/g, "封面")
      .replace(/配图/g, "配圖")
      .replace(/分镜/g, "分鏡")
      .replace(/登录/g, "登入")
      .replace(/账号/g, "帳號")
      .replace(/上一页/g, "上一頁")
      .replace(/下一页/g, "下一頁"),
  );
}

export const comicCreatePageZhHans = {
  title: "创作漫画",
  desc: "可粘贴小说全文，或只写一句话创意。系统会先扩写改编理解，再生成分镜；对白、旁白与配图按流程逐步完成。",
  draftDetected: "检测到未完成的创作草稿",
  draftContent: "内容：",
  restoreDraft: "恢复草稿",
  dismiss: "忽略",
  lengthLabel: "篇幅（决定漫画页数）",
  titleLabel: "标题（可选）",
  titlePlaceholder: "留空从正文第一行自动提取",
  ideaLabel: "一句话创意（可选；粘贴长文时可单独写改编方向）",
  ideaPlaceholder: "例：赛博朋克都市里退役黑客追查 AI 觉醒案…",
  contentLabel: "小说 / 故事文本",
  contentPlaceholder: "在这里粘贴你的小说、故事或任何叙事文本…\n支持长文本，AI 会自动解析情节、角色和关键场景。",
  charsEntered: "已输入 {count} 字符",
  previewingBrief: "扩写预览中…",
  previewBrief: "预览改编 Brief",
  generatingTitle: "漫画生成中",
  generatingDetail: "先出分镜，多页作品需到详情页继续配图",
  generatingStoryboard: "生成分镜中…",
  generateStoryboard: "生成分镜（配图在下一步）",
  connectService: "连接漫画生成服务…",
  briefReady: "AI 已扩写漫画改编理解，开始分镜…",
  networkError: "网络错误，请重试",
};

export const comicCreatePageEn = {
  title: "Create Comic",
  desc: "Paste a full novel or just a one-line idea. The system expands the adaptation brief first, then generates the storyboard; dialogue, narration, and images are completed step by step.",
  draftDetected: "Found an unfinished creation draft",
  draftContent: "Content:",
  restoreDraft: "Restore Draft",
  dismiss: "Dismiss",
  lengthLabel: "Length (determines comic page count)",
  titleLabel: "Title (optional)",
  titlePlaceholder: "Leave empty to extract from the first line automatically",
  ideaLabel: "One-line idea (optional; when pasting a long text, you can specify the adaptation direction here)",
  ideaPlaceholder: "Example: a retired hacker in a cyberpunk city investigates an AI awakening case…",
  contentLabel: "Novel / story text",
  contentPlaceholder: "Paste your novel, story, or any narrative text here…\nLong text is supported. AI will automatically parse the plot, characters, and key scenes.",
  charsEntered: "{count} characters entered",
  previewingBrief: "Previewing expanded brief…",
  previewBrief: "Preview Adaptation Brief",
  generatingTitle: "Generating comic",
  generatingDetail: "Storyboard comes first. Multi-page works continue image generation on the detail page.",
  generatingStoryboard: "Generating storyboard…",
  generateStoryboard: "Generate Storyboard (images come next)",
  connectService: "Connecting to the comic generation service…",
  briefReady: "AI has expanded the comic adaptation brief. Starting storyboard generation…",
  networkError: "Network error, please try again.",
};

export const comicPanelCardZhHans = {
  altFallback: "第{page}页-{index}",
  rendering: "生成中…",
  pendingImage: "待配图",
};

export const comicPanelCardEn = {
  altFallback: "Page {page}-{index}",
  rendering: "Generating…",
  pendingImage: "Awaiting art",
};

export const studioComicProgressZhHans = {
  title: "漫画配图进度",
  desc: "分镜已就绪的漫画可继续生成配图，无需留在详情页等待。",
  progress: "{withImage}/{total} 格已配图（{pct}%）",
  continueBtn: "继续配图",
};

export const studioComicProgressEn = {
  title: "Comic panel art progress",
  desc: "Storyboards that are ready can keep generating panel art without staying on the detail page.",
  progress: "{withImage}/{total} panels illustrated ({pct}%)",
  continueBtn: "Continue art",
};

export const godotExportZhHans = {
  ariaLabel: "Godot 离线下载（可选）",
  windowsTitle: "在本机 Windows 上由服务端打出 exe 压缩包（需已 npm run godot:install）",
  windowsLoading: "正在打包 Windows…",
  windowsLabel: "下载 Windows 版",
  projectTitle: "含 GameSpec 与参考图的 Godot 4 工程，可用编辑器打开继续改",
  projectLoading: "正在打包工程…",
  projectLabel: "下载 Godot 工程",
  androidTitle: "需本机 Android SDK；未配置时会提示改用工程在编辑器内导出",
  androidLoading: "正在导出 Android…",
  androidLabel: "Android APK",
  exportFailed: "导出失败",
  networkError: "网络异常",
  offlineSummary: "玩法满意？导出离线包（Windows / 工程 / Android）",
  offlineDesc: "在线试玩无需下载。只有想装到 PC、用 Godot 编辑器改、或打手机包时再点下面按钮。",
};

export const godotExportEn = {
  ariaLabel: "Godot offline downloads (optional)",
  windowsTitle: "Build a Windows exe zip on this machine (requires npm run godot:install)",
  windowsLoading: "Packaging Windows…",
  windowsLabel: "Download Windows build",
  projectTitle: "Godot 4 project with GameSpec and reference art — open in the editor to continue",
  projectLoading: "Packaging project…",
  projectLabel: "Download Godot project",
  androidTitle: "Requires local Android SDK; if missing, export from the project in the editor instead",
  androidLoading: "Exporting Android…",
  androidLabel: "Android APK",
  exportFailed: "Export failed",
  networkError: "Network error",
  offlineSummary: "Happy with the build? Export offline packages (Windows / project / Android)",
  offlineDesc: "Online play needs no download. Use the buttons below only to install on PC, edit in Godot, or build for mobile.",
};

export const clientErrorsZhHans = {
  useGameStudio: "游戏扩写请使用创作台",
  needMinPrompt: "请先输入至少 2 个字的创意",
  expandPreviewFailed: "扩写预览失败",
  streamNotSse: "服务器未返回流式响应",
  sseNoBody: "响应无正文",
  comicGenerateIncomplete: "漫画生成未完成",
  requestFailed: "请求失败（{status}）",
};

export const clientErrorsEn = {
  useGameStudio: "Use the game studio for game brief expansion",
  needMinPrompt: "Enter at least 2 characters of your idea first",
  expandPreviewFailed: "Brief expansion preview failed",
  streamNotSse: "Server did not return a streaming response",
  sseNoBody: "Response has no body",
  comicGenerateIncomplete: "Comic generation did not finish",
  requestFailed: "Request failed ({status})",
};

export const uiPatchByLocale = {
  "zh-Hans": {
    clientErrors: clientErrorsZhHans,
    comicCreatePage: comicCreatePageZhHans,
    novelEditor: novelEditorZhHans,
    novelDisplay: novelDisplayZhHans,
    novelListen: novelListenZhHans,
    childrenReader: childrenReaderZhHans,
    comicButton: comicButtonZhHans,
    comicBanner: comicBannerZhHans,
    gamePlayer: gamePlayerZhHans,
    gameRuntime: gameRuntimeZhHans,
    creativeBrief: creativeBriefZhHans,
    specTune: specTuneZhHans,
    samples: samplesZhHans,
    studioErrors: studioErrorsZhHans,
    comicRead: comicReadZhHans,
    comicPanelCard: comicPanelCardZhHans,
    studioComicProgress: studioComicProgressZhHans,
    godotExport: godotExportZhHans,
  },
  "zh-Hant": {
    clientErrors: {
      useGameStudio: "遊戲擴寫請使用創作台",
      needMinPrompt: "請先輸入至少 2 個字的創意",
      expandPreviewFailed: "擴寫預覽失敗",
      streamNotSse: "伺服器未返回串流回應",
      sseNoBody: "回應無正文",
      comicGenerateIncomplete: "漫畫生成未完成",
      requestFailed: "請求失敗（{status}）",
    },
    comicCreatePage: hantify(comicCreatePageZhHans),
    novelEditor: hantify(novelEditorZhHans),
    novelDisplay: hantify(novelDisplayZhHans),
    novelListen: hantify(novelListenZhHans),
    childrenReader: hantify(childrenReaderZhHans),
    comicButton: hantify(comicButtonZhHans),
    comicBanner: hantify(comicBannerZhHans),
    gamePlayer: hantify(gamePlayerZhHans),
    gameRuntime: hantify(gameRuntimeZhHans),
    creativeBrief: hantify(creativeBriefZhHans),
    specTune: hantify(specTuneZhHans),
    samples: hantify(samplesZhHans),
    studioErrors: hantify(studioErrorsZhHans),
    comicRead: hantify(comicReadZhHans),
    comicPanelCard: hantify(comicPanelCardZhHans),
    studioComicProgress: hantify(studioComicProgressZhHans),
    godotExport: hantify(godotExportZhHans),
  },
  en: {
    clientErrors: clientErrorsEn,
    comicCreatePage: comicCreatePageEn,
    novelEditor: novelEditorEn,
    novelDisplay: novelDisplayEn,
    novelListen: novelListenEn,
    childrenReader: childrenReaderEn,
    comicButton: comicButtonEn,
    comicBanner: comicBannerEn,
    gamePlayer: gamePlayerEn,
    gameRuntime: gameRuntimeEn,
    creativeBrief: creativeBriefEn,
    specTune: specTuneEn,
    samples: samplesEn,
    studioErrors: studioErrorsEn,
    comicRead: comicReadEn,
    comicPanelCard: comicPanelCardEn,
    studioComicProgress: studioComicProgressEn,
    godotExport: godotExportEn,
  },
  ms: {
    clientErrors: {
      useGameStudio: "Gunakan studio permainan untuk pengembangan brief permainan",
      needMinPrompt: "Masukkan sekurang-kurangnya 2 aksara idea dahulu",
      expandPreviewFailed: "Pratonton pengembangan brief gagal",
      streamNotSse: "Pelayan tidak mengembalikan respons strim",
      sseNoBody: "Respons tiada kandungan",
      comicGenerateIncomplete: "Penjanaan komik tidak selesai",
      requestFailed: "Permintaan gagal ({status})",
    },
    comicCreatePage: comicCreatePageEn,
    novelEditor: novelEditorEn,
    novelDisplay: novelDisplayEn,
    novelListen: novelListenEn,
    childrenReader: childrenReaderEn,
    comicButton: comicButtonEn,
    comicBanner: comicBannerEn,
    gamePlayer: gamePlayerEn,
    gameRuntime: gameRuntimeEn,
    creativeBrief: creativeBriefEn,
    specTune: specTuneEn,
    samples: samplesEn,
    studioErrors: studioErrorsEn,
    comicRead: comicReadEn,
    comicPanelCard: comicPanelCardEn,
    studioComicProgress: studioComicProgressEn,
    godotExport: godotExportEn,
  },
  th: {
    clientErrors: {
      useGameStudio: "ใช้สตูดิโอเกมสำหรับขยาย brief เกม",
      needMinPrompt: "กรุณาใส่ไอเดียอย่างน้อย 2 ตัวอักษรก่อน",
      expandPreviewFailed: "ดูตัวอย่างการขยาย brief ล้มเหลว",
      streamNotSse: "เซิร์ฟเวอร์ไม่ได้ส่งสตรีมกลับมา",
      sseNoBody: "การตอบกลับไม่มีเนื้อหา",
      comicGenerateIncomplete: "การสร้างการ์ตูนยังไม่เสร็จ",
      requestFailed: "คำขอล้มเหลว ({status})",
    },
    comicCreatePage: comicCreatePageEn,
    novelEditor: novelEditorEn,
    novelDisplay: novelDisplayEn,
    novelListen: novelListenEn,
    childrenReader: childrenReaderEn,
    comicButton: comicButtonEn,
    comicBanner: comicBannerEn,
    gamePlayer: gamePlayerEn,
    gameRuntime: gameRuntimeEn,
    creativeBrief: creativeBriefEn,
    specTune: specTuneEn,
    samples: samplesEn,
    studioErrors: studioErrorsEn,
    comicRead: comicReadEn,
    comicPanelCard: comicPanelCardEn,
    studioComicProgress: studioComicProgressEn,
    godotExport: godotExportEn,
  },
};
