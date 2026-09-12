import { resolveSfxName, SDK_SFX_NAMES, SDK_SURFACE } from "@/lib/game-forge/sdk-surface";
import type { GameDesignDoc, GameModule, QaFinding } from "@/lib/game-forge/types";

/**
 * Deterministic module assembly.
 *
 * Modules are generated independently — that is what lets each one use the
 * full completion budget — so this file owns the contract that makes them fit
 * together: a shared `G` namespace, a dependency-ordered call sequence and one
 * `mountGame` entry point.
 */

/** Anything here would either escape the sandbox or break determinism. */
export const FORBIDDEN_PATTERNS: Array<{ code: string; re: RegExp; message: string }> = [
  { code: "network", re: /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|navigator\s*\.\s*sendBeacon)\s*\(/, message: "network access is not available in the sandbox" },
  { code: "dynamic_code", re: /\b(?:eval|Function)\s*\(|new\s+Function\s*\(/, message: "dynamic code evaluation is forbidden" },
  { code: "module_loader", re: /\b(?:require|importScripts)\s*\(|(?:^|[^.\w])import\s*\(/, message: "module loading is not available" },
  { code: "worker", re: /\bnew\s+(?:Shared)?Worker\s*\(/, message: "workers are not available" },
  { code: "storage", re: /\b(?:localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie)\b/, message: "storage is blocked by the sandbox; keep state in memory" },
  { code: "popup", re: /\bwindow\s*\.\s*open\s*\(|\balert\s*\(|\bconfirm\s*\(|\bprompt\s*\(/, message: "popups are blocked by the sandbox" },
  { code: "own_loop", re: /\brequestAnimationFrame\s*\(/, message: "the SDK owns the game loop; implement update(dt, g) instead" },
  { code: "own_canvas", re: /createElement\s*\(\s*['"]canvas['"]\s*\)/, message: "the SDK owns the canvas; draw through the r passed to draw()" },
  { code: "own_listener", re: /\baddEventListener\s*\(/, message: "the SDK owns input; read g.input instead of registering listeners" },
];

export function scanForbidden(moduleId: string, source: string): QaFinding[] {
  const stripped = stripCommentsAndStrings(source);
  return FORBIDDEN_PATTERNS
    .filter((rule) => rule.re.test(stripped))
    .map((rule) => ({ severity: "blocker" as const, moduleId, code: rule.code, message: rule.message }));
}

/**
 * Removes comments and string bodies so a pattern scan reflects executable
 * code. Without this a mechanic named only in a comment reads as implemented,
 * which is exactly how the previous regex gates were fooled.
 */
export function stripCommentsAndStrings(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i]!;
    const next = source[i + 1];
    if (c === "/" && next === "/") {
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i += 1;
      out += quote + quote;
      while (i < n) {
        if (source[i] === "\\") { i += 2; continue; }
        if (source[i] === quote) { i += 1; break; }
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/**
 * Strips comments but keeps string bodies. Checks that inspect string literals
 * (sound cue names, asset keys) need this; checks that look for executable
 * behaviour must use `stripCommentsAndStrings` instead.
 */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i]!;
    const next = source[i + 1];
    if (c === "/" && next === "/") {
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i += 1;
      while (i < n) {
        out += source[i];
        if (source[i] === "\\") { out += source[i + 1] ?? ""; i += 2; continue; }
        if (source[i] === quote) { i += 1; break; }
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** Balanced-delimiter check; a truncated completion is the common failure. */
export function checkBalanced(moduleId: string, source: string): QaFinding[] {
  const code = stripCommentsAndStrings(source);
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  for (const ch of code) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (pairs[ch]) {
      if (stack.pop() !== pairs[ch]) {
        return [{ severity: "blocker", moduleId, code: "unbalanced", message: `unbalanced ${ch} — the module source is malformed or truncated` }];
      }
    }
  }
  return stack.length
    ? [{ severity: "blocker", moduleId, code: "truncated", message: `${stack.length} unclosed ${stack[stack.length - 1]} — the completion was truncated` }]
    : [];
}

/**
 * Real JavaScript syntax check — the cheapest and most decisive audit here.
 *
 * `checkBalanced` only proves the delimiters pair up, which a genuinely
 * invalid program can still do: an observed build contained
 * `function G.tickSpawns(dt, g) { … }` (valid-looking, perfectly balanced, and
 * not parseable). In the browser that takes down the ENTIRE script block, so
 * the game never mounts and the failure surfaces only as a blank frame.
 *
 * `new Function` compiles without executing, so this is safe to run over
 * untrusted generated source.
 */
export function checkSyntax(moduleId: string, source: string, role?: GameModule["role"]): QaFinding[] {
  try {
    // Module bodies are compiled with the same parameters the assembler gives
    // them, so a body that references G/g still parses in isolation.
    if (role === "config") new Function("G", source);
    else new Function("G", "g", source);
    return [];
  } catch (e) {
    return [{
      severity: "blocker",
      moduleId,
      code: "syntax_error",
      message: `${(e as Error).message} — the module is not valid JavaScript. Assign functions as "G.name = function (args) { … }"; "function G.name(args) { … }" is a syntax error that breaks the whole build.`,
    }];
  }
}

/**
 * Orders modules so every `requires` is satisfied by an earlier `provides`.
 * Config always leads and main always trails regardless of declarations.
 */
export function orderModules(modules: GameModule[]): { ordered: GameModule[]; findings: QaFinding[] } {
  const findings: QaFinding[] = [];
  const config = modules.filter((m) => m.role === "config");
  const main = modules.filter((m) => m.role === "main");
  const systems = modules.filter((m) => m.role === "system");

  const provided = new Set<string>();
  for (const m of config) for (const p of m.provides) provided.add(p);

  const ordered: GameModule[] = [];
  const remaining = systems.slice();
  let guard = 0;
  while (remaining.length && guard < systems.length + 2) {
    guard += 1;
    const ready = remaining.filter((m) => m.requires.every((req) => provided.has(req)));
    const batch = ready.length ? ready : remaining.slice();
    if (!ready.length && remaining.length) {
      findings.push({
        severity: "minor",
        moduleId: batch[0]!.id,
        code: "dependency_cycle",
        message: `unresolved dependencies ${batch[0]!.requires.filter((r) => !provided.has(r)).join(", ")} — emitted in declaration order`,
      });
    }
    for (const m of batch) {
      ordered.push(m);
      for (const p of m.provides) provided.add(p);
      remaining.splice(remaining.indexOf(m), 1);
    }
  }
  ordered.push(...remaining);

  for (const m of main) {
    const missing = m.requires.filter((req) => !provided.has(req));
    if (missing.length) {
      findings.push({ severity: "major", moduleId: m.id, code: "missing_dependency", message: `main requires ${missing.join(", ")} which no module provides` });
    }
  }

  return { ordered: [...config, ...ordered, ...main], findings };
}

function fnName(id: string): string {
  return `MOD_${id.replace(/[^a-z0-9_]/gi, "_")}`;
}

export type AssembleResult = {
  source: string;
  findings: QaFinding[];
};

/**
 * Produces the single-file runtime the iframe executes.
 *
 * Each module becomes a function over the shared namespace, so a repair pass
 * can replace exactly one module without touching the rest of the game.
 */
export function assembleGame(design: GameDesignDoc, modules: GameModule[]): AssembleResult {
  const findings: QaFinding[] = [];
  for (const m of modules) {
    findings.push(...scanForbidden(m.id, m.source));
    findings.push(...checkBalanced(m.id, m.source));
    findings.push(...checkSyntax(m.id, m.source, m.role));
  }

  const hudOwners = modules.filter((module) => {
    const code = stripCommentsAndStrings(module.source);
    const usesSdkHud = /\bg\s*\.\s*ui\s*\.\s*hud\s*\(/.test(code);
    const drawsCustomHud = /hud|interface|ui/i.test(module.id) && /\bg\s*\.\s*draw\s*\./.test(code);
    return usesSdkHud || drawsCustomHud;
  });
  if (hudOwners.length > 1) {
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: "duplicate_hud",
      message: `Multiple modules render HUD content (${hudOwners.map((module) => module.id).join(", ")}). Keep one HUD owner: main should update state and the HUD module should render it once.`,
    });
  }

  /*
   * Entity groups are strings, so a mismatch between the module that spawns and
   * the module that reads is invisible to every syntax and signature check --
   * and it silently switches off whatever that group was for.
   *
   * Measured on a shipped game: spawn_system spawned 'meteor', main_game drew
   * 'meteor', and collision_system iterated 'enemy'. Hazards therefore never
   * collided with anything, the player could not lose, and the build passed
   * delivery because it still rendered, moved and accepted input.
   */
  const spawnedGroups = new Set<string>();
  const readGroups = new Map<string, string>();
  for (const built of modules) {
    // Comments only: the group name IS a string literal, so stripping strings
    // would erase the very thing being compared.
    const code = stripComments(built.source);
    for (const match of code.matchAll(/\bworld\s*\.\s*spawn\s*\(\s*["'`]([A-Za-z_][\w-]*)["'`]/g)) {
      spawnedGroups.add(match[1]!);
    }
    for (const match of code.matchAll(/\bworld\s*\.\s*(?:each|get|collide|count|kill_?all|clearGroup)\s*\(\s*["'`]([A-Za-z_][\w-]*)["'`]/g)) {
      if (!readGroups.has(match[1]!)) readGroups.set(match[1]!, built.id);
    }
  }
  // Only meaningful once something was spawned by name; a build that spawns
  // nothing is a different finding.
  if (spawnedGroups.size) {
    for (const [group, moduleId] of readGroups) {
      if (spawnedGroups.has(group)) continue;
      findings.push({
        severity: "blocker",
        moduleId,
        code: "entity_group_never_spawned",
        message: `${moduleId} reads the entity group '${group}', but nothing spawns it — the groups actually spawned are ${[...spawnedGroups].map((name) => `'${name}'`).join(", ")}. Iterating a group no one fills silently disables that system: use the exact name g.world.spawn was called with.`,
      });
    }
  }

  const joinedSource = modules.map((module) => module.source).join("\n");
  if (/\brestart\s*:\s*function\b[\s\S]{0,500}?\bthis\s*\.\s*init\s*\(/i.test(joinedSource)) {
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: "restart_this_init_invalid",
      message: "A restart callback calls this.init(), but the SDK invokes restart as a plain function so this is not the start config. Define a named init/reset function and call it directly from both init and restart.",
    });
  }
  const updatePhaseDrawers = modules.filter((module) => {
    if (module.role !== "system") return false;
    const assignsUpdateHook = /\bG\.(?:update|tick|move|control)[A-Za-z0-9_$]*\s*=\s*function\b/i.test(module.source);
    const assignsDrawHook = /\bG\.(?:draw|render)[A-Za-z0-9_$]*\s*=\s*function\b/i.test(module.source);
    return assignsUpdateHook && !assignsDrawHook && /\bg\s*\.\s*draw\b|\b(?:var|let|const)\s+r\s*=\s*g\s*\.\s*draw\b/.test(module.source);
  });
  if (updatePhaseDrawers.length) {
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: "draw_outside_draw_phase",
      message: `Rendering is performed from an update/input hook in: ${updatePhaseDrawers.map((module) => module.id).join(", ")}. The engine clears the canvas before draw, so expose a draw/render function and call it from the main draw callback.`,
    });
  }
  /*
   * The existing split checks below only fire when a build uses BOTH the SDK
   * counter and a private mirror. A build that uses ONLY the mirror slipped
   * through all of them -- and that is worse, not better.
   *
   * Measured on a shipped game: score, lives and time lived entirely on a
   * private G.state. It scored correctly into that object, so it looked right,
   * while g.state.score stayed 0 for telemetry and the quality probe, and
   * g.state.time -- the clock the SDK advances -- was never read, so the
   * 60-second timeout branch was dead code and the run could never end.
   */
  const privateCounters: Array<{ counter: "score" | "lives"; sdk: RegExp; how: string }> = [
    { counter: "score", sdk: /\bg\s*\.\s*addScore\s*\(|\bg\s*\.\s*state\s*\.\s*score\b/, how: "g.addScore(n, x, y)" },
    { counter: "lives", sdk: /\bg\s*\.\s*loseLife\s*\(|\bg\s*\.\s*state\s*\.\s*lives\b/, how: "g.loseLife(n)" },
  ];
  for (const { counter, sdk, how } of privateCounters) {
    const privateUse = new RegExp(`\\bG\\s*\\.\\s*[A-Za-z_$][\\w$]*\\s*\\.\\s*${counter}\\b`).test(joinedSource);
    if (!privateUse || sdk.test(joinedSource)) continue;
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: `private_${counter}_counter`,
      message: `${counter} is tracked only on a private G object; the build never calls ${how} and never reads g.state.${counter}. The engine owns that counter and reports it, so a private mirror leaves the HUD and the platform's telemetry reading zero no matter how well the game plays. Keep ${counter} on g.state and update it through ${how}.`,
    });
  }
  if (/\bg\s*\.\s*addScore\s*\(/.test(joinedSource) && /\bG\s*\.\s*state\s*\.\s*score\b/.test(joinedSource)) {
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: "score_state_split",
      message: "The SDK updates g.state.score through g.addScore(), but another module reads G.state.score. Use g.state.score as the single score value in collision, HUD and win checks; never mirror it on G.state.",
    });
  }
  if (/\bg\s*\.\s*loseLife\s*\(/.test(joinedSource) && /\bG\s*\.\s*state\s*\.\s*lives\b/.test(joinedSource)) {
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: "lives_state_split",
      message: "The SDK updates g.state.lives through g.loseLife(), but another module reads G.state.lives. Use g.state.lives as the single lives value in collision, HUD and lose checks; never mirror it on G.state.",
    });
  }
  if (/\bg\s*\.\s*state\s*\.\s*time\s*(?:\+\+|--|\+=|-=|=\s*g\s*\.\s*state\s*\.\s*time\s*[+-])/.test(joinedSource)) {
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: "sdk_time_manually_advanced",
      message: "The SDK already advances g.state.time once per frame. Read it for timers and end conditions; remove every manual increment/decrement or the game clock runs at the wrong speed.",
    });
  }
  const advancesSecondaryClock = /\b(?:G(?:\s*\.\s*[A-Za-z_$][A-Za-z0-9_$]*)*|[A-Za-z_$][A-Za-z0-9_$]*)\s*\.\s*(?:time|elapsed|timeLeft|timeRemaining)\s*(?:\+\+|--|\+=\s*dt\b|-=\s*dt\b)/i.test(joinedSource);
  if (/\bg\s*\.\s*state\s*\.\s*time\b/.test(joinedSource) && advancesSecondaryClock) {
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: "time_state_split",
      message: "The SDK already owns g.state.time, but modules also advance a G time/elapsed field. Use g.state.time as the single run clock in spawning, HUD and win checks so a 70-second game lasts 70 seconds.",
    });
  }
  const setsInvincibility = /\.[Ii]nvincible\s*=\s*[^;]*(?:AfterHit|invincib|[1-9]\d*(?:\.\d+)?)/.test(joinedSource);
  const gatesOnInvincibility = /\.[Ii]nvincible\s*>\s*0/.test(joinedSource);
  const expiresInvincibility = /\.[Ii]nvincible\s*(?:-=|=\s*Math\.max\s*\(\s*0\s*,[^;]*-\s*dt)/.test(joinedSource);
  if (setsInvincibility && gatesOnInvincibility && !expiresInvincibility) {
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: "invincibility_never_expires",
      message: "Damage assigns a positive entity invincibility timer and collision checks it, but no update decrements it by dt. Decrement and clamp the same field every frame so later hits and the lose path remain reachable.",
    });
  }
  const kindChecks = Array.from(joinedSource.matchAll(/\.\s*kind\s*={2,3}\s*['"]([A-Za-z0-9_-]+)['"]/g), (match) => match[1]!);
  const usesWorldSpawn = /\bworld\s*\.\s*spawn\s*\(/.test(joinedSource);
  const explicitlyAssignedKinds = new Set([
    ...Array.from(joinedSource.matchAll(/\bkind\s*:\s*['"]([A-Za-z0-9_-]+)['"]/g), (match) => match[1]!),
    ...Array.from(joinedSource.matchAll(/\.\s*kind\s*=\s*['"]([A-Za-z0-9_-]+)['"]/g), (match) => match[1]!),
  ]);
  const mismatchedKinds = usesWorldSpawn
    ? [...new Set(kindChecks.filter((kind) => !explicitlyAssignedKinds.has(kind)))]
    : [];
  if (mismatchedKinds.length) {
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: "entity_discriminator_mismatch",
      message: `g.world.spawn(type, ...) stores the discriminator on entity.type, but collision/update code checks entity.kind for: ${mismatchedKinds.join(", ")}. Read entity.type consistently or explicitly set and use one shared field.`,
    });
  }

  const restartSensitiveName = /(?:timer|cooldown|target|elapsed|accum|spawn|count|phase|wave|combo|streak|invinc)/i;
  const mainSourceForRestartAudit = modules.find((module) => module.role === "main")?.source ?? "";
  const privateRestartState = modules.flatMap((module) => {
    if (module.role !== "system" || /(?:hud|render|draw|audio|fx|effect)/i.test(module.id)) return [];
    const names = Array.from(module.source.matchAll(/^(?:var|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/gm), (match) => match[1]!);
    return names.filter((name) => {
      if (!restartSensitiveName.test(name)) return false;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const writes = module.source.match(new RegExp(`\\b${escaped}\\s*(?:\\+\\+|--|\\+=|-=|\\*=|\\/=|=(?!=))`, "g")) ?? [];
      if (writes.length <= 1) return false;
      const resetters = Array.from(module.source.matchAll(/\bG\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*function\b[^\{]*\{([\s\S]*?)\}\s*;/gi))
        .filter((match) => /(?:reset|clear|init)/i.test(match[1]!));
      const resetByCalledHook = resetters.some((match) => {
        const resetName = match[1]!;
        const body = match[2] ?? "";
        return new RegExp(`\\b${escaped}\\s*=(?!=)`).test(body)
          && new RegExp(`\\bG\\.${resetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`).test(mainSourceForRestartAudit);
      });
      return !resetByCalledHook;
    }).map((name) => `${module.id}.${name}`);
  });
  if (privateRestartState.length) {
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: "restart_state_not_reset",
      message: `Restart-sensitive state is trapped in module closures and survives replay: ${privateRestartState.join(", ")}. Store it on G in a shared state object and reset every field from init/restart so a new run starts cleanly.`,
    });
  }

  const sharedRestartState = modules.flatMap((module) => {
    if (module.role !== "system" || /(?:hud|render|draw|audio|fx|effect)/i.test(module.id)) return [];
    const names = Array.from(module.source.matchAll(/^\s*G\.([A-Za-z_$][A-Za-z0-9_$]*State)\s*=/gmi), (match) => match[1]!);
    return names.filter((name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const nestedWrites = module.source.match(new RegExp(`\\bG\\.${escaped}\\.[A-Za-z_$][A-Za-z0-9_$]*\\s*(?:\\+\\+|--|\\+=|-=|\\*=|\\/=|=(?!=))`, "g")) ?? [];
      if (!nestedWrites.length) return false;
      if (new RegExp(`\\bG\\.${escaped}\\s*=(?!=)`).test(mainSourceForRestartAudit)) return false;
      const resetters = Array.from(module.source.matchAll(/\bG\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*function\b[^\{]*\{([\s\S]*?)\}\s*;/gi))
        .filter((match) => /(?:reset|clear|init)/i.test(match[1]!));
      return !resetters.some((match) => {
        const resetName = match[1]!;
        const body = match[2] ?? "";
        return new RegExp(`\\bG\\.${escaped}(?:\\s*=|\\.[A-Za-z_$][A-Za-z0-9_$]*\\s*=)`).test(body)
          && new RegExp(`\\bG\\.${resetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`).test(mainSourceForRestartAudit);
      });
    }).map((name) => `${module.id}.G.${name}`);
  });
  if (sharedRestartState.length) {
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: "restart_shared_state_not_reset",
      message: `Restart-sensitive shared state is initialized only when its module loads and survives replay: ${sharedRestartState.join(", ")}. Recreate it from init/restart or call an explicit reset hook on every run.`,
    });
  }

  const { ordered, findings: orderFindings } = orderModules(modules);
  findings.push(...orderFindings);

  const configModule = ordered.find((m) => m.role === "config") ?? null;
  const mainModule = ordered.find((m) => m.role === "main") ?? null;
  if (!mainModule) {
    findings.push({ severity: "blocker", moduleId: "assembled", code: "main_missing", message: "no module has role 'main'; nothing calls g.start()" });
  }
  if (!/\bG\s*\.\s*main\s*=/.test(mainModule?.source ?? "")) {
    findings.push({ severity: "blocker", moduleId: mainModule?.id ?? "assembled", code: "main_unassigned", message: "the main module must assign G.main = function (g) { ... g.start({...}) }" });
  }

  const declarations = ordered
    .map((m) => `  function ${fnName(m.id)}(G${m.role === "config" ? "" : ", g"}) {\n${indent(m.source)}\n  }`)
    .join("\n\n");

  const stage = design.stage;
  const chinese = /[\u3400-\u9fff]/u.test(design.title);
  // Every non-config module body must run so its assignments land on G. The
  // main module is included here: its body is what assigns G.main, which the
  // entry point then invokes.
  const calls = ordered
    .filter((m) => m.role !== "config")
    .map((m) => `    ${fnName(m.id)}(G, g);`)
    .join("\n");

  const source = `function mountGame(root, ctx) {
  var G = { ctx: ctx, design: ${JSON.stringify({ title: design.title, genre: design.genre, winCondition: design.progression.winCondition })} };

${declarations}

  try {
    ${configModule ? `${fnName(configModule.id)}(G);` : "G.config = {};"}
    var cfg = G.config || {};
    var g = GameForge.create(root, {
      width: cfg.width || ${stage.width},
      height: cfg.height || ${stage.height},
      background: cfg.background || ${JSON.stringify(stage.background)},
      title: ctx.title,
      lives: cfg.lives == null ? 3 : cfg.lives,
      seed: cfg.seed || 1337,
      fit: cfg.fit || 'contain',
      music: ctx.assets && ctx.assets.music,
      winTitle: cfg.winTitle || ${JSON.stringify(chinese ? "挑战成功" : "You win")},
      loseTitle: cfg.loseTitle || ${JSON.stringify(chinese ? "挑战结束" : "Game over")},
      replayText: cfg.replayText || ${JSON.stringify(chinese ? "再玩一次" : "Play again")},
      scoreLabel: cfg.scoreLabel || ${JSON.stringify(chinese ? "得分" : "Score")},
      onFinish: ctx.finish
    });
    G.g = g;
${calls}
    if (typeof G.main !== 'function') throw new Error('game_main_missing');
    G.main(g);
  } catch (error) {
    if (typeof ctx.reportError === 'function') ctx.reportError(error);
    throw error;
  }
}`;

  // One invalid module takes down the whole script block in the browser, so
  // the assembled program is verified as a unit too.
  try {
    new Function(`${source}
return typeof mountGame;`);
  } catch (e) {
    findings.push({
      severity: "blocker",
      moduleId: "assembled",
      code: "assembled_syntax_error",
      message: `the assembled runtime is not valid JavaScript: ${(e as Error).message}`,
    });
  }

  return { source, findings };
}

function indent(source: string): string {
  return source
    .split("\n")
    .map((line) => (line.trim() ? `    ${line}` : line))
    .join("\n");
}

/**
 * Deterministic SDK-surface audit.
 *
 * Lives here (not in qa-agent.ts) so `code-agent.ts` can call it during its
 * own repair-attempt loop without a circular import — a module that still
 * hallucinates an SDK member must never be accepted as "fixed" just because
 * the narrower forbidden-pattern/balance checks passed.
 */

/** Members the generated code reads off an SDK object, mapped to their table. */
const ACCESSOR_PATTERNS: Array<{ table: keyof typeof SDK_SURFACE; re: RegExp }> = [
  { table: "input", re: /\bg\s*\.\s*input\s*\.\s*([A-Za-z_$][\w$]*)/g },
  { table: "audio", re: /\bg\s*\.\s*audio\s*\.\s*([A-Za-z_$][\w$]*)/g },
  { table: "assets", re: /\bg\s*\.\s*assets\s*\.\s*([A-Za-z_$][\w$]*)/g },
  { table: "fx", re: /\bg\s*\.\s*fx\s*\.\s*([A-Za-z_$][\w$]*)/g },
  { table: "ui", re: /\bg\s*\.\s*ui\s*\.\s*([A-Za-z_$][\w$]*)/g },
  { table: "world", re: /\bg\s*\.\s*world\s*\.\s*([A-Za-z_$][\w$]*)/g },
  { table: "state", re: /\bg\s*\.\s*state\s*\.\s*([A-Za-z_$][\w$]*)/g },
  { table: "rng", re: /\bg\s*\.\s*rng\s*\.\s*([A-Za-z_$][\w$]*)/g },
  { table: "stage", re: /\bg\s*\.\s*stage\s*\.\s*([A-Za-z_$][\w$]*)/g },
  { table: "camera", re: /\b[gr]\s*\.\s*camera\s*\.\s*([A-Za-z_$][\w$]*)/g },
  { table: "r", re: /\bg\s*\.\s*r\s*\.\s*([A-Za-z_$][\w$]*)/g },
  { table: "draw", re: /\bg\s*\.\s*draw\s*\.\s*([A-Za-z_$][\w$]*)/g },
];

/**
 * `var r = g.draw;` — a subsystem parked in a local.
 *
 * Every pattern above anchors on `g.`, so an aliased subsystem escapes all of
 * them. Observed in a real build: `const r = g.draw;` followed by
 * `r.ellipse(...)`. `ellipse` is not a renderer member, the deterministic
 * audit reported zero findings, and the game threw before its first frame.
 * Resolving the alias is what lets that be caught while the module is still
 * being generated — where the agent simply retries — instead of by the probe
 * two repair rounds later.
 */
const SUBSYSTEM_ALIAS_RE = /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*g\s*\.\s*([A-Za-z_$][\w$]*)\s*[;,\n]/g;

/**
 * Flags SDK members that do not exist. A hallucinated method is the single
 * most common way a generated game dies on its first frame.
 */
export function auditSdkUsage(moduleId: string, source: string): QaFinding[] {
  const code = stripCommentsAndStrings(source);
  const findings: QaFinding[] = [];
  const seen = new Set<string>();

  const report = (table: string, name: string) => {
    const key = `${table}.${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    // The single most common way this triggers: a module needs shared state
    // and reaches for the engine handle instead of the shared namespace. Say
    // the fix, not just the violation, so a repair round has less to guess.
    const fixHint = table === "g" ? ` — private module state belongs in a top-level "var" inside your module body; state shared across modules belongs on G.${name}, never on g.${name}` : "";
    findings.push({
      severity: "blocker",
      moduleId,
      code: "unknown_sdk_member",
      message: `${key} does not exist in the SDK; valid members are ${(SDK_SURFACE[table] ?? []).slice(0, 14).join(", ")}${fixHint}`,
    });
  };

  for (const { table, re } of ACCESSOR_PATTERNS) {
    const allowed = SDK_SURFACE[table] ?? [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null = re.exec(code);
    while (m) {
      const name = m[1]!;
      if (!allowed.includes(name)) report(String(table), name);
      m = re.exec(code);
    }
  }

  // Aliased subsystems, checked against the table they actually point at.
  SUBSYSTEM_ALIAS_RE.lastIndex = 0;
  let alias: RegExpExecArray | null = SUBSYSTEM_ALIAS_RE.exec(code);
  while (alias) {
    const local = alias[1]!;
    const namespace = alias[2]!;
    const allowed = SDK_SURFACE[namespace];
    // Only real subsystems matter; `var x = g.width` is a value, not a table.
    if (allowed && local !== "g") {
      const memberRe = new RegExp(`\\b${local}\\s*\\.\\s*([A-Za-z_$][\\w$]*)`, "g");
      let member: RegExpExecArray | null = memberRe.exec(code);
      while (member) {
        const name = member[1]!;
        if (!allowed.includes(name)) report(namespace, name);
        member = memberRe.exec(code);
      }
    }
    alias = SUBSYSTEM_ALIAS_RE.exec(code);
  }

  // Direct members on the engine handle, excluding the namespaces above.
  const gRe = /\bg\s*\.\s*([A-Za-z_$][\w$]*)/g;
  let gm: RegExpExecArray | null = gRe.exec(code);
  while (gm) {
    const name = gm[1]!;
    if (!SDK_SURFACE.g!.includes(name)) report("g", name);
    gm = gRe.exec(code);
  }

  // Sound cue names live in string literals, so this check needs comments
  // stripped but strings kept — the executable-code view has erased them.
  const literals = stripComments(source);
  const sfxRe = /\baudio\s*\.\s*sfx\s*\(\s*['"]([\w-]+)['"]\s*\)/g;
  let sm: RegExpExecArray | null = sfxRe.exec(literals);
  while (sm) {
    const name = sm[1]!;
    // A resolvable synonym is not a defect: the runtime plays the right cue.
    if (!resolveSfxName(name)) {
      findings.push({ severity: "minor", moduleId, code: "unknown_sfx", message: `sfx '${name}' is not in the SDK library; it will fall back to a generic blip. Use one of ${SDK_SFX_NAMES.join(", ")}` });
    }
    sm = sfxRe.exec(literals);
  }

  return findings;
}
