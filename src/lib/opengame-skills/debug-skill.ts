import type { AgenticGameModule } from "@/lib/agentic/game-module";
import { validateAgenticSource } from "@/lib/agentic/game-module";
import { validateAgenticRunnable } from "@/lib/agentic/agentic-runnable";
import { OPERONE_DEBUG_PROTOCOL } from "@/lib/opengame-skills/debug-protocol";
import type { DebugCheckResult, DebugProtocolEntry } from "@/lib/opengame-skills/types";

function entryMatchesProactive(entry: DebugProtocolEntry, source: string, matched: boolean): boolean {
  if (entry.kind !== "proactive") return false;
  const pat = entry.signature.messagePattern;
  try {
    const re = new RegExp(pat, "i");
    const hasMatch = re.test(source);
    // Patterns like MISSING_WIN use negative logic: fail if NOT found
    if (entry.signature.errorCode === "MISSING_WIN_OR_LOSE") return !hasMatch;
    if (entry.signature.errorCode === "MISSING_INPUT") return !hasMatch;
    if (entry.signature.errorCode === "MISSING_PLAYFIELD") return !hasMatch;
    if (entry.signature.errorCode === "MISSING_HUD") return !hasMatch;
    if (entry.signature.errorCode === "MISSING_UPDATE_FOR_SPAWNER") {
      const hasSpawn = /spawn|wave|hazard|enemies/i.test(source);
      const hasUpdateLoop = /update\s*\(|events\.on\s*\(\s*['"]update['"]|time\.addEvent|delayedCall/i.test(source);
      return hasSpawn && !hasUpdateLoop;
    }
    return hasMatch;
  } catch {
    return matched;
  }
}

function entryMatchesReactive(entry: DebugProtocolEntry, reason: string): boolean {
  if (entry.kind !== "reactive") return false;
  try {
    return new RegExp(entry.signature.messagePattern, "i").test(reason);
  } catch {
    return false;
  }
}

/** Debug Skill — 生成前 proactive 静态检查（OpenGame Debug Skill 适配） */
export function runDebugSkillProactive(source: string): DebugCheckResult[] {
  const failures: DebugCheckResult[] = [];
  for (const entry of OPERONE_DEBUG_PROTOCOL.entries) {
    if (entry.kind !== "proactive") continue;
    if (entryMatchesProactive(entry, source, false)) {
      failures.push({
        entryId: entry.id,
        errorCode: entry.signature.errorCode,
        message: entry.rootCause,
        fix: entry.fix,
        rootCause: entry.rootCause,
      });
    }
  }
  return failures;
}

/** Debug Skill — 运行时失败匹配协议条目 */
export function matchDebugSkillReactive(reason: string): DebugCheckResult[] {
  const matches: DebugCheckResult[] = [];
  for (const entry of OPERONE_DEBUG_PROTOCOL.entries) {
    if (entry.kind !== "reactive") continue;
    if (entryMatchesReactive(entry, reason)) {
      matches.push({
        entryId: entry.id,
        errorCode: entry.signature.errorCode,
        message: reason,
        fix: entry.fix,
        rootCause: entry.rootCause,
      });
    }
  }
  return matches;
}

/** 将 Debug Skill 命中项转为 LLM repair 提示 */
export function buildDebugSkillRepairHints(checks: DebugCheckResult[]): string[] {
  if (!checks.length) return [];
  const lines = ["Debug Skill protocol fixes (apply ALL):"];
  for (const c of checks.slice(0, 6)) {
    lines.push(`- [${c.errorCode}] ${c.rootCause}`);
    lines.push(`  Fix: ${c.fix.description}`);
    lines.push(`  Patch: ${c.fix.patch}`);
  }
  return lines;
}

export type DebugSkillPipelineResult =
  | { ok: true; stage: "proactive" | "runnable" }
  | { ok: false; stage: "forbidden" | "proactive" | "runnable"; reason: string; checks: DebugCheckResult[] };

/**
 * Debug Skill 闭环：forbidden → proactive → runnable（mock 沙箱）
 * 对应 OpenGame verify → diagnose → repair 的前两阶段（真浏览器在 Phase B）。
 */
export function runDebugSkillPipeline(mod: AgenticGameModule): DebugSkillPipelineResult {
  const forbidden = validateAgenticSource(mod.source);
  if (!forbidden.ok) {
    return {
      ok: false,
      stage: "forbidden",
      reason: forbidden.reason,
      checks: [],
    };
  }

  const proactive = runDebugSkillProactive(mod.source);
  if (proactive.length) {
    return {
      ok: false,
      stage: "proactive",
      reason: proactive.map((p) => p.errorCode).join(", "),
      checks: proactive,
    };
  }

  const runnable = validateAgenticRunnable(mod);
  if (!runnable.ok) {
    const reactive = matchDebugSkillReactive(runnable.reason);
    return {
      ok: false,
      stage: "runnable",
      reason: runnable.reason,
      checks: reactive.length
        ? reactive
        : [
            {
              entryId: "fallback-runnable",
              errorCode: "RUNTIME_THROW",
              message: runnable.reason,
              rootCause: "create() or update() threw in sandbox",
              fix: {
                type: "edit",
                description: "Ensure create() does not throw; initialize all objects before use.",
                patch: "Wrap risky calls; verify physics.add.existing after creating display object.",
              },
            },
          ],
    };
  }

  return { ok: true, stage: "runnable" };
}

export function getDebugProtocolEntryCount(): number {
  return OPERONE_DEBUG_PROTOCOL.entries.length;
}
