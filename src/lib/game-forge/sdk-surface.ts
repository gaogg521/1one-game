/**
 * The exact member surface of the runtime SDK.
 *
 * Because the engine is hand-written here, a member the generated code touches
 * that is absent from these tables is a hallucinated API and therefore a
 * guaranteed runtime TypeError. This is the deterministic check the old regex
 * contracts never had: it predicts execution failure instead of guessing at
 * intent from keywords.
 *
 * Keep in sync with `runtime-sdk.ts`.
 */

/**
 * The renderer's members, listed once and exposed under both names.
 *
 * `g.draw` and `g.r` are literally the same object in the SDK (`draw: r, r:
 * r`), so they have to present the same surface. Only `r` was listed here,
 * which meant every `g.draw.<member>` call went unchecked: a module called
 * `g.draw.ellipse` -- not a real member -- the audit stayed green, and the
 * build threw `r.ellipse is not a function` before rendering a single frame.
 */
const RENDERER_SURFACE: readonly string[] = [
  "ctx", "camera", "begin", "end", "width", "height", "clear", "fillScreen", "backdrop",
  "sprite", "rect", "rectTL", "roundRect", "circle", "ring", "line", "poly", "text", "ui",
];

export const SDK_SURFACE: Record<string, readonly string[]> = {
  g: [
    "version", "stage", "input", "audio", "assets", "draw", "r", "fx", "ui", "world", "rng", "ease",
    "tween", "after", "every", "cancelTimer", "telemetry", "state", "won",
    "width", "height", "finished", "paused", "portrait",
    "clamp", "lerp", "dist", "angleTo",
    "addScore", "loseLife", "win", "lose", "finish", "pause", "restart", "start", "destroy",
  ],
  r: RENDERER_SURFACE,
  draw: RENDERER_SURFACE,
  input: ["down", "pressed", "released", "pointer", "swipe", "stick", "touch", "firstInputAt", "axis", "button", "buttons", "endFrame", "destroy"],
  audio: ["unlock", "sfx", "tone", "noise", "music", "stopMusic", "setMuted", "muted"],
  assets: ["image", "placeholder", "palette", "pending", "whenReady"],
  fx: ["particles", "burst", "trail", "popText", "shake", "flash", "freeze", "consumeFreeze", "update", "draw", "drawOverlay", "clear"],
  ui: ["hud", "progress", "banner", "toast", "hint", "clearHint", "update", "draw", "endCard", "clear"],
  world: ["groups", "spawn", "get", "count", "each", "kill", "clear", "collide", "overlapsCircle", "overlapsRect", "step"],
  state: ["score", "lives", "time", "level"],
  rng: ["next", "range", "int", "pick", "chance", "sign", "angle"],
  stage: ["canvas", "wrap", "g2d", "width", "height", "scale", "portrait", "resize", "toVirtual", "destroy"],
  camera: ["x", "y", "zoom", "shakeX", "shakeY"],
  pointer: ["x", "y", "down", "justDown", "justUp", "id"],
  swipe: ["dx", "dy", "dir", "active"],
  stick: ["active", "x", "y", "baseX", "baseY", "id", "radius"],
};

/** Names the SDK's own procedural sound library answers to. */
/**
 * Words a code agent reaches for that mean one of the cues the SDK has.
 *
 * The SDK reference already lists the exact names, and agents still write
 * "explosion" for "explode" and "fanfare" for "win" -- the same near-miss
 * pattern as the asset-kind enum. Telling them harder does not work; the
 * runtime resolving the synonym does. Sound is not worth a repair round, but
 * silently degrading every explosion to a generic blip is exactly the kind of
 * quality leak nobody notices in a report and everybody hears in the game.
 *
 * MIRRORED in the runtime SDK's own SFX_ALIASES, whose body cannot import
 * anything (it is a plain string inlined into the iframe). qa-forge-sfx-alias
 * asserts the two stay identical.
 */
export const SDK_SFX_ALIASES: Record<string, string> = {
  explosion: "explode", blast: "explode", boom: "explode", bomb: "explode",
  fanfare: "win", victory: "win", success: "win", complete: "win", cheer: "win",
  fail: "lose", death: "lose", gameover: "lose", defeat: "lose", die: "lose",
  buzzer: "lose", alarm: "lose", siren: "lose", error: "lose", wrong: "lose",
  collect: "pickup", grab: "pickup", gather: "pickup", get: "pickup",
  money: "coin", gold: "coin", score: "coin", point: "coin",
  attack: "shoot", fire: "shoot", laser: "shoot", throw: "shoot",
  damage: "hurt", ouch: "hurt", pain: "hurt",
  impact: "hit", thud: "hit", bump: "hit", crash: "hit",
  buff: "powerup", upgrade: "powerup", boost: "powerup", power: "powerup",
  click: "select", button: "select", menu: "select", confirm: "select", tap: "select",
  walk: "step", footstep: "step", run: "step",
  leap: "jump", hop: "jump", bounce: "jump",
  sprint: "dash", rush: "dash",
};

/**
 * The cue a name resolves to, or undefined when nothing sensible matches.
 *
 * The explicit table cannot win a race against natural language: "buzzer" was
 * added, and the next build asked for "buzz". So after the exact lookup there
 * is one prefix rule -- a name at least four characters long that begins a
 * known cue or alias resolves to it ("buzz" -> "buzzer" -> lose, "explos" ->
 * "explosion" -> explode). Four characters is what keeps it from firing on
 * something short and unrelated, and the fallback is still an audible generic
 * blip rather than silence, so a wrong guess here costs a wrong sound, never a
 * broken build.
 */
export function resolveSfxName(name: string): string | undefined {
  const raw = name.trim().toLowerCase();
  if ((SDK_SFX_NAMES as readonly string[]).includes(raw)) return raw;
  if (SDK_SFX_ALIASES[raw]) return SDK_SFX_ALIASES[raw];
  if (raw.length < 4) return undefined;
  const cue = (SDK_SFX_NAMES as readonly string[]).find((n) => n.startsWith(raw));
  if (cue) return cue;
  const alias = Object.keys(SDK_SFX_ALIASES).find((a) => a.startsWith(raw));
  return alias ? SDK_SFX_ALIASES[alias] : undefined;
}

export const SDK_SFX_NAMES = [
  "coin", "pickup", "jump", "dash", "shoot", "hit", "hurt", "explode", "powerup", "select", "step", "win", "lose",
] as const;

export const SDK_EASE_NAMES = [
  "linear", "inQuad", "outQuad", "inOutQuad", "outCubic", "outBack", "outElastic", "outBounce",
] as const;
