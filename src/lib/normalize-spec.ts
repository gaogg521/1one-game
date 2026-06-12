import {
  DirectorSchema,
  GameSpecSchema,
  SystemsSchema,
  type GameSpec,
} from "@/lib/game-spec";
import type { AppLocale } from "@/i18n/routing";
import { untitledGameLabel } from "@/lib/i18n/chapter-labels";
const TowerDefenseBlueprintSchema = GameSpecSchema.shape.towerDefense;
import { withPresentationDefaults } from "@/lib/cohesive-presentation";
import { isGameTemplateId } from "@/lib/game-templates/registry";

function normalizeHex(input: string): string | null {
  let s = input.trim();
  if (!s.startsWith("#")) {
    if (/^[0-9a-fA-F]{6}$/.test(s)) s = `#${s}`;
    else if (/^[0-9a-fA-F]{3}$/.test(s)) {
      s = `#${s
        .split("")
        .map((c) => `${c}${c}`)
        .join("")}`;
    } else return null;
  }
  if (!/^#[0-9a-fA-F]{6}$/i.test(s)) return null;
  return `#${s.slice(1).toLowerCase()}`;
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function num(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v === "number") return clamp(v, min, max);
  if (typeof v === "string") return clamp(Number(v), min, max);
  return fallback;
}

/** 将宽松 JSON 尽量收敛到合法 GameSpec（修复颜色格式、字符串数值、缺字段等）。 */
export function coerceGameSpec(
  raw: unknown,
  uiLocale: AppLocale = "zh-Hans",
): { ok: true; spec: GameSpec } | { ok: false; issues: string[] } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, issues: ["根节点不是对象"] };
  }

  const o = raw as Record<string, unknown>;
  const issues: string[] = [];

  if (o.version !== 1) {
    issues.push("version 应为 1");
  }

  let templateId: GameSpec["templateId"] = "avoider";
  if (typeof o.templateId === "string" && isGameTemplateId(o.templateId)) {
    templateId = o.templateId;
  } else if (o.templateId !== undefined) {
    issues.push("templateId 非法，已回落 avoider");
  }

  const titleRaw = typeof o.title === "string" ? o.title.trim().slice(0, 80) : "";
  const title = titleRaw.length > 0 ? titleRaw : untitledGameLabel(uiLocale);
  if (!titleRaw) issues.push("title 为空，已使用默认标题");

  const themeIn = o.theme && typeof o.theme === "object" ? (o.theme as Record<string, unknown>) : {};
  const bg =
    typeof themeIn.backgroundColor === "string" ? normalizeHex(themeIn.backgroundColor) : null;
  const pc = typeof themeIn.playerColor === "string" ? normalizeHex(themeIn.playerColor) : null;
  const hc = typeof themeIn.hazardColor === "string" ? normalizeHex(themeIn.hazardColor) : null;
  const cc =
    typeof themeIn.collectibleColor === "string"
      ? normalizeHex(themeIn.collectibleColor)
      : undefined;
  const pt =
    typeof themeIn.particleTint === "string" ? normalizeHex(themeIn.particleTint) : undefined;

  if (!bg || !pc || !hc) {
    issues.push("theme 颜色无法解析为 #RRGGBB");
  }

  const gpIn = o.gameplay && typeof o.gameplay === "object" ? (o.gameplay as Record<string, unknown>) : {};
  const playerSpeed = num(gpIn.playerSpeed, 120, 520, 300);
  const hazardSpeed = num(gpIn.hazardSpeed, 80, 520, 280);
  const spawnIntervalMs = num(gpIn.spawnIntervalMs, 280, 2200, 640);

  let winScore: number | undefined;
  if (gpIn.winScore !== undefined && gpIn.winScore !== null) {
    winScore = num(gpIn.winScore, 5, 200, 30);
  }

  let lives: number | undefined;
  if (gpIn.lives !== undefined && gpIn.lives !== null) {
    lives = clamp(Math.round(num(gpIn.lives, 1, 9, 3)), 1, 9);
  }

  let arenaPadding: number | undefined;
  if (gpIn.arenaPadding !== undefined && gpIn.arenaPadding !== null) {
    arenaPadding = clamp(Math.round(num(gpIn.arenaPadding, 16, 80, 36)), 16, 80);
  }

  let jumpStrength: number | undefined;
  if (gpIn.jumpStrength !== undefined && gpIn.jumpStrength !== null) {
    jumpStrength = num(gpIn.jumpStrength, 280, 720, 420);
  }
  let gravity: number | undefined;
  if (gpIn.gravity !== undefined && gpIn.gravity !== null) {
    gravity = num(gpIn.gravity, 400, 1400, 950);
  }

  let startingCoins: number | undefined;
  if (gpIn.startingCoins !== undefined && gpIn.startingCoins !== null) {
    startingCoins = num(gpIn.startingCoins, 40, 400, 120);
  }
  let baseHealth: number | undefined;
  if (gpIn.baseHealth !== undefined && gpIn.baseHealth !== null) {
    baseHealth = clamp(Math.round(num(gpIn.baseHealth, 15, 120, 40)), 15, 120);
  }

  const lbIn = o.labels && typeof o.labels === "object" ? (o.labels as Record<string, unknown>) : {};
  const player =
    typeof lbIn.player === "string" && lbIn.player.trim()
      ? lbIn.player.trim().slice(0, 32)
      : "主角";
  const hazard =
    typeof lbIn.hazard === "string" && lbIn.hazard.trim()
      ? lbIn.hazard.trim().slice(0, 32)
      : "障碍";
  const collectible =
    typeof lbIn.collectible === "string" && lbIn.collectible.trim()
      ? lbIn.collectible.trim().slice(0, 32)
      : undefined;
  const subtitle =
    typeof lbIn.subtitle === "string" && lbIn.subtitle.trim()
      ? lbIn.subtitle.trim().slice(0, 120)
      : undefined;

  const presIn = o.presentation && typeof o.presentation === "object" ? (o.presentation as Record<string, unknown>) : null;
  let presentation: GameSpec["presentation"] | undefined;
  if (presIn) {
    const mp = presIn.musicProfile;
    if (mp === "organic" || mp === "pulse" || mp === "minimal" || mp === "neon") {
      presentation = { musicProfile: mp };
    }
  }

  let directorOpt: GameSpec["director"] | undefined;
  if (typeof o.director === "object" && o.director !== null) {
    const d = DirectorSchema.safeParse(o.director);
    if (d.success) directorOpt = d.data;
  }

  let systemsOpt: GameSpec["systems"] | undefined;
  if (typeof o.systems === "object" && o.systems !== null) {
    const s = SystemsSchema.safeParse(o.systems);
    if (s.success) systemsOpt = s.data;
  }

  let towerDefenseOpt: GameSpec["towerDefense"] | undefined;
  if (templateId === "towerDefense" && typeof o.towerDefense === "object" && o.towerDefense !== null) {
    const td = TowerDefenseBlueprintSchema.safeParse(o.towerDefense);
    if (td.success) towerDefenseOpt = td.data;
    else issues.push("towerDefense 蓝图未通过校验，保存时将自动生成默认关卡");
  }

  const candidate: GameSpec = {
    version: 1,
    templateId,
    title,
    theme: {
      backgroundColor: bg ?? "#141816",
      playerColor: pc ?? "#89a884",
      hazardColor: hc ?? "#9d5838",
      collectibleColor: cc ?? "#c9a66b",
      particleTint: pt ?? "#69746c",
    },
    gameplay: {
      playerSpeed,
      hazardSpeed,
      spawnIntervalMs,
      winScore,
      lives,
      arenaPadding,
      jumpStrength,
      gravity,
      startingCoins,
      baseHealth,
    },
    labels: {
      player,
      hazard,
      collectible,
      subtitle,
    },
    presentation,
    ...(directorOpt !== undefined ? { director: directorOpt } : {}),
    ...(systemsOpt !== undefined ? { systems: systemsOpt } : {}),
    ...(towerDefenseOpt !== undefined ? { towerDefense: towerDefenseOpt } : {}),
  };

  const parsed = GameSpecSchema.safeParse(candidate);
  if (parsed.success) {
    return { ok: true, spec: withPresentationDefaults(parsed.data) };
  }
  parsed.error.issues.forEach((i) => issues.push(`${i.path.join(".")}: ${i.message}`));
  return { ok: false, issues };
}

