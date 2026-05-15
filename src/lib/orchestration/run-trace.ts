export const ORCHESTRATION_TRACE_SCHEMA_VERSION = 1 as const;

export type OrchestrationTraceStep = {
  name: string;
  ok: boolean;
  /** 节点 wall-clock，毫秒 */
  ms: number;
  error?: string;
  detail?: Record<string, unknown>;
};

export type OrchestrationRunTrace = {
  schemaVersion: typeof ORCHESTRATION_TRACE_SCHEMA_VERSION;
  runId: string;
  startedAt: number;
  finishedAt: number;
  totalMs: number;
  steps: OrchestrationTraceStep[];
};

function newRunId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Phase 0 编排观测：记录 DAG 节点的耗时（可序列化打入 debug）。
 * 不改变业务返回值，仅在 span 边界计时；失败时记入 error 并仍将异常向上抛。
 */
export class RunTraceRecorder {
  readonly runId: string;
  readonly startedAt: number;
  private readonly steps: OrchestrationTraceStep[] = [];

  constructor() {
    this.runId = newRunId();
    this.startedAt = Date.now();
  }

  /** 零耗时占位（例如「未开启联网」）。 */
  note(name: string, detail?: Record<string, unknown>): void {
    this.steps.push({
      name,
      ok: true,
      ms: 0,
      ...(detail !== undefined ? { detail } : {}),
    });
  }

  /** 包住一段异步逻辑并计时。 */
  async span<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    try {
      const out = await fn();
      this.steps.push({ name, ok: true, ms: Date.now() - t0 });
      return out;
    } catch (e) {
      const err = summarizeErr(e);
      this.steps.push({ name, ok: false, ms: Date.now() - t0, error: err });
      throw e;
    }
  }

  snapshot(): OrchestrationRunTrace {
    const finishedAt = Date.now();
    return {
      schemaVersion: ORCHESTRATION_TRACE_SCHEMA_VERSION,
      runId: this.runId,
      startedAt: this.startedAt,
      finishedAt,
      totalMs: finishedAt - this.startedAt,
      steps: [...this.steps],
    };
  }
}

export function createRunTraceRecorder(): RunTraceRecorder {
  return new RunTraceRecorder();
}

function summarizeErr(e: unknown): string {
  if (e instanceof Error) return String(e.message || e.name).slice(0, 520);
  if (typeof e === "string") return e.slice(0, 520);
  try {
    return JSON.stringify(e).slice(0, 520);
  } catch {
    return "unknown_error";
  }
}
