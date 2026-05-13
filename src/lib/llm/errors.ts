export function safeErrorSummary(e: unknown): string {
  if (!e) return "unknown error";
  if (typeof e === "string") return e.slice(0, 400);
  if (e instanceof Error) {
    const msg = (e.message || e.name || "Error").replace(/sk-[A-Za-z0-9_-]+/g, "sk-***");
    return msg.slice(0, 800);
  }
  try {
    return JSON.stringify(e).slice(0, 800);
  } catch {
    return "unknown error";
  }
}

