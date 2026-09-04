import type { AgenticGameModule } from "@/lib/agentic/game-module";

export type AgenticRunnableResult =
  | { ok: true; reason?: never }
  | { ok: false; reason: string };

export function validateAgenticRunnable(module: AgenticGameModule): AgenticRunnableResult {
  return module.source
    ? { ok: true }
    : { ok: false, reason: "source_missing" };
}
