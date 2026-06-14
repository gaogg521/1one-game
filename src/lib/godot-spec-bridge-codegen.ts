import { createHash } from "node:crypto";
import type { GameSpec } from "@/lib/game-spec";
import { isGodotExportSupportedForTemplate } from "@/lib/game-templates/runtime";
import { PRODUCT } from "@/lib/product-config";

/** 将 #RRGGBB 转为 Godot Color("...") 字面量 */
function hexToGodotColor(hex: string): string {
  return `Color("${hex}")`;
}

export type GameSpecBridgeFields = {
  template_id: string;
  game_title: string;
  subtitle: string;
  background_color: string;
  player_color: string;
  hazard_color: string;
  collectible_color: string;
  player_speed: number;
  hazard_speed: number;
  spawn_interval_ms: number;
  jump_strength: number;
  gravity_override: number;
  win_score: number;
  lives: number;
  label_player: string;
  label_hazard: string;
  label_collectible: string;
};

export function gameSpecToBridgeFields(spec: GameSpec): GameSpecBridgeFields {
  const coll = spec.theme.collectibleColor ?? spec.theme.particleTint ?? "#c9a66b";
  return {
    template_id: spec.templateId,
    game_title: spec.title,
    subtitle: spec.labels.subtitle ?? "",
    background_color: hexToGodotColor(spec.theme.backgroundColor),
    player_color: hexToGodotColor(spec.theme.playerColor),
    hazard_color: hexToGodotColor(spec.theme.hazardColor),
    collectible_color: hexToGodotColor(coll),
    player_speed: spec.gameplay.playerSpeed,
    hazard_speed: spec.gameplay.hazardSpeed,
    spawn_interval_ms: spec.gameplay.spawnIntervalMs,
    jump_strength: spec.gameplay.jumpStrength ?? 420,
    gravity_override: spec.gameplay.gravity ?? 980,
    win_score: spec.gameplay.winScore ?? 10,
    lives: spec.gameplay.lives ?? 3,
    label_player: spec.labels.player,
    label_hazard: spec.labels.hazard,
    label_collectible: spec.labels.collectible ?? "收集物",
  };
}

/** 把 GameSpec 映射为 GDScript 赋值注释块（调试用） */
export function gameSpecToBridgeAssignments(spec: GameSpec): string {
  const f = gameSpecToBridgeFields(spec);
  return [
    "# Generated from GameSpec",
    ...Object.entries(f).map(([k, v]) =>
      typeof v === "number" ? `${k} = ${v}` : `${k} = ${JSON.stringify(v)}`,
    ),
  ].join("\n");
}

const BRIDGE_EXPORT_LINES: Array<{ key: keyof GameSpecBridgeFields; gdType: string }> = [
  { key: "template_id", gdType: "String" },
  { key: "game_title", gdType: "String" },
  { key: "subtitle", gdType: "String" },
  { key: "background_color", gdType: "Color" },
  { key: "player_color", gdType: "Color" },
  { key: "hazard_color", gdType: "Color" },
  { key: "collectible_color", gdType: "Color" },
  { key: "player_speed", gdType: "float" },
  { key: "hazard_speed", gdType: "float" },
  { key: "spawn_interval_ms", gdType: "float" },
  { key: "jump_strength", gdType: "float" },
  { key: "gravity_override", gdType: "float" },
  { key: "win_score", gdType: "int" },
  { key: "lives", gdType: "int" },
  { key: "label_player", gdType: "String" },
  { key: "label_hazard", gdType: "String" },
  { key: "label_collectible", gdType: "String" },
];

function formatBridgeDefault(key: keyof GameSpecBridgeFields, gdType: string, value: string | number): string {
  if (gdType === "String") return JSON.stringify(value);
  return String(value);
}

/** 修补 game_spec_bridge.gd 中的 @export 默认值 */
export function patchGameSpecBridgeGdSource(source: string, spec: GameSpec): string {
  const fields = gameSpecToBridgeFields(spec);
  let out = source;
  for (const { key, gdType } of BRIDGE_EXPORT_LINES) {
    const val = formatBridgeDefault(key, gdType, fields[key]);
    const re = new RegExp(`(@export var ${key}: ${gdType} = )[^\\n]+`, "m");
    if (!re.test(out)) {
      throw new Error(`game_spec_bridge.gd 缺少字段: ${key}`);
    }
    out = out.replace(re, `$1${val}`);
  }
  return out;
}

export const GODOT_MOTHER_UNIVERSAL_DIR = "godot-templates/ai-mother-universal";
/** @deprecated 使用 GODOT_MOTHER_UNIVERSAL_DIR */
export const GODOT_MOTHER_PLATFORMER_DIR = GODOT_MOTHER_UNIVERSAL_DIR;
export const GODOT_BRIDGE_REL = "scripts/game_spec_bridge.gd";
export const GODOT_SPEC_JSON_REL = "spec/gamespec.json";

/** 母版 Godot 模板升级时递增，使 Web 导出缓存失效 */
export const GODOT_TEMPLATE_BUILD_ID = "20260613-all-runtimes-3d";

export function godotExportCacheKey(
  spec: GameSpec,
  projectId?: string,
  referenceDigest = "0",
): string {
  const pid = typeof projectId === "string" ? projectId.trim() : "";
  if (pid) {
    const base = pid.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48) || "project";
    const suffix = referenceDigest === "0" ? GODOT_TEMPLATE_BUILD_ID : `r${referenceDigest}_${GODOT_TEMPLATE_BUILD_ID}`;
    return `${base}_${suffix}`;
  }
  return createHash("sha256")
    .update(JSON.stringify({ spec, ref: referenceDigest, tpl: GODOT_TEMPLATE_BUILD_ID }))
    .digest("hex")
    .slice(0, 16);
}

export function isGodotExportSupported(spec: GameSpec): boolean {
  if (!PRODUCT.godot.enabled) return false;
  return isGodotExportSupportedForTemplate(spec.templateId);
}
