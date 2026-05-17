import type { RefinementLogEntry } from "@/lib/refinement-types";

const MAX_ENTRIES = 40;
const MAX_INSTRUCTION_LEN = 480;

/** 解析库内 JSON；损坏或空返回 [] */
export function parseRefinementLog(json: string | null | undefined): RefinementLogEntry[] {
  if (!json || !json.trim()) return [];
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return [];
    const out: RefinementLogEntry[] = [];
    for (const row of v) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      if (typeof o.at !== "string" || typeof o.instruction !== "string") continue;
      if (o.mode !== "patch" && o.mode !== "regenerate") continue;
      out.push({
        at: o.at.slice(0, 40),
        mode: o.mode,
        instruction: o.instruction.slice(0, MAX_INSTRUCTION_LEN),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function appendRefinementLog(
  prevJson: string | null | undefined,
  entry: RefinementLogEntry,
): string {
  const list = parseRefinementLog(prevJson ?? null);
  const next: RefinementLogEntry = {
    ...entry,
    instruction: entry.instruction.trim().slice(0, MAX_INSTRUCTION_LEN),
  };
  list.push(next);
  while (list.length > MAX_ENTRIES) list.shift();
  return JSON.stringify(list);
}
