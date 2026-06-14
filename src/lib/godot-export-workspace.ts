import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { GameSpec } from "@/lib/game-spec";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import {
  readAiSpritesAsReferencePayloads,
  summarizeGodotReferenceManifest,
  writeGodotReferenceAssets,
  adjustAiSpritePurposesForTemplate,
  type GodotReferenceBuildSummary,
} from "@/lib/godot-export-refs";
import { prepareSpecForGodotExport } from "@/lib/godot-export-spec";
import { specJsonForGodotExport } from "@/lib/game-templates/runtime";
import { referencePayloadsDigest } from "@/lib/reference-payloads-digest";
import { safeJsonStringify } from "@/lib/safe-json";
import { withGodotPrepareLock } from "@/lib/godot-export-lock";
import {
  GODOT_BRIDGE_REL,
  GODOT_MOTHER_UNIVERSAL_DIR,
  GODOT_SPEC_JSON_REL,
  godotExportCacheKey,
  patchGameSpecBridgeGdSource,
} from "@/lib/godot-spec-bridge-codegen";
import { ensureGodotUiFont } from "@/lib/godot-ui-font";

/** 母版 GDScript 变更时递增，使旧 Web 构建缓存失效 */
const GODOT_RUNTIME_BUILD_REV = "20260612-strategy-3d-theme";

export type PreparedGodotWorkspace = {
  exportId: string;
  spec: GameSpec;
  specHash: string;
  workRoot: string;
  referenceSummary: GodotReferenceBuildSummary;
};

function repoRoot(): string {
  return process.cwd();
}

/** Godot 缓存目录；并发或半成品工程时先清掉再 --import */
export async function clearGodotDotCache(workRoot: string): Promise<void> {
  const dot = path.join(workRoot, ".godot");
  try {
    const st = await fs.stat(dot);
    if (st.isDirectory()) {
      await fs.rm(dot, { recursive: true, force: true });
    } else {
      await fs.unlink(dot);
    }
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw e;
  }
}

