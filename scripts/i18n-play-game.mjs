/** Play page, commerce plans, dev banner — merged by i18n-bulk-catalog.mjs */

export const playGameZhHans = {
  loadFailed: "加载失败",
  incompleteData: "数据不完整",
  networkError: "网络异常",
  generateFailed: "生成失败",
  copyFailed: "复制失败",
  refineFailed: "精炼失败",
  patchFailed: "修改失败",
  saveFailed: "保存失败",
  savedToVersion: "已保存到项目版本",
  saveNetworkError: "保存时网络异常",
  patchNetworkError: "网络异常，请稍后重试",
  like: "点赞",
  copiedFullLink: "已复制完整链接",
  copyLink: "复制链接",
  copiedShortLink: "已复制短链",
  shortLink: "短链接",
  mintingShort: "生成中…",
  generateShortLink: "生成短链",
  remixing: "复制中…",
  shortLinkLabel: "短链：",
  regenerateSame: "用同一设定再生成",
  newBlankCreate: "新建空白创作",
  studio: "工作室",
  guestPlayHint: "访客试玩 · Remix 可存入你的会话库",
  coCreateTitle: "继续共创",
  coCreateDesc: "AI patch 和上方快速调参都可以继续沉淀回当前项目，不再只是一次性试玩结果。",
  coCreateOwnerHint: " 你是作品主人：精炼会记入版本日志（「局部 patch」或「整盘 regenerate」）。访客仍走匿名 patch。",
  modeLabel: "模式：",
  modePatch: "局部 patch",
  modeRegenerate: "整盘 regenerate",
  patchPlaceholder: "用一句话修改游戏：例如『初始金币加到200』『让僵尸走慢点』『背景换成深绿草地』…",
  generating: "生成中…",
  patching: "修改中…",
  aiRegenerate: "AI 重新生成",
  aiPatch: "AI 修改",
  saving: "保存中…",
  applyAndSave: "应用并保存",
  recentRefineTitle: "最近精炼（最新在后）",
};

export const playGameEn = {
  loadFailed: "Failed to load",
  incompleteData: "Incomplete data",
  networkError: "Network error",
  generateFailed: "Generation failed",
  copyFailed: "Duplicate failed",
  refineFailed: "Refinement failed",
  patchFailed: "Patch failed",
  saveFailed: "Save failed",
  savedToVersion: "Saved to project version",
  saveNetworkError: "Network error while saving",
  patchNetworkError: "Network error — please retry",
  like: "Like",
  copiedFullLink: "Full link copied",
  copyLink: "Copy link",
  copiedShortLink: "Short link copied",
  shortLink: "Short link",
  mintingShort: "Generating…",
  generateShortLink: "Create short link",
  remixing: "Duplicating…",
  shortLinkLabel: "Short link:",
  regenerateSame: "Regenerate with same setup",
  newBlankCreate: "New blank project",
  studio: "Studio",
  guestPlayHint: "Guest play · Remix saves to your session library",
  coCreateTitle: "Keep co-creating",
  coCreateDesc: "AI patch and quick tune above persist into this project — not just a one-off play session.",
  coCreateOwnerHint: " You own this work: refinements are logged (partial patch or full regenerate). Guests use anonymous patch.",
  modeLabel: "Mode:",
  modePatch: "Partial patch",
  modeRegenerate: "Full regenerate",
  patchPlaceholder: "Describe a change in one line, e.g. raise starting gold to 200, slow zombies, green grass background…",
  generating: "Generating…",
  patching: "Patching…",
  aiRegenerate: "AI regenerate",
  aiPatch: "AI patch",
  saving: "Saving…",
  applyAndSave: "Apply & save",
  recentRefineTitle: "Recent refinements (newest last)",
};

export const commercePlansZhHans = {
  free: {
    name: "免费版",
    features: ["每月基础生成额度", "公开分享与发现"],
  },
  creator: {
    name: "创作者",
    features: ["每月 300 次生成额度", "优先队列", "邀请奖励加倍"],
  },
  pro: {
    name: "专业版",
    features: ["每月 1200 次生成额度", "专属客服", "企业级审核加速"],
  },
};

