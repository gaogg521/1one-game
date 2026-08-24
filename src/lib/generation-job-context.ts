type JobContextStorage = {
  run<T>(store: { generationJobId: string }, callback: () => T): T;
  getStore(): { generationJobId: string } | undefined;
};

let storage: JobContextStorage | null | undefined;

function getStorage(): JobContextStorage | null {
  if (storage !== undefined) return storage;
  if (typeof window !== "undefined") return (storage = null);
  // This file is reachable from LLM helpers that participate in a client
  // dependency graph. Resolve the Node-only implementation only at runtime.
  const asyncHooks = (0, eval)("require")("node:async_hooks") as {
    AsyncLocalStorage: new () => JobContextStorage;
  };
  storage = new asyncHooks.AsyncLocalStorage();
  return storage;
}

/** Carries only the durable job ID across worker-owned provider calls. */
export function withGenerationJobContext<T>(generationJobId: string, work: () => Promise<T>): Promise<T> {
  const context = getStorage();
  return context ? context.run({ generationJobId }, work) : work();
}

export function currentGenerationJobId(): string | undefined {
  return getStorage()?.getStore()?.generationJobId;
}
