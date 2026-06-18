import fs from "node:fs";
import path from "node:path";
import {
  parseAgenticModule,
  validateAgenticSource,
  type AgenticGameModule,
} from "@/lib/agentic/game-module";

export type OpenGameCliBridgeResult =
  | {
      ok: true;
      module: AgenticGameModule;
      entry: string;
      files: string[];
      strategy: "create_game" | "merged_create_game" | "phaser_scene";
    }
  | { ok: false; reason: string; files: string[] };

const SKIP_DIR = new Set(["node_modules", "dist", "build", ".git", ".next", "coverage"]);
const FILE_PRIORITY = [
  "game.js",
  "main.js",
  "src/game.js",
  "src/main.js",
  "src/game/main.js",
  "js/game.js",
  "js/main.js",
];

export function isOpenGameCliBridgeEnabled(): boolean {
  return process.env.OPENGAME_CLI_BRIDGE === "1";
}

function stripModuleSyntax(source: string): string {
  return source
    .replace(/^\s*import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^\s*export\s+default\s+/gm, "")
    .replace(/^\s*export\s+\{[^}]+\};?\s*$/gm, "")
    .replace(/^\s*export\s+/gm, "")
    .replace(/module\.exports\s*=\s*/g, "")
    .trim();
}

function hasCreateGame(source: string): boolean {
  return /(?:function|const|let|var)\s+createGame\s*[=(]/.test(source);
}

function extractEntryName(source: string): string {
  if (/function\s+createGame\s*\(/.test(source)) return "createGame";
  if (/const\s+createGame\s*=/.test(source)) return "createGame";
  return "createGame";
}

function extractBalancedBlock(source: string, openBraceIdx: number): string | null {
  let depth = 0;
  for (let i = openBraceIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openBraceIdx + 1, i);
    }
  }
  return null;
}

function extractMethodBody(source: string, methodName: string): string | null {
  const re = new RegExp(`\\b${methodName}\\s*\\([^)]*\\)\\s*\\{`);
  const m = re.exec(source);
  if (!m || m.index === undefined) return null;
  const braceIdx = source.indexOf("{", m.index);
  if (braceIdx < 0) return null;
  return extractBalancedBlock(source, braceIdx);
}

