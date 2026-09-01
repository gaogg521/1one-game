import type { AgenticGameModule } from "@/lib/agentic/game-module";
export function validateAgenticRunnable(module: AgenticGameModule) { return { ok: Boolean(module.source), reason: module.source ? undefined : "source_missing" }; }
