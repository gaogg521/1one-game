import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type OpenGameCliOutputFormat = "text" | "json";

export type OpenGameCliConfig = {
  enabled: boolean;
  command: string;
  workDir: string;
  timeoutMs: number;
  yolo: boolean;
  outputFormat: OpenGameCliOutputFormat;
  dryRun: boolean;
};

export type OpenGameCliRunResult =
  | {
      ok: true;
      skipped: false;
      exitCode: number;
      stdout: string;
      stderr: string;
      durationMs: number;
      workDir: string;
      dryRun: boolean;
    }
  | {
      ok: false;
      skipped: false;
      exitCode: number | null;
      stdout: string;
      stderr: string;
      durationMs: number;
      workDir: string;
      error: string;
      dryRun: boolean;
    }
  | { ok: false; skipped: true; reason: string };

function slugDirName(input: string): string {
  const slug = input
    .trim()
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "opengame-run";
}

export function isOpenGameCliEnabled(): boolean {
  return process.env.OPENGAME_CLI === "1";
}

/** Phase B：读取 OpenGame CLI 子进程配置（Pro 模式 spike） */
export function readOpenGameCliConfig(): OpenGameCliConfig {
  const outputFormat =
    process.env.OPENGAME_CLI_OUTPUT_FORMAT === "text" ? "text" : "json";
  return {
    enabled: isOpenGameCliEnabled(),
    command: process.env.OPENGAME_CLI_COMMAND ?? "opengame",
    workDir: process.env.OPENGAME_CLI_WORKDIR ?? path.join(process.cwd(), ".tmp-opengame"),
    timeoutMs: Math.max(30_000, Number(process.env.OPENGAME_CLI_TIMEOUT_MS ?? 180_000)),
    yolo: process.env.OPENGAME_CLI_YOLO !== "0",
    outputFormat,
    dryRun: process.env.OPENGAME_CLI_DRY_RUN === "1",
  };
}

function runProcess(
  command: string,
  args: string[],
  opts: { cwd: string; timeoutMs: number },
): Promise<{ exitCode: number; stdout: string; stderr: string; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`timeout after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        durationMs: Date.now() - started,
      });
    });
  });
}

export type OpenGameCliInvocation = {
  executable: string;
  prefixArgs: string[];
  label: string;
};

function openGameCliStubPath(): string {
  return path.join(process.cwd(), "scripts", "bin", "opengame-qa-stub.mjs");
}

/** 按优先级列出可探测的 CLI 调用方式（真实 opengame → QA stub → npx） */
export function listOpenGameCliInvocations(): OpenGameCliInvocation[] {
  const seen = new Set<string>();
  const out: OpenGameCliInvocation[] = [];

  const push = (inv: OpenGameCliInvocation) => {
    const key = `${inv.executable}\0${inv.prefixArgs.join("\0")}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(inv);
  };

  const fromEnv = process.env.OPENGAME_CLI_COMMAND?.trim();
  if (fromEnv) {
    if (fromEnv.endsWith(".mjs") || fromEnv.endsWith(".js")) {
      push({ executable: process.execPath, prefixArgs: [fromEnv], label: fromEnv });
    } else {
      push({ executable: fromEnv, prefixArgs: [], label: fromEnv });
    }
  }

  if (process.env.OPENGAME_CLI_STUB === "1") {
    const stub = openGameCliStubPath();
    push({ executable: process.execPath, prefixArgs: [stub], label: "qa-stub" });
  }

  push({ executable: "opengame", prefixArgs: [], label: "opengame" });
  push({ executable: "npx", prefixArgs: ["opengame"], label: "npx opengame" });

  return out;
}

function helpLooksValid(stdout: string, stderr: string): boolean {
  const text = `${stdout}\n${stderr}`.toLowerCase();
  return text.includes("prompt") || text.includes("opengame") || text.includes("usage");
}

