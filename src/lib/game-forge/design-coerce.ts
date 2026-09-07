/**
 * Shape coercion for design-agent replies.
 *
 * `response_format: json_schema` is advisory on this gateway: gpt-5-4 honours
 * it, minimax-2-7 does not — it returns plausible free-form JSON that misses
 * required sub-fields and sometimes hands back an object where an array was
 * asked for (`controls` as `{move: "...", jump: "..."}` instead of a list).
 * Depending on server-side enforcement therefore makes the pipeline work only
 * on some of the routed models.
 *
 * This normalises the deviations that are unambiguous — never inventing
 * content, only re-shaping what the model already said — and leaves anything
 * genuinely missing to schema validation and the repair round.
 */

type Dict = Record<string, unknown>;

const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** First present string among several candidate keys. */
function pick(source: Dict, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const hit = str(source[k]);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Turns `{ move: "WASD", jump: "space" }` into
 * `[{ action: "move", desktop: "WASD", touch: "WASD" }, ...]`.
 * A keyed object is a legitimate reading of "controls"; only the list form is
 * usable downstream, and the mapping is lossless.
 */
function coerceControls(value: unknown): unknown {
  const rows = Array.isArray(value) ? value : isDict(value) ? Object.entries(value).map(([action, v]) => ({ action, value: v })) : null;
  if (!rows) return value;
  return rows.map((row) => {
    if (!isDict(row)) return row;
    const inner = isDict(row.value) ? row.value : row;
    const action = pick(row, "action", "name", "verb") ?? pick(inner, "action", "name", "verb") ?? "action";
    const desktop = pick(inner, "desktop", "keyboard", "pc", "key", "keys") ?? str(row.value);
    const touch = pick(inner, "touch", "mobile", "phone", "gesture") ?? desktop;
    // Both bindings must exist; a control with only one is a real gap the
    // repair round should see, so leave it absent rather than inventing it.
    return { action, ...(desktop ? { desktop } : {}), ...(touch ? { touch } : {}) };
  });
}

/** Mechanics arrive as strings, as `{name, description}`, or already correct. */
function coerceMechanics(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((row, index) => {
    if (typeof row === "string") {
      return { id: `mechanic_${index + 1}`, summary: row, observable: row };
    }
    if (!isDict(row)) return row;
    const id = pick(row, "id", "key", "name", "mechanic");
    const summary = pick(row, "summary", "description", "desc", "detail", "what");
    const observable = pick(row, "observable", "observation", "visible", "evidence", "howToSee");
    return {
      ...(id ? { id: id.replace(/\s+/g, "_").toLowerCase().slice(0, 40) } : {}),
      ...(summary ? { summary } : {}),
      // A mechanic with no stated observation is usually the same sentence as
      // its summary rather than a missing field.
      ...(observable ? { observable } : summary ? { observable: summary } : {}),
    };
  });
}

function coerceBeats(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((row, index) => {
    if (!isDict(row)) return row;
    const atRaw = row.at ?? row.position ?? row.time;
    let at = typeof atRaw === "number" ? atRaw : typeof atRaw === "string" ? Number.parseFloat(atRaw) : undefined;
    // "at" is a 0..1 fraction; a model that wrote seconds or a percentage is
    // unambiguous to rescale.
    if (typeof at === "number" && at > 1) at = at > 100 ? Math.min(1, at / 1000) : at / 100;
    const label = pick(row, "label", "name", "title");
    const change = pick(row, "change", "description", "effect", "detail");
    return {
      ...(typeof at === "number" && Number.isFinite(at) ? { at: Math.max(0, Math.min(1, at)) } : { at: (index + 1) / 10 }),
      ...(label ? { label } : {}),
      ...(change ? { change } : {}),
    };
  });
}

/**
 * Maps the words a model naturally reaches for onto the runtime's asset kinds.
 *
 * Measured on minimax-2-7: asked for a design in plain json_object mode it
 * returns "item", "decoration", "hazard", "ground" -- every one of them an
 * unambiguous synonym of a kind the runtime has, and every one of them a
 * validation failure. The only thing that made the model spell the enum
 * correctly was strict json_schema, which cost 2.5x the generated tokens and
 * turned a 35s call into an 82s one, because the model spends its reasoning
 * budget checking itself against the schema instead of designing a game.
 *
 * Translating a synonym is the coercer's job, not the model's. This is a
 * vocabulary map, never invention: an unrecognised kind falls back to "prop",
 * which only affects the art wording and the placeholder colour.
 */
const ASSET_KIND_SYNONYMS: Record<string, string> = {
  hero: "player", character: "player", avatar: "player", protagonist: "player", playable: "player",
  item: "collectible", pickup: "collectible", collectable: "collectible", loot: "collectible",
  treasure: "collectible", coin: "collectible", reward: "collectible", food: "collectible",
  hazard: "obstacle", trap: "obstacle", danger: "obstacle", spike: "obstacle", barrier: "obstacle",
  wall: "obstacle", blocker: "obstacle",
  ground: "platform", floor: "platform", terrain: "platform", surface: "platform",
  foe: "enemy", monster: "enemy", villain: "enemy", opponent: "enemy", hunter: "enemy",
  bullet: "projectile", missile: "projectile", shot: "projectile", arrow: "projectile",
  powerup: "power", power_up: "power", buff: "power", upgrade: "power", boost: "power",
  decoration: "prop", decor: "prop", scenery: "prop", ornament: "prop", object: "prop",
  icon: "ui_icon", ui: "ui_icon", hud: "ui_icon", button: "ui_icon", frame: "ui_icon",
  bg: "background", backdrop: "background", scene: "background", environment: "background",
  tileset: "tile", tiles: "tile",
};

const ASSET_KINDS = new Set([
  "background", "player", "enemy", "enemy_alt", "boss", "collectible", "power",
  "projectile", "obstacle", "platform", "prop", "tile", "ui_icon",
]);

function coerceAssetKind(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (ASSET_KINDS.has(raw)) return raw;
  if (ASSET_KIND_SYNONYMS[raw]) return ASSET_KIND_SYNONYMS[raw];
  // "enemy_flying", "collectible_gold": the head word carries the kind.
  for (const part of raw.split("_")) {
    if (ASSET_KINDS.has(part)) return part;
    if (ASSET_KIND_SYNONYMS[part]) return ASSET_KIND_SYNONYMS[part];
  }
  return "prop";
}

function coerceAssets(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((row) => {
    if (!isDict(row)) return row;
    const key = pick(row, "key", "id", "name", "slot");
    const prompt = pick(row, "prompt", "description", "desc", "imagePrompt");
    const kind = coerceAssetKind(pick(row, "kind", "type", "category"));
    return {
      ...row,
      ...(key ? { key: key.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 40) } : {}),
      ...(prompt ? { prompt } : {}),
      ...(kind ? { kind } : {}),
      required: typeof row.required === "boolean" ? row.required : false,
    };
  });
}

