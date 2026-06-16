export type CloneBatchSummary = {
  batch?: string;
  total?: number;
  passCount?: number;
  pass?: boolean;
  rows?: unknown[];
};

export function resolveCloneBatchGateOk(params: {
  commandOk: boolean;
  summary: CloneBatchSummary | null | undefined;
}): boolean {
  if (params.commandOk) return true;
  const summary = params.summary;
  if (!summary?.pass) return false;
  if (summary.batch !== "all") return false;
  if (typeof summary.total !== "number" || typeof summary.passCount !== "number") return false;
  return summary.total > 0 && summary.passCount === summary.total;
}
