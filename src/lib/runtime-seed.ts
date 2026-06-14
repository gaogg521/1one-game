import type { GameSpec } from "@/lib/game-spec";

/** 与 mock-spec 同算法，供全平台复用 */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** 同 prompt + profile + template → 全 Scene 共用确定性 seed（Astrocade 对标） */
export function runtimeSeedFromSpec(spec: GameSpec, promptHint = ""): number {
  const blob = [
    spec.templateId,
    spec.samplePlayProfile?.variantId ?? "",
    promptHint.trim() || spec.labels?.subtitle || spec.title,
  ].join("|");
  return hashString(blob);
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function seededFloatBetween(rnd: () => number, min: number, max: number): number {
  return min + rnd() * (max - min);
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  const rnd = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function pickSeeded<T>(arr: T[], seed: number, salt: number): T {
  return arr[(seed + salt * 17) % arr.length]!;
}

export function pickSeededFromArray<T>(arr: T[], rnd: () => number): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(rnd() * arr.length)]!;
}

export function seededIntBetween(rnd: () => number, min: number, max: number): number {
  return Math.floor(seededFloatBetween(rnd, min, max + 1));
}
