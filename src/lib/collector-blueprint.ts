import type { GameSpec } from "@/lib/game-spec";

export type CollectorBlueprint = NonNullable<GameSpec["collector"]>;

const RARE_QUALIFIERS = ["精制", "纯净", "稀罕", "雕刻", "荧光", "凛彩", "晶华", "璀璨"] as const;
const GOLDEN_QUALIFIERS = ["神圣", "虹彩", "至尊", "传说", "极光", "玄金", "圣耀", "黄金"] as const;

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickQualifier(arr: readonly string[], seed: number): string {
  return arr[seed % arr.length]!;
}

export function buildCollectorBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
}): CollectorBlueprint {
  const intensity = opts.spec?.director?.intensity ?? 0.55;
  const collectibleLabel = opts.spec?.labels.collectible ?? "宝石";

  const seed = hashStr(collectibleLabel);
  const rareQ = pickQualifier(RARE_QUALIFIERS, seed);
  const goldenQ = pickQualifier(GOLDEN_QUALIFIERS, seed + 3);

  const comboMultiplier = parseFloat((1.5 + intensity * 1.5).toFixed(1));

  return {
    items: [
      {
        id: "common",
        name: collectibleLabel,
        points: 1,
      },
      {
        id: "rare",
        name: `${rareQ}${collectibleLabel}`,
        points: 3,
      },
      {
        id: "golden",
        name: `${goldenQ}${collectibleLabel}`,
        points: 10,
        isGolden: true,
        goldenWindowMs: Math.round(4000 + intensity * 3000),
      },
    ],
    magnetEnabled: intensity > 0.6,
    comboMultiplier,
    hazardPenalty: "loseScore",
  };
}
