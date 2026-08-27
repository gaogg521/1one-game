type JobContextStore = {
  generationJobId: string;
  uiLocale?: string;
};

type JobContextStorage = {
  run<T>(store: JobContextStore, callback: () => T): T;
  getStore(): JobContextStore | undefined;
};

let storage: JobContextStorage | null | undefined;

function getStorage(): JobContextStorage | null {
  if (storage !== undefined) return storage;
  if (typeof window !== "undefined") return (storage = null);
  // This file is reachable from LLM helpers that participate in a client
  // dependency graph. Resolve the Node-only implementation only at runtime.
  const nodeProcess = (globalThis as typeof globalThis & {
    process?: { getBuiltinModule?: (name: string) => unknown };
  }).process;
  const asyncHooks = nodeProcess?.getBuiltinModule?.("node:async_hooks") as {
    AsyncLocalStorage?: new () => JobContextStorage;
  } | undefined;
  if (!asyncHooks?.AsyncLocalStorage) throw new Error("node_async_local_storage_unavailable");
  storage = new asyncHooks.AsyncLocalStorage();
  return storage;
}

export function withGenerationJobContext<T>(
  generationJobId: string,
  work: () => Promise<T>,
  opts?: { uiLocale?: string },
): Promise<T> {
  const context = getStorage();
  return context
    ? context.run({ generationJobId, uiLocale: opts?.uiLocale }, work)
    : work();
}

export function currentGenerationJobId(): string | undefined {
  return getStorage()?.getStore()?.generationJobId;
}

export function currentGenerationJobLocale(): string | undefined {
  return getStorage()?.getStore()?.uiLocale;
}