function coerceModules(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((row) => {
    if (!isDict(row)) return row;
    const id = pick(row, "id", "name");
    const signatures = Array.isArray(row.signatures)
      ? row.signatures.map((s) => {
          if (!isDict(s)) return s;
          const name = pick(s, "name", "fn", "function");
          const params = Array.isArray(s.params) ? s.params.filter((p): p is string => typeof p === "string") : [];
          return { ...(name ? { name } : {}), params };
        })
      : [];
    return {
      ...row,
      // Module ids feed a lowercase-snake regex and a generated function name.
      ...(id ? { id: id.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "").slice(0, 28) || "module" } : {}),
      provides: Array.isArray(row.provides) ? row.provides.filter((p): p is string => typeof p === "string") : [],
      requires: Array.isArray(row.requires) ? row.requires.filter((p): p is string => typeof p === "string") : [],
      signatures,
    };
  });
}

/** Best-effort re-shaping of a design reply before schema validation. */
export function coerceDesignShape(raw: unknown): unknown {
  if (!isDict(raw)) return raw;
  const out: Dict = { ...raw };

  const genre = pick(out, "genre", "category", "gameType", "type");
  if (genre) out.genre = genre;

  // coreLoop is sometimes prose, sometimes a keyed object of steps.
  const loop = out.coreLoop ?? out.core_loop ?? out.loop ?? out.gameplayLoop;
  if (typeof loop === "string") out.coreLoop = loop.split(/\n+|(?<=[。.;；])\s+/).map((s) => s.trim()).filter(Boolean);
  else if (isDict(loop)) out.coreLoop = Object.values(loop).filter((v): v is string => typeof v === "string");
  else if (Array.isArray(loop)) out.coreLoop = loop.map((v) => (typeof v === "string" ? v : String(v)));

  if (out.controls !== undefined) out.controls = coerceControls(out.controls);
  if (out.mechanics !== undefined) out.mechanics = coerceMechanics(out.mechanics);
  if (out.assets !== undefined) out.assets = coerceAssets(out.assets);
  if (out.modules !== undefined) out.modules = coerceModules(out.modules);

  if (isDict(out.progression)) {
    const prog: Dict = { ...out.progression };
    const win = pick(prog, "winCondition", "win", "victory", "winCon", "success");
    const lose = pick(prog, "loseCondition", "lose", "failure", "loseCon", "defeat");
    if (win) prog.winCondition = win;
    if (lose) prog.loseCondition = lose;
    if (prog.beats !== undefined) prog.beats = coerceBeats(prog.beats);
    out.progression = prog;
  }

  if (isDict(out.audio)) {
    const audio: Dict = { ...out.audio };
    if (!Array.isArray(audio.cues)) audio.cues = [];
    out.audio = audio;
  } else if (out.audio === undefined) {
    out.audio = { cues: [] };
  }

  // gameFeel and configShape are plain string lists in every observed reply
  // shape; an object of them is still unambiguous.
  for (const key of ["gameFeel", "configShape"]) {
    const v = out[key];
    if (isDict(v)) out[key] = Object.values(v).filter((x): x is string => typeof x === "string");
    else if (typeof v === "string") out[key] = [v];
  }

  return out;
}