/** 模型输出无效时，把可读字段叠到离线基准规格上再收敛，尽量避免完全丢弃创意。 */
export function overlaySpec(base: GameSpec, raw: unknown): GameSpec {
  const direct = coerceGameSpec(raw);
  if (direct.ok) return direct.spec;

  if (!raw || typeof raw !== "object") return base;

  const r = raw as Record<string, unknown>;
  let overlayDirector: GameSpec["director"] | undefined = base.director;
  if (r.director === null) {
    overlayDirector = undefined;
  } else if (typeof r.director === "object" && r.director !== null) {
    const parsed = DirectorSchema.safeParse(r.director);
    overlayDirector = parsed.success ? parsed.data : base.director;
  }

  let overlaySystems: GameSpec["systems"] | undefined = base.systems;
  if (r.systems === null) {
    overlaySystems = undefined;
  } else if (typeof r.systems === "object" && r.systems !== null) {
    const parsed = SystemsSchema.safeParse(r.systems);
    overlaySystems = parsed.success ? parsed.data : base.systems;
  }

  const merged: Record<string, unknown> = {
    version: 1,
    templateId:
      typeof r.templateId === "string" && isGameTemplateId(r.templateId)
        ? r.templateId
        : base.templateId,
    title: typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 80) : base.title,
    theme: {
      ...base.theme,
      ...(typeof r.theme === "object" && r.theme !== null ? r.theme : {}),
    },
    gameplay: {
      ...base.gameplay,
      ...(typeof r.gameplay === "object" && r.gameplay !== null ? r.gameplay : {}),
    },
    labels: {
      ...base.labels,
      ...(typeof r.labels === "object" && r.labels !== null ? r.labels : {}),
    },
    towerDefense:
      typeof r.towerDefense === "object" && r.towerDefense !== null ? r.towerDefense : base.towerDefense,
    director: overlayDirector,
    systems: overlaySystems,
    presentation:
      typeof r.presentation === "object" && r.presentation !== null
        ? { ...base.presentation, ...(r.presentation as GameSpec["presentation"]) }
        : base.presentation,
  };

  const second = coerceGameSpec(merged);
  return second.ok ? second.spec : base;
}