async function probeInvocation(inv: OpenGameCliInvocation): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await runProcess(inv.executable, [...inv.prefixArgs, "--help"], {
      cwd: process.cwd(),
      timeoutMs: 15_000,
    });
    if (r.exitCode === 0 || helpLooksValid(r.stdout, r.stderr)) {
      return { ok: true };
    }
    return { ok: false, error: `exit ${r.exitCode}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

let resolvedCliInvocation: OpenGameCliInvocation | null | undefined;

/** 解析首个可用的 CLI 调用（缓存于进程内） */
export async function resolveOpenGameCliInvocation(): Promise<OpenGameCliInvocation | null> {
  if (resolvedCliInvocation !== undefined) return resolvedCliInvocation;
  for (const inv of listOpenGameCliInvocations()) {
    const r = await probeInvocation(inv);
    if (r.ok) {
      resolvedCliInvocation = inv;
      return inv;
    }
  }
  resolvedCliInvocation = null;
  return null;
}

/** QA：清除 resolve 缓存（切换 OPENGAME_CLI_* 后） */
export function resetOpenGameCliResolutionCache(): void {
  resolvedCliInvocation = undefined;
}

/** 探测本机是否安装了 opengame CLI（`--help` 探针） */
export async function probeOpenGameCli(command?: string): Promise<{
  available: boolean;
  invocation?: OpenGameCliInvocation;
  label?: string;
  error?: string;
}> {
  if (command) {
    const inv: OpenGameCliInvocation = command.endsWith(".mjs") || command.endsWith(".js")
      ? { executable: process.execPath, prefixArgs: [command], label: command }
      : { executable: command, prefixArgs: [], label: command };
    const r = await probeInvocation(inv);
    return r.ok
      ? { available: true, invocation: inv, label: inv.label }
      : { available: false, error: r.error };
  }

  const inv = await resolveOpenGameCliInvocation();
  if (inv) return { available: true, invocation: inv, label: inv.label };
  return { available: false, error: "no CLI invocation succeeded" };
}

export type RunOpenGameCliHeadlessOptions = {
  workDir?: string;
  runId?: string;
  /** 忽略 OPENGAME_CLI 开关，用于 QA dry-run */
  force?: boolean;
};

/**
 * Phase B spike：headless 调用 `opengame -p "..." --yolo`。
 * 默认仅当 OPENGAME_CLI=1 时执行；OPENGAME_CLI_DRY_RUN=1 跳过真实 spawn。
 * 产物写入 `.tmp-opengame/`（gitignore），尚未接入 Agentic 模块替换。
 */
export async function runOpenGameCliHeadless(
  prompt: string,
  opts?: RunOpenGameCliHeadlessOptions,
): Promise<OpenGameCliRunResult> {
  const cfg = readOpenGameCliConfig();
  if (!cfg.enabled && !opts?.force) {
    return { ok: false, skipped: true, reason: "OPENGAME_CLI not enabled" };
  }

  const runSlug = slugDirName(opts?.runId ?? prompt.slice(0, 32));
  const workDir = opts?.workDir ?? path.join(cfg.workDir, runSlug);

  if (cfg.dryRun) {
    return {
      ok: true,
      skipped: false,
      exitCode: 0,
      stdout: `[dry-run] opengame -p ${JSON.stringify(prompt.slice(0, 120))}`,
      stderr: "",
      durationMs: 0,
      workDir,
      dryRun: true,
    };
  }

  fs.mkdirSync(workDir, { recursive: true });

  const tailArgs = ["-p", prompt, "--output-format", cfg.outputFormat];
  if (cfg.yolo) tailArgs.push("--yolo");

  const inv =
    (await resolveOpenGameCliInvocation()) ??
    ({
      executable: cfg.command,
      prefixArgs: [],
      label: cfg.command,
    } satisfies OpenGameCliInvocation);

  try {
    const r = await runProcess(inv.executable, [...inv.prefixArgs, ...tailArgs], {
      cwd: workDir,
      timeoutMs: cfg.timeoutMs,
    });
    if (r.exitCode === 0) {
      return { ok: true, skipped: false, ...r, workDir, dryRun: false };
    }
    return {
      ok: false,
      skipped: false,
      exitCode: r.exitCode,
      stdout: r.stdout,
      stderr: r.stderr,
      durationMs: r.durationMs,
      workDir,
      error: `exit ${r.exitCode}`,
      dryRun: false,
    };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      exitCode: null,
      stdout: "",
      stderr: "",
      durationMs: 0,
      workDir,
      error: err instanceof Error ? err.message : String(err),
      dryRun: false,
    };
  }
}
