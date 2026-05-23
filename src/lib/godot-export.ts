import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { GameSpec } from "@/lib/game-spec";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import { PRODUCT } from "@/lib/product-config";
import { isGodotExportSupported } from "@/lib/godot-spec-bridge-codegen";
import { withGodotWebExportLock } from "@/lib/godot-export-lock";
import type { GodotReferenceBuildSummary } from "@/lib/godot-export-refs";
import { clearGodotDotCache, prepareGodotWorkspace } from "@/lib/godot-export-workspace";

const execFileAsync = promisify(execFile);

export type GodotExportResult =
  | {
      ok: true;
      buildUrl: string;
      exportId: string;
      cached: boolean;
      templateId: GameSpec["templateId"];
      referenceSummary: GodotReferenceBuildSummary;
    }
  | { ok: false; error: string; code: "unsupported" | "godot_missing" | "export_failed" };

function repoRoot(): string {
  return process.cwd();
}

function godotBinPath(): string {
  const root = repoRoot();
  if (process.env.GODOT_BIN) return process.env.GODOT_BIN;
  if (process.platform === "win32") {
    return path.join(root, "tools", "godot", "Godot_v4.4.1-stable_win64_console.exe");
  }
  if (process.platform === "darwin") {
    return path.join(root, "tools", "godot", "Godot.app", "Contents", "MacOS", "Godot");
  }
  return path.join(root, "tools", "godot", "Godot_v4.4.1-stable_linux.x86_64");
}

async function godotExists(bin: string): Promise<boolean> {
  try {
    await fs.access(bin);
    return true;
  } catch {
    return false;
  }
}

async function runGodot(args: string[], cwd: string, timeoutMs: number): Promise<void> {
  const bin = godotBinPath();
  await execFileAsync(bin, args, {
    cwd,
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
}

export async function exportGameSpecToGodotWeb(params: {
  spec: GameSpec;
  projectId?: string;
  promptHint?: string;
  referencePayloads?: RuntimeReferencePayload[];
}): Promise<GodotExportResult> {
  if (!PRODUCT.godot.enabled) {
    return { ok: false, error: "Godot 导出未启用", code: "export_failed" };
  }
  if (!isGodotExportSupported(params.spec)) {
    return {
      ok: false,
      error: `模板 ${params.spec.templateId} 不在 Godot 支持列表中`,
      code: "unsupported",
    };
  }

  const bin = godotBinPath();
  if (!(await godotExists(bin))) {
    return {
      ok: false,
      error: "未找到 Godot 可执行文件，请运行 npm run godot:install",
      code: "godot_missing",
    };
  }

  const prepared = await prepareGodotWorkspace(params);
  const { exportId, spec, specHash, workRoot, referenceSummary } = prepared;
  if (!workRoot || typeof workRoot !== "string") {
    return { ok: false, error: "Godot 工程路径无效", code: "export_failed" };
  }

  return withGodotWebExportLock(exportId, async () => {
    const publicOut = path.join(repoRoot(), "public", "godot-builds", exportId);
    const indexHtml = path.join(publicOut, "index.html");
    const metaPath = path.join(publicOut, ".spec-hash.json");

    try {
      const [metaRaw] = await Promise.all([
        fs.readFile(metaPath, "utf8").catch(() => null),
        fs.access(indexHtml),
      ]);
      if (metaRaw) {
        const meta = JSON.parse(metaRaw) as {
          specHash?: string;
          referenceSummary?: GodotReferenceBuildSummary;
        };
        if (meta.specHash === specHash) {
          const cacheRef = meta.referenceSummary?.imageCount ?? 0;
          const currRef = referenceSummary.imageCount ?? 0;
          if (cacheRef !== currRef) {
            console.info(`[godot-export] 参考资产数量变化 ${cacheRef}→${currRef}，重建 ${exportId}`);
            await fs.rm(publicOut, { recursive: true, force: true });
          } else {
            return {
              ok: true,
              buildUrl: `/godot-builds/${exportId}/index.html`,
              exportId,
              cached: true,
              templateId: spec.templateId,
              referenceSummary: meta.referenceSummary ?? referenceSummary,
            };
          }
        }
      }
    } catch {
      /* 需要导出 */
    }

    try {
      await fs.mkdir(publicOut, { recursive: true });
      await clearGodotDotCache(workRoot);

      const importMs = PRODUCT.godot.importTimeoutMs;
      const exportMs = PRODUCT.godot.exportTimeoutMs;

      await runGodot(["--headless", "--path", workRoot, "--import"], workRoot, importMs);
      await runGodot(
        ["--headless", "--path", workRoot, "--export-release", "Web", indexHtml],
        workRoot,
        exportMs,
      );

      await fs.access(indexHtml);
      await fs.writeFile(
        metaPath,
        JSON.stringify({
          specHash,
          templateId: spec.templateId,
          referenceSummary,
          at: new Date().toISOString(),
        }),
        "utf8",
      );
      return {
        ok: true,
        buildUrl: `/godot-builds/${exportId}/index.html`,
        exportId,
        cached: false,
        templateId: spec.templateId,
        referenceSummary,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const friendly = msg.includes("path") && msg.includes("undefined")
        ? "Godot 构建队列冲突，请稍等几秒后点重试"
        : msg.includes("EEXIST") && msg.includes(".godot")
          ? "Godot 工程目录冲突（可能正在并行构建），请稍等几秒后点重试"
          : msg.slice(0, 500);
      return { ok: false, error: friendly, code: "export_failed" };
    }
  });
}
