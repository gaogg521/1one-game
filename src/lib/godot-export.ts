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
import { godotRuntimeAvailable, repoRoot, runGodot } from "@/lib/godot-run";

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
  | { ok: false; errorKey?: string; errorParams?: Record<string, string>; error?: string; code: "unsupported" | "godot_missing" | "export_failed" };

export async function exportGameSpecToGodotWeb(params: {
  spec: GameSpec;
  projectId?: string;
  promptHint?: string;
  referencePayloads?: RuntimeReferencePayload[];
}): Promise<GodotExportResult> {
  if (!PRODUCT.godot.enabled) {
    return { ok: false, errorKey: "godotExportDisabled", code: "export_failed" };
  }
  if (!isGodotExportSupported(params.spec)) {
    return {
      ok: false,
      errorKey: "godotUnsupportedTemplate",
      errorParams: { templateId: params.spec.templateId },
      code: "unsupported",
    };
  }

  if (!(await godotRuntimeAvailable())) {
    return {
      ok: false,
      errorKey: "godotNotInstalled",
      code: "godot_missing",
    };
  }

  const prepared = await prepareGodotWorkspace(params);
  const { exportId, spec, specHash, workRoot, referenceSummary } = prepared;
  if (!workRoot || typeof workRoot !== "string") {
    return { ok: false, errorKey: "godotWorkspaceInvalid", code: "export_failed" };
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
      if (msg.includes("path") && msg.includes("undefined")) {
        return { ok: false, errorKey: "godotBuildQueueConflict", code: "export_failed" };
      }
      if (msg.includes("EEXIST") && msg.includes(".godot")) {
        return { ok: false, errorKey: "godotWorkspaceConflict", code: "export_failed" };
      }
      return { ok: false, error: msg.slice(0, 500), code: "export_failed" };
    }
  });
}
