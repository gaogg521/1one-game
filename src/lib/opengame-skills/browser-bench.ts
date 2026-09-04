import type { DebugCheckResult } from "@/lib/opengame-skills/types";

export type AgenticBrowserBenchProbe = {
  ok: boolean;
  checks: DebugCheckResult[];
};

export function decodeAgenticBenchPayload(_value: string) { return null; }
export function encodeAgenticBenchPayload(_value: unknown) { return ""; }
export function agenticBenchPath() { return "/"; }
export function buildSpecForAgenticBench<T>(spec: T): T { return spec; }
export function browserBenchToDebugChecks(): DebugCheckResult[] { return []; }
/**
 * Compatibility boundary for the retired agentic-module browser bench.
 *
 * Generated games now run through the independent runtime, but callers still
 * use this optional OpenGame capability.  Keep its public result shape so an
 * enabled bench fails closed instead of either crashing the build or reporting
 * an invented successful playtest.
 */
export async function runAgenticBrowserBench(
  _page: unknown,
  _spec: unknown,
  _module: unknown,
  _baseUrl: string,
): Promise<AgenticBrowserBenchProbe> {
  return { ok: false, checks: [] };
}
