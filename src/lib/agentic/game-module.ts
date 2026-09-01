import { z } from "zod";

/** A game-specific browser program emitted by the runtime-code agent. */
export const AgenticModuleSchema = z.object({
  version: z.literal(2),
  source: z.string().min(80).max(64_000),
  entry: z.literal("mountGame"),
});

export type AgenticGameModule = z.infer<typeof AgenticModuleSchema>;

export type IndependentRuntimeContext = {
  title: string;
  prompt: string;
  winScore: number;
  assets: { background?: string; player?: string; enemy?: string; collectible?: string; power?: string };
  finish: (won: boolean, score?: number) => void;
};

/** The iframe owns DOM execution; the host never evaluates generated source. */
export const AGENTIC_FORBIDDEN =
  /\b(fetch|XMLHttpRequest|WebSocket|import\s*\(|require\s*\(|eval\s*\(|new\s+Function\s*\(|Worker\s*\(|SharedWorker\s*\(|window\.open|document\.cookie|localStorage|sessionStorage)\b/i;

export function validateAgenticSource(source: string): { ok: true } | { ok: false; reason: string } {
  if (source.length > 64_000) return { ok: false, reason: "too_large" };
  if (AGENTIC_FORBIDDEN.test(source)) return { ok: false, reason: "forbidden_api" };
  if (!/\bfunction\s+mountGame\s*\(|\bmountGame\s*=/.test(source)) return { ok: false, reason: "mount_missing" };
  if (!/\bctx\.finish\s*\(/.test(source)) return { ok: false, reason: "outcome_missing" };
  return { ok: true };
}

export function parseAgenticModule(raw: unknown): AgenticGameModule | null {
  const parsed = AgenticModuleSchema.safeParse(raw);
  if (!parsed.success) return null;
  return validateAgenticSource(parsed.data.source).ok ? parsed.data : null;
}

export function shouldUseAgenticRuntime(spec: { agenticModule?: AgenticGameModule | null }): boolean {
  return Boolean(spec.agenticModule && validateAgenticSource(spec.agenticModule.source).ok);
}