export const commercePlansEn = {
  free: {
    name: "Free",
    features: ["Monthly base generation quota", "Public sharing & discovery"],
  },
  creator: {
    name: "Creator",
    features: ["300 generations / month", "Priority queue", "Double referral rewards"],
  },
  pro: {
    name: "Pro",
    features: ["1200 generations / month", "Dedicated support", "Enterprise moderation boost"],
  },
};

export const devBannerZhHans = {
  aria: "开发环境：统一访问地址",
  title: "开发提示：",
  body: "当前地址 {current} 与手机访问的局域网地址不是同一站点，主题、参考图会话、作品归属会彼此独立。请与电脑、手机统一使用 {canonical} 书签打开。",
  switch: "切换到统一地址（保留路径）",
  dismiss: "本次会话不再提示",
};

export const devBannerEn = {
  aria: "Dev: unified access URL",
  title: "Dev tip:",
  body: "Current origin {current} differs from your phone's LAN URL — theme, reference sessions, and ownership won't sync. Use {canonical} on both devices.",
  switch: "Switch to unified URL (keep path)",
  dismiss: "Dismiss for this session",
};

export const gamePlayerExtraZhHans = { loading: "正在加载引擎…" };
export const gamePlayerExtraEn = { loading: "Loading engine…" };

export const billingExtraZhHans = { pointsUnit: "点" };
export const billingExtraEn = { pointsUnit: "credits" };

export const novelReaderBlurbZhHans = { synopsisCollapse: "收起", synopsisExpand: "… 查看更多" };
export const novelReaderBlurbEn = { synopsisCollapse: "Collapse", synopsisExpand: "… Show more" };

export const godotWebZhHans = { playTitle: "Godot 试玩", audioClickHint: "点击画面启用音乐与音效" };
export const godotWebEn = { playTitle: "Godot playtest", audioClickHint: "Click the view to enable music and sound" };

function toZhHant(obj) {
  if (Array.isArray(obj)) return obj.map((v) => (typeof v === "string" ? toZhHantStr(v) : v));
  if (obj && typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === "string" ? toZhHantStr(v) : toZhHant(v)]));
  }
  return obj;
}

function toZhHantStr(v) {
  return v
    .replace(/加载/g, "載入")
    .replace(/复制/g, "複製")
    .replace(/生成/g, "生成")
    .replace(/网络/g, "網路")
    .replace(/保存/g, "保存")
    .replace(/点赞/g, "點讚")
    .replace(/短链/g, "短鏈")
    .replace(/工作室/g, "工作室")
    .replace(/访客/g, "訪客")
    .replace(/共创/g, "共創")
    .replace(/精炼/g, "精煉")
    .replace(/免费/g, "免費")
    .replace(/额度/g, "額度")
    .replace(/邀请/g, "邀請")
    .replace(/专业/g, "專業")
    .replace(/开发/g, "開發")
    .replace(/统一/g, "統一")
    .replace(/会话/g, "會話");
}

export function mergePlayGameExtras(locale) {
  const isZh = locale === "zh-Hans" || locale === "zh-Hant";
  const playGame = isZh ? (locale === "zh-Hant" ? toZhHant(playGameZhHans) : playGameZhHans) : playGameEn;
  const commercePlans = isZh
    ? locale === "zh-Hant"
      ? toZhHant(commercePlansZhHans)
      : commercePlansZhHans
    : commercePlansEn;
  const devBanner = isZh ? (locale === "zh-Hant" ? toZhHant(devBannerZhHans) : devBannerZhHans) : devBannerEn;
  const gamePlayer = isZh
    ? locale === "zh-Hant"
      ? toZhHant(gamePlayerExtraZhHans)
      : gamePlayerExtraZhHans
    : gamePlayerExtraEn;
  const billing = isZh
    ? locale === "zh-Hant"
      ? toZhHant(billingExtraZhHans)
      : billingExtraZhHans
    : billingExtraEn;
  const novelReaderBlurb = isZh
    ? locale === "zh-Hant"
      ? toZhHant(novelReaderBlurbZhHans)
      : novelReaderBlurbZhHans
    : novelReaderBlurbEn;
  const godotWeb = isZh ? (locale === "zh-Hant" ? toZhHant(godotWebZhHans) : godotWebZhHans) : godotWebEn;
  return { playGame, commercePlans, devBanner, gamePlayer, billing, novelReaderBlurb, godotWeb };
}
