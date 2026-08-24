import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<{ generationJobId: string }>();

/** Carries only the durable job ID across worker-owned provider calls. */
export function withGenerationJobContext<T>(generationJobId: string, work: () => Promise<T>): Promise<T> {
  return storage.run({ generationJobId }, work);
}

export function currentGenerationJobId(): string | undefined {
  return storage.getStore()?.generationJobId;
}
