import type { AppLocale } from "@/i18n/routing";
import type { GameSpec } from "@/lib/game-spec";
import { gameActLabel, gameEventMessage, gameEventTitle } from "@/lib/i18n/game-event-labels";
import { tMessage } from "@/lib/i18n/messages";

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 0.001 + i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export type Director = NonNullable<GameSpec["director"]>;

type DirectorEvent = NonNullable<Director["events"]>[number];

export function buildDirector(params: {
  prompt: string;
  spec: GameSpec;
  locale?: AppLocale;
}): Director {
  const locale = params.locale ?? "zh-Hans";
  const tr = (key: string, p?: Record<string, string | number>) => tMessage(locale, `gameEvents.${key}`, p);
  const seed = hashString(`${params.prompt}\n${params.spec.title}\n${params.spec.templateId}`);
  const p = params.prompt.toLowerCase();
  const hard = /硬核|高难|地狱|弹幕|挑战|boss|rush|hardcore/.test(p);
  const chill = /轻松|治愈|休闲|慢节奏|舒缓|cozy|casual/.test(p);
  const isCyber = /赛博|霓虹|cyber|neon/.test(p);
  const isOcean = /海|洋|珊瑚|章鱼|潜水|鱼/.test(params.prompt);
  const isSpace = /太空|宇宙|星|陨石|飞船|银河/.test(params.prompt);
  const wantEvents =
    hard ||
    /随机事件|事件|转折|道具|掉落|金币|奖励|宝箱|强化|精英|boss|目标|限时|关卡目标|3a|aaa|成品|复杂|机制/.test(
      params.prompt,
    );

  let intensity = 0.56 + (hard ? 0.22 : 0) - (chill ? 0.18 : 0) + (rnd(seed, 3) - 0.5) * 0.12;
  intensity = clamp(intensity, 0.22, 0.92);

  const acts: Director["acts"] = [];
  /** B 档目标：所有可玩模板统一「四幕」节奏，便于运行时章节与事件对齐 */
  const actCount = 4;
  for (let i = 0; i < actCount; i += 1) {
    const at = i === 0 ? 0 : i === actCount - 1 ? 1 : clamp(i / (actCount - 1) + (rnd(seed, i + 10) - 0.5) * 0.06, 0, 1);
    const label = gameActLabel(locale, i, actCount);
    const mods: string[] = [];

    if (params.spec.templateId === "towerDefense") {
      if (i === 1) mods.push("elite");
      if (i === actCount - 1) mods.push("rush");
      if (rnd(seed, 100 + i) > 0.66) mods.push("armored");
    } else if (params.spec.templateId === "platformer") {
      if (i === 1) mods.push("gaps");
      if (i === 2 && rnd(seed, 200) > 0.45) mods.push("spikes");
      if (i === actCount - 1) mods.push("precision");
    } else {
      if (i === 1) mods.push("doubleSpawn");
      if (i === 2) {
        if (params.spec.templateId === "collector") mods.push("bonusField");
        else if (params.spec.templateId === "survivor") mods.push("doubleSpawn");
        else mods.push("zigzag"); // avoider
      }
      if (i === actCount - 1) mods.push("finale");
      if (rnd(seed, 300 + i) > 0.72) mods.push("zigzag");
    }

    if (isCyber && rnd(seed, 400 + i) > 0.55) mods.push("glitch");
    if (isOcean && rnd(seed, 500 + i) > 0.6) mods.push("current");
    if (isSpace && rnd(seed, 600 + i) > 0.6) mods.push("meteorShower");

    acts.push({ at, label, modifiers: mods.slice(0, 6) });
  }

  const events: NonNullable<Director["events"]> = [];

  const atJitter = (base: number, spread: number, salt: number) =>
    clamp(base + (rnd(seed, salt) - 0.5) * spread, 0.08, 0.92);
  const evStrength = (salt: number, bump = 0) => clamp(intensity + bump + (rnd(seed, salt) - 0.5) * 0.18, 0.35, 0.98);

  const addEvent = (e: DirectorEvent) => {
    // 去重：同类型只保留一次（更靠后的覆盖）
    const idx = events.findIndex((x) => x.type === e.type);
    if (idx >= 0) events.splice(idx, 1);
    events.push(e);
  };

  const template = params.spec.templateId;

  const wantBoss = hard || /boss|首领|关底|精英/.test(p) || intensity >= 0.66;
  const wantCoin = wantEvents || /金币|奖励|掉落|宝箱|loot|gold/.test(p);
  const wantGoal = wantEvents || /目标|限时|守点|护送|冲刺|任务|objective/.test(p);

  // 更高概率产出事件：默认至少 1 个；想要“成品感”时常见 3 个
  const baseRoll = wantEvents ? 0.88 : 0.72;
  const extraRoll = wantEvents ? 0.75 : 0.55;
  const thirdRoll = wantEvents ? 0.58 : 0.35;

  // coinRain：塔防里变成“额外金币/奖励波”，其他模板是“高收益窗口”
  if (wantCoin && rnd(seed, 701) < baseRoll) {
    addEvent({
      at: template === "towerDefense" ? atJitter(0.26, 0.12, 711) : atJitter(0.42, 0.12, 712),
      type: "coinRain",
      strength: evStrength(713, template === "towerDefense" ? 0.04 : 0),
      durationMs: template === "towerDefense" ? 5200 : 4200,
      title: gameEventTitle(locale, "coinRain", template),
      message: gameEventMessage(locale, "coinRain", template) ?? tr("msg.coinRainFallback"),
    });
  }

  // goalShift：塔防为“守点不掉血”，平台跳/其它为“限时收集目标”
  if (wantGoal && rnd(seed, 721) < (events.length ? extraRoll : baseRoll)) {
    addEvent({
      at: template === "towerDefense" ? atJitter(0.54, 0.16, 722) : atJitter(0.62, 0.16, 723),
      type: "goalShift",
      strength: evStrength(724, template === "platformer" ? 0.02 : 0),
      durationMs: template === "towerDefense" ? 5200 : 4800,
      title: gameEventTitle(locale, "goalShift", template),
      message:
        gameEventMessage(locale, "goalShift", template) ??
        (template === "platformer" ? tr("msg.goalShiftPlat") : tr("msg.goalShiftFallback")),
    });
  }

  // miniBoss：塔防为“精英波 + 装甲强化”，其他模板为“精英威胁/压力段”
  if (wantBoss && rnd(seed, 741) < (events.length ? extraRoll : baseRoll)) {
    addEvent({
      at: template === "towerDefense" ? atJitter(0.78, 0.12, 742) : atJitter(0.86, 0.10, 743),
      type: "miniBoss",
      strength: evStrength(744, 0.1),
      durationMs: template === "towerDefense" ? 5600 : 5200,
      title: gameEventTitle(locale, "miniBoss", template),
      message: gameEventMessage(locale, "miniBoss", template) ?? tr("msg.miniBossFallback"),
    });
  }

  // 若仍为空：给一个保底事件，避免“所有模板都没事件”的感觉
  if (events.length === 0 && rnd(seed, 799) < 0.8) {
    addEvent({
      at: atJitter(0.58, 0.10, 800),
      type: "coinRain",
      strength: evStrength(801),
      durationMs: template === "towerDefense" ? 5200 : 4200,
      title: gameEventTitle(locale, "coinRain", template),
      message: gameEventMessage(locale, "coinRain", template) ?? tr("msg.coinRainShort"),
    });
  }

  // 第三事件小概率追加：更像“3A/关卡编排”
  if (events.length >= 2 && rnd(seed, 833) < thirdRoll) {
    // 用 goalShift 兜底补齐（若已有则忽略），避免重复复杂逻辑
    if (!events.some((e) => e.type === "goalShift")) {
      addEvent({
        at: template === "towerDefense" ? atJitter(0.64, 0.10, 834) : atJitter(0.74, 0.10, 835),
        type: "goalShift",
        strength: evStrength(836),
        durationMs: template === "towerDefense" ? 5200 : 4800,
        title: gameEventTitle(locale, "goalShift", template),
        message: gameEventMessage(locale, "goalShift", template) ?? tr("msg.goalShiftShort"),
      });
    }
  }

  /**
   * PlayScene 三模板：保底「奖励窗 → 限时目标 → 高压段」三件事都存在，
   * 避免仅靠随机 roll 导致一局里没有事件、不像关卡。
   */
  if (template === "avoider" || template === "collector" || template === "survivor") {
    const playEventCopy: Record<
      string,
      { title: string; message: string; durationMs: number }
    > = {
      coinRain: {
        title: tr("play.rewardWindow"),
        message: tr(`playArcade.${template}.coinRain`),
        durationMs: 4400,
      },
      goalShift: {
        title: tr("play.timedGoal"),
        message: tr(`playArcade.${template}.goalShift`),
        durationMs: 5000,
      },
      miniBoss: {
        title: tr("play.pressurePhase"),
        message: tr(`playArcade.${template}.miniBoss`),
        durationMs: 5400,
      },
    };
    const pushIfMissing = (type: string, at: number, salt: number) => {
      if (events.some((e) => e.type === type)) return;
      const meta = playEventCopy[type];
      if (!meta) return;
      events.push({
        at: clamp(at + (rnd(seed, salt) - 0.5) * 0.07, 0.12, 0.88),
        type,
        strength: evStrength(salt + 920),
        durationMs: meta.durationMs,
        title: meta.title,
        message: meta.message,
      });
    };
    pushIfMissing("coinRain", 0.36, 930);
    pushIfMissing("goalShift", 0.58, 931);
    pushIfMissing("miniBoss", 0.82, 932);

    // avoider 专属：终局密集弹幕倒计时（类似 survivor lastStand）
    if (template === "avoider" && !events.some((e) => e.type === "finalBarrage")) {
      events.push({
        at: clamp(0.88 + (rnd(seed, 940) - 0.5) * 0.06, 0.82, 0.94),
        type: "finalBarrage",
        strength: evStrength(941, 0.12),
        durationMs: Math.floor(7000 + intensity * 3000),
        title: tr("finalBarrage.title"),
        message: tr("finalBarrage.message"),
      });
    }

    // collector 专属：黄金收集物窗口（高价值限时物件）
    if (template === "collector" && !events.some((e) => e.type === "goldenPickup")) {
      events.push({
        at: clamp(0.52 + (rnd(seed, 950) - 0.5) * 0.10, 0.42, 0.68),
        type: "goldenPickup",
        strength: evStrength(951, 0.05),
        durationMs: 5200,
        title: tr("goldenPickup.title"),
        message: tr("goldenPickup.message"),
      });
    }

    // survivor 专属：喘息窗口（低压段 + 道具补给）
    if (template === "survivor" && !events.some((e) => e.type === "breathingRoom")) {
      events.push({
        at: clamp(0.44 + (rnd(seed, 960) - 0.5) * 0.10, 0.34, 0.56),
        type: "breathingRoom",
        strength: evStrength(961, -0.15),
        durationMs: 4000,
        title: tr("breathingRoom"),
        message: tr("breathingRoomMsg"),
      });
    }
  }

  events.sort((a, b) => a.at - b.at);

  return {
    intensity,
    acts,
    events: events.length ? events : undefined,
  };
}

