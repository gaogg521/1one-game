import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { GameSpec } from "@/lib/game-spec";
import type { RuntimeReferencePayload } from "@/game/engine/runtime-reference-payload";
import { PRODUCT } from "@/lib/product-config";
import { isGodotExportSupported } from "@/lib/godot-spec-bridge-codegen";
import {
  artifactPublicUrl,
  prepareGodotWorkspace,
  writeArtifactZip,
  zipDirectoryToBuffer,
} from "@/lib/godot-export-workspace";

const execFileAsync = promisify(execFile);

export type GodotExportTarget = "web" | "windows" | "project" | "android";

export type GodotPlatformExportResult =
  | {
      ok: true;
      exportId: string;
      templateId: GameSpec["templateId"];
      cached: boolean;
      buildUrl?: string;
      downloadUrl?: string;
    }
  | { ok: false; error: string; code: "unsupported" | "godot_missing" | "export_failed" | "platform_unavailable" };

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
    maxBuffer: 16 * 1024 * 1024,
  });
}

function safeExeBase(title: string): string {
  const t = title.replace(/[^\w\u4e00-\u9fa5-]+/g, "_").slice(0, 32) || "game";
  return `${t}.exe`;
}

/** 打包已 patch 的 Godot 工程（任意平台可下载后用编辑器打开） */
export async function exportGodotProjectZip(params: {
  spec: GameSpec;
  projectId?: string;
  referencePayloads?: RuntimeReferencePayload[];
}): Promise<GodotPlatformExportResult> {
  if (!isGodotExportSupported(params.spec)) {
    return { ok: false, error: "模板不支持 Godot", code: "unsupported" };
  }
  try {
    const { exportId, spec, workRoot } = await prepareGodotWorkspace(params);
    const artifactPath = path.join(repoRoot(), "public", "godot-artifacts", exportId, "project.zip");
    try {
      await fs.access(artifactPath);
      return {
        ok: true,
        exportId,
        templateId: spec.templateId,
        cached: true,
        downloadUrl: artifactPublicUrl(exportId, "project"),
      };
    } catch {
      /* build */
    }
    const buf = await zipDirectoryToBuffer(workRoot, { excludeDotGodot: true });
    await writeArtifactZip(exportId, "project", buf);
    return {
      ok: true,
      exportId,
      templateId: spec.templateId,
      cached: false,
      downloadUrl: artifactPublicUrl(exportId, "project"),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.slice(0, 500), code: "export_failed" };
  }
}

/** Windows PC 可执行包（需在 Windows 上跑 headless 导出） */
export async function exportGodotWindowsDesktop(params: {
  spec: GameSpec;
  projectId?: string;
  referencePayloads?: RuntimeReferencePayload[];
}): Promise<GodotPlatformExportResult> {
  if (!isGodotExportSupported(params.spec)) {
    return { ok: false, error: "模板不支持 Godot", code: "unsupported" };
  }
  if (process.platform !== "win32") {
    return {
      ok: false,
      error: "Windows 可执行包需在 Windows 本机或 Windows 构建机导出，请先下载 Godot 工程 zip 在本地用 Godot 导出",
      code: "platform_unavailable",
    };
  }

  const bin = godotBinPath();
  if (!(await godotExists(bin))) {
    return {
      ok: false,
      error: "未找到 Godot，请运行 npm run godot:install",
      code: "godot_missing",
    };
  }

  try {
    const { exportId, spec, workRoot } = await prepareGodotWorkspace(params);
    const artifactPath = path.join(repoRoot(), "public", "godot-artifacts", exportId, "windows.zip");
    try {
      await fs.access(artifactPath);
      return {
        ok: true,
        exportId,
        templateId: spec.templateId,
        cached: true,
        downloadUrl: artifactPublicUrl(exportId, "windows"),
      };
    } catch {
      /* export */
    }

    const desktopOut = path.join(repoRoot(), "public", "godot-builds", exportId, "desktop");
    await fs.rm(desktopOut, { recursive: true, force: true });
    await fs.mkdir(desktopOut, { recursive: true });

    const exeName = safeExeBase(spec.title);
    const exePath = path.join(desktopOut, exeName);

    const importMs = PRODUCT.godot.importTimeoutMs;
    const exportMs = PRODUCT.godot.exportTimeoutMs;

    await runGodot(["--headless", "--path", workRoot, "--import"], workRoot, importMs);
    await runGodot(
      ["--headless", "--path", workRoot, "--export-release", "Windows Desktop", exePath],
      workRoot,
      exportMs,
    );
    await fs.access(exePath);

    const buf = await zipDirectoryToBuffer(desktopOut, { excludeDotGodot: false });
    await writeArtifactZip(exportId, "windows", buf);

    return {
      ok: true,
      exportId,
      templateId: spec.templateId,
      cached: false,
      downloadUrl: artifactPublicUrl(exportId, "windows"),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.slice(0, 500), code: "export_failed" };
  }
}

/** Android APK：预设已写入母版；需本机 Android SDK，由 Godot 编辑器或后续 CI 完成 */
export async function exportGodotAndroidApk(params: {
  spec: GameSpec;
  projectId?: string;
  referencePayloads?: RuntimeReferencePayload[];
}): Promise<GodotPlatformExportResult> {
  if (!isGodotExportSupported(params.spec)) {
    return { ok: false, error: "模板不支持 Godot", code: "unsupported" };
  }

  const bin = godotBinPath();
  if (!(await godotExists(bin))) {
    return {
      ok: false,
      error: "未找到 Godot，请运行 npm run godot:install",
      code: "godot_missing",
    };
  }

  try {
    const { exportId, spec, workRoot } = await prepareGodotWorkspace(params);
    const apkOut = path.join(repoRoot(), "public", "godot-builds", exportId, "android", "game.apk");
    await fs.mkdir(path.dirname(apkOut), { recursive: true });

    const importMs = PRODUCT.godot.importTimeoutMs;
    const exportMs = PRODUCT.godot.exportTimeoutMs;

    await runGodot(["--headless", "--path", workRoot, "--import"], workRoot, importMs);
    await runGodot(
      ["--headless", "--path", workRoot, "--export-release", "Android", apkOut],
      workRoot,
      exportMs,
    );
    await fs.access(apkOut);

    const androidDir = path.dirname(apkOut);
    const buf = await zipDirectoryToBuffer(androidDir, { excludeDotGodot: false });
    await writeArtifactZip(exportId, "android", buf);

    return {
      ok: true,
      exportId,
      templateId: spec.templateId,
      cached: false,
      downloadUrl: artifactPublicUrl(exportId, "android"),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/android|sdk|java|gradle/i.test(msg)) {
      return {
        ok: false,
        error:
          "Android 导出需要本机安装 Android SDK 与导出模板。请先下载 Godot 工程 zip，在 Godot 编辑器中配置 Android 后导出 APK。",
        code: "platform_unavailable",
      };
    }
    return { ok: false, error: msg.slice(0, 500), code: "export_failed" };
  }
}

export async function exportGodotByTarget(
  target: GodotExportTarget,
  params: {
    spec: GameSpec;
    projectId?: string;
    referencePayloads?: RuntimeReferencePayload[];
  },
): Promise<GodotPlatformExportResult> {
  switch (target) {
    case "project":
      return exportGodotProjectZip(params);
    case "windows":
      return exportGodotWindowsDesktop(params);
    case "android":
      return exportGodotAndroidApk(params);
    default:
      return { ok: false, error: `未知导出目标: ${target}`, code: "unsupported" };
  }
}
