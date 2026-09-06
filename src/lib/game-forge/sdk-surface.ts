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

export const SDK_SURFACE: Record<string, readonly string[]> = {
  g: [
    "version", "stage", "input", "audio", "assets", "draw", "r", "fx", "ui", "world", "rng", "ease",
    "tween", "after", "every", "cancelTimer", "telemetry", "state", "won",
    "width", "height", "finished", "paused", "portrait",
    "clamp", "lerp", "dist", "angleTo",
    "addScore", "loseLife", "win", "lose", "finish", "pause", "restart", "start", "destroy",
  ],
  r: [
    "ctx", "camera", "begin", "end", "width", "height", "clear", "fillScreen", "backdrop",
    "sprite", "rect", "rectTL", "roundRect", "circle", "ring", "line", "poly", "text", "ui",
  ],
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
export const SDK_SFX_NAMES = [
  "coin", "pickup", "jump", "dash", "shoot", "hit", "hurt", "explode", "powerup", "select", "step", "win", "lose",
] as const;

export const SDK_EASE_NAMES = [
  "linear", "inQuad", "outQuad", "inOutQuad", "outCubic", "outBack", "outElastic", "outBounce",
] as const;
