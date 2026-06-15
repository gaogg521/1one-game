import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function repoRoot(): string {
  return process.cwd();
}

export function godotBinPath(): string {
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

export function useGodotDocker(): boolean {
  const v = process.env.GODOT_USE_DOCKER?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

async function dockerAvailable(): Promise<boolean> {
  try {
    await execFileAsync("docker", ["info"], { timeout: 15_000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/** 宿主机 Godot 二进制是否可用（存在且能执行 --version） */
async function nativeGodotRunnable(bin: string): Promise<boolean> {
  try {
    await fs.access(bin);
    await execFileAsync(bin, ["--version"], { timeout: 15_000, windowsHide: true, maxBuffer: 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

/** Godot 导出/headless 是否可用（原生或 Docker 回退） */
export async function godotRuntimeAvailable(): Promise<boolean> {
  if (useGodotDocker()) return dockerAvailable();
  const bin = godotBinPath();
  if (await nativeGodotRunnable(bin)) return true;
  return dockerAvailable();
}

export async function runGodot(args: string[], cwd: string, timeoutMs: number): Promise<void> {
  const root = repoRoot();
  const bin = godotBinPath();
  const preferDocker = useGodotDocker() || !(await nativeGodotRunnable(bin));

  if (preferDocker && (await dockerAvailable())) {
    const rel = path.relative(root, cwd).replace(/\\/g, "/") || ".";
    const script = path.join(root, "scripts", "godot-docker-run.sh");
    await execFileAsync("bash", [script, rel, ...args], {
      cwd: root,
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    });
    return;
  }

  await execFileAsync(bin, args, {
    cwd,
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
}