/** 射击运行时曾存在 _is_rapid_fire ↔ _player_fire_interval 互调导致栈溢出 */
async function assertShooterRuntimeSafe(workRoot: string): Promise<void> {
  const shooterGd = path.join(workRoot, "scripts/runtimes/shooter_runtime.gd");
  try {
    const src = await fs.readFile(shooterGd, "utf8");
    if (src.includes("_player_fire_interval() <= 0.13")) {
      throw new Error(
        "shooter_runtime.gd 含无限递归写法（_is_rapid_fire 调用 _player_fire_interval），请更新母版后重试",
      );
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
    throw e;
  }
}

async function copyMotherTemplate(dest: string): Promise<void> {
  const src = path.join(repoRoot(), GODOT_MOTHER_UNIVERSAL_DIR);
  await clearGodotDotCache(dest);
  await fs.mkdir(dest, { recursive: true });
  await fs.cp(src, dest, {
    recursive: true,
    force: true,
    filter: (srcPath) => {
      const n = srcPath.replace(/\\/g, "/");
      return !n.includes("/.godot/");
    },
  });
}

/** 按 GameSpec 生成可导出 / 可打包的 Godot 工程目录 */
export async function prepareGodotWorkspace(params: {
  spec: GameSpec;
  projectId?: string;
  promptHint?: string;
  referencePayloads?: RuntimeReferencePayload[];
  forceRefresh?: boolean;
}): Promise<PreparedGodotWorkspace> {
  const spec = prepareSpecForGodotExport(params.spec, params.promptHint);
  const refDigest = referencePayloadsDigest(params.referencePayloads);
  const exportId = godotExportCacheKey(spec, params.projectId, refDigest);

  return withGodotPrepareLock(exportId, async () => {
    // 读取 AI sprites 状态并纳入 specHash，确保精灵生成后缓存能失效
    const aiSpriteStateParts: string[] = [];
    if (params.projectId) {
      const spriteDir = path.join(repoRoot(), "public", "game-sprites", params.projectId);
      for (const kind of ["player", "hazard", "gem", "power", "boss"]) {
        try {
          const stats = await fs.stat(path.join(spriteDir, `${kind}.png`));
          aiSpriteStateParts.push(`${kind}:${stats.size}`);
        } catch {
          aiSpriteStateParts.push(`${kind}:none`);
        }
      }
    }
    const aiSpriteState = aiSpriteStateParts.join(",");

    const specHash = createHash("sha256")
      .update(safeJsonStringify({ spec, rev: GODOT_RUNTIME_BUILD_REV, refDigest, aiSpriteState }))
      .digest("hex");
    const workRoot = path.join(repoRoot(), "workspaces", "godot-exports", exportId);
    const metaPath = path.join(workRoot, ".1one-spec-hash.json");

    if (!params.forceRefresh) {
      try {
        const raw = await fs.readFile(metaPath, "utf8");
        const meta = JSON.parse(raw) as { specHash?: string; referenceSummary?: unknown };
        if (meta.specHash === specHash) {
          await fs.access(path.join(workRoot, "project.godot"));
          const refSummary =
            typeof meta.referenceSummary === "object" && meta.referenceSummary !== null
              ? (meta.referenceSummary as GodotReferenceBuildSummary)
              : summarizeGodotReferenceManifest(null);
          return { exportId, spec, specHash, workRoot, referenceSummary: refSummary };
        }
      } catch {
        /* rebuild */
      }
    }

    await ensureGodotUiFont(repoRoot());
    await fs.rm(workRoot, { recursive: true, force: true });
    await copyMotherTemplate(workRoot);

    const bridgePath = path.join(workRoot, GODOT_BRIDGE_REL);
    const specJsonPath = path.join(workRoot, GODOT_SPEC_JSON_REL);
    const bridgeSrc = await fs.readFile(bridgePath, "utf8");
    await fs.writeFile(bridgePath, patchGameSpecBridgeGdSource(bridgeSrc, spec), "utf8");
    await fs.mkdir(path.dirname(specJsonPath), { recursive: true });
    await fs.writeFile(specJsonPath, JSON.stringify(specJsonForGodotExport(spec), null, 2), "utf8");
    const aiSprites = params.projectId
      ? await readAiSpritesAsReferencePayloads(params.projectId, process.cwd())
      : [];
    const adjustedSprites = adjustAiSpritePurposesForTemplate(aiSprites, spec.templateId);
    const allPayloads = [...(params.referencePayloads ?? []), ...adjustedSprites];
    const manifest = await writeGodotReferenceAssets(workRoot, allPayloads);
    const referenceSummary = summarizeGodotReferenceManifest(manifest);
    await assertShooterRuntimeSafe(workRoot);
    await fs.writeFile(
      metaPath,
      JSON.stringify({ specHash, referenceSummary, at: new Date().toISOString() }),
      "utf8",
    );

    return { exportId, spec, specHash, workRoot, referenceSummary };
  });
}

export async function zipDirectoryToBuffer(
  rootDir: string,
  opts?: { excludeDotGodot?: boolean },
): Promise<Buffer> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const excludeGodot = opts?.excludeDotGodot !== false;

  async function walk(rel: string, abs: string): Promise<void> {
    const entries = await fs.readdir(abs, { withFileTypes: true });
    for (const ent of entries) {
      if (excludeGodot && ent.name === ".godot") continue;
      const relPath = rel ? `${rel}/${ent.name}` : ent.name;
      const absPath = path.join(abs, ent.name);
      if (ent.isDirectory()) {
        await walk(relPath, absPath);
      } else {
        zip.file(relPath, await fs.readFile(absPath));
      }
    }
  }

  await walk("", rootDir);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export function artifactDir(exportId: string): string {
  return path.join(repoRoot(), "public", "godot-artifacts", exportId);
}

export async function writeArtifactZip(exportId: string, kind: string, data: Buffer): Promise<string> {
  const dir = artifactDir(exportId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${kind}.zip`);
  await fs.writeFile(filePath, data);
  return filePath;
}

export function artifactPublicUrl(exportId: string, kind: string): string {
  return `/godot-artifacts/${exportId}/${kind}.zip`;
}
