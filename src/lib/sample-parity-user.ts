import type { GameSpec } from "@/lib/game-spec";
export type SampleParityUserInfo = { sceneName: string; promptAligned: boolean; sampleTitle: string; samplePlayPath: string };
export function resolveSampleParityUserInfo(_spec: GameSpec, _prompt?: string): SampleParityUserInfo {
  return { sceneName: "independent-runtime", promptAligned: false, sampleTitle: "独立生成作品", samplePlayPath: "/games" };
}