function findSceneClassSource(source: string): { className: string; classSource: string } | null {
  const re = /class\s+(\w+)\s+extends\s+(?:Phaser\.)?Scene\s*\{/g;
  const m = re.exec(source);
  if (!m || m.index === undefined) return null;
  const className = m[1]!;
  const braceIdx = source.indexOf("{", m.index);
  const body = braceIdx >= 0 ? extractBalancedBlock(source, braceIdx) : null;
  if (!body) return null;
  return { className, classSource: `class ${className} extends Phaser.Scene {\n${body}\n}` };
}

function remapSceneThisToHost(body: string): string {
  return body
    .replace(/\bthis\./g, "scene.")
    .replace(/\bthis\b/g, "scene")
    .replace(/scene\.scale\.width/g, "ctx.width")
    .replace(/scene\.scale\.height/g, "ctx.height");
}

/** OpenGame 常见产物：Phaser.Scene 子类 → Operone createGame 工厂 */
export function wrapPhaserSceneAsCreateGame(classSource: string): string | null {
  const createBody = extractMethodBody(classSource, "create");
  if (!createBody) return null;
  const updateBody = extractMethodBody(classSource, "update");
  const create = remapSceneThisToHost(createBody.trim());
  const update = updateBody ? remapSceneThisToHost(updateBody.trim()) : null;
  const declaresW = /\b(?:const|let|var)\s+w\s*=/.test(create);
  const declaresH = /\b(?:const|let|var)\s+h\s*=/.test(create);
  const prelude =
    declaresW || declaresH ? "" : "const w = ctx.width, h = ctx.height;";
  const hasPlayfield = /scene\.add\.(rectangle|sprite|image|graphics|circle|star)/.test(create);
  const hasHud = /scene\.add\.text/.test(create);
  const playfield = hasPlayfield
    ? ""
    : "scene.add.rectangle(w/2,h/2,w,h, Phaser.Display.Color.HexStringToColor(ctx.colors.background).color);";
  const hud = hasHud
    ? ""
    : "const __bridgeHud = scene.add.text(16, 12, 'Score: 0', { fontSize: '18px', color: '#fff' }); let __bridgeScore = 0;";
  const scoreHook = hasHud
    ? ""
    : "scene.input.on('pointerdown', () => { __bridgeScore += 5; ctx.onScore(5); __bridgeHud.setText('Score: '+__bridgeScore); if (__bridgeScore >= (ctx.winScore||50)) ctx.onEnd(true); });";
  const scoreWinHook = /scene\.score/.test(create)
    ? "scene.events.on('update', () => { if ((scene.score||0) >= (ctx.winScore||50)) ctx.onEnd(true); });"
    : "";

  return `function createGame(ctx, Phaser) {
  return {
    create(scene) {
      ${prelude}
      ${playfield}
      ${hud}
      ${create}
      ${scoreHook}
      ${scoreWinHook}
    }${update ? `,\n    update(scene, time, delta) {\n      ${update}\n    }` : ""}
  };
}`;
}

function finalizeBridgeModule(
  source: string,
  files: string[],
  strategy: "create_game" | "merged_create_game" | "phaser_scene",
): OpenGameCliBridgeResult {
  const entry = extractEntryName(source);
  const mod = parseAgenticModule({ version: 1, source, entry });
  if (!mod) return { ok: false, reason: "agentic_parse_failed", files };
  const forbidden = validateAgenticSource(mod.source);
  if (!forbidden.ok) return { ok: false, reason: forbidden.reason, files };
  if (mod.source.length > 48_000) return { ok: false, reason: "too_large", files };
  return { ok: true, module: mod, entry, files, strategy };
}

function listJsFiles(dir: string, depth = 0, acc: string[] = []): string[] {
  if (depth > 5 || !fs.existsSync(dir)) return acc;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    if (SKIP_DIR.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      listJsFiles(full, depth + 1, acc);
    } else if (/\.(?:js|mjs|cjs)$/i.test(ent.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function scoreCandidate(relPath: string, source: string): number {
  const base = path.basename(relPath).toLowerCase();
  let score = 0;
  const prioIdx = FILE_PRIORITY.findIndex((p) => relPath.replace(/\\/g, "/").endsWith(p));
  if (prioIdx >= 0) score += 100 - prioIdx;
  if (hasCreateGame(source)) score += 200;
  if (/Phaser\.Game\s*\(/.test(source)) score += 20;
  if (/extends\s+(?:Phaser\.)?Scene/.test(source)) score += 10;
  if (base.includes("game")) score += 5;
  return score;
}

/** 合并 workDir 内 JS（去 import），供 createGame 跨文件引用 */
export function mergeOpenGameCliSources(workDir: string): { merged: string; files: string[] } {
  const absFiles = listJsFiles(workDir);
  const relFiles = absFiles.map((f) => path.relative(workDir, f).replace(/\\/g, "/"));
  const scored = absFiles
    .map((abs, i) => {
      try {
        const src = fs.readFileSync(abs, "utf8");
        return { abs, rel: relFiles[i]!, src, score: scoreCandidate(relFiles[i]!, src) };
      } catch {
        return null;
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    return { merged: "", files: [] };
  }

  const parts: string[] = [];
  const used: string[] = [];
  const helpers = scored.filter((s) => !hasCreateGame(s.src)).sort((a, b) => a.rel.localeCompare(b.rel));
  const entries = scored.filter((s) => hasCreateGame(s.src)).sort((a, b) => b.score - a.score);
  const ordered = [...helpers, ...entries];
  for (const item of ordered) {
    const stripped = stripModuleSyntax(item.src);
    if (!stripped) continue;
    parts.push(`/* ${item.rel} */\n${stripped}`);
    used.push(item.rel);
  }

  return { merged: parts.join("\n\n"), files: used };
}

/** 将 OpenGame CLI workDir 内 JS 产物桥接为 Operone 单文件 Agentic 模块 */
export function bridgeOpenGameCliWorkDir(workDir: string): OpenGameCliBridgeResult {
  if (!fs.existsSync(workDir)) {
    return { ok: false, reason: "workdir_missing", files: [] };
  }

  const { merged, files } = mergeOpenGameCliSources(workDir);
  if (!merged) {
    return { ok: false, reason: "no_js_artifacts", files: [] };
  }

  if (!hasCreateGame(merged)) {
    const sceneClass = findSceneClassSource(merged);
    if (sceneClass) {
      const wrapped = wrapPhaserSceneAsCreateGame(sceneClass.classSource);
      if (!wrapped) return { ok: false, reason: "phaser_scene_wrap_failed", files };
      return finalizeBridgeModule(wrapped, files, "phaser_scene");
    }
    return { ok: false, reason: "create_game_not_found", files };
  }

  const entry = extractEntryName(merged);
  return finalizeBridgeModule(merged, files, files.length > 1 ? "merged_create_game" : "create_game");
}
