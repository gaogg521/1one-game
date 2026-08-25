import { z } from "zod";

/**
 * The product contract produced for every newly-created game.  It deliberately
 * keeps audio and first-minute pacing data inspectable instead of hiding them
 * in a prose prompt or a scene-specific implementation.
 */
export const GAME_MUSIC_SECTIONS = ["intro", "build", "drop", "climax"] as const;
export const GAME_AMBIENCE_IDS = ["meadow", "ocean", "city", "space", "cave", "arcade"] as const;

export const GameAudioProductionSchema = z.object({
  version: z.literal(1),
  ambience: z.enum(GAME_AMBIENCE_IDS),
  sections: z
    .array(
      z.object({
        section: z.enum(GAME_MUSIC_SECTIONS),
        startSecond: z.number().int().min(0).max(60),
        tension: z.number().min(0).max(1),
        musicGain: z.number().min(0).max(1),
        ambienceGain: z.number().min(0).max(1),
        cue: z.string().min(1).max(80),
      }),
    )
    .length(4),
  sfx: z
    .array(z.enum(["input", "pickup", "impact", "power", "boss", "victory", "defeat"]))
    .min(5)
    .max(7),
  mix: z.object({
    musicGain: z.number().min(0).max(1),
    ambienceGain: z.number().min(0).max(1),
    sfxGain: z.number().min(0).max(1),
    maxConcurrentSfx: z.number().int().min(1).max(6),
    duckMusicOnImpact: z.number().min(0).max(0.5),
  }),
  mobile: z.object({
    startsAfterFirstGesture: z.literal(true),
    pausesWhenHidden: z.literal(true),
    maxConcurrentSfx: z.number().int().min(1).max(6),
  }),
});

export const GameProductionContractSchema = z.object({
  version: z.literal(1),
  levelFlow: z
    .array(
      z.object({
        phase: z.enum(["onboarding", "core-loop", "variation", "climax"]),
        window: z.enum(["0-5", "5-20", "20-40", "40-60"]),
        goal: z.string().min(1).max(100),
        musicSection: z.enum(GAME_MUSIC_SECTIONS),
      }),
    )
    .length(4),
  audio: GameAudioProductionSchema,
});

export type GameAudioProduction = z.infer<typeof GameAudioProductionSchema>;
export type GameProductionContract = z.infer<typeof GameProductionContractSchema>;

type ContractInput = {
  prompt: string;
  templateId: string;
};

function inferAmbience(input: ContractInput): GameAudioProduction["ambience"] {
  const source = `${input.prompt} ${input.templateId}`.toLowerCase();
  if (/(太空|宇宙|星际|space|cyber|赛博)/i.test(source)) return "space";
  if (/(海洋|海底|海岛|ocean|water)/i.test(source)) return "ocean";
  if (/(城市|街头|地铁|city|赛车|竞速)/i.test(source)) return "city";
  if (/(恐怖|地牢|洞穴|horror|cave)/i.test(source)) return "cave";
  if (/(农场|种植|森林|花园|自然|farming|garden|forest)/i.test(source)) return "meadow";
  return "arcade";
}

function coreGoal(templateId: string): string {
  if (templateId === "puzzle") return "完成第一手有效操作并看见连锁结果";
  if (templateId === "platformer") return "完成移动、跳跃与第一次安全落点";
  if (templateId === "towerDefense") return "布置第一座防线并守住首波敌人";
  if (templateId === "farming" || templateId === "garden") return "完成种植、照料与第一次收获";
  if (templateId === "shooter") return "移动、命中目标并完成第一段交战";
  return "理解核心规则并完成第一次有效操作";
}

/** Default first-minute pacing, sound, mixing and mobile policy for every generated game. */
export function buildDefaultGameProductionContract(input: ContractInput): GameProductionContract {
  const ambience = inferAmbience(input);
  return {
    version: 1,
    levelFlow: [
      { phase: "onboarding", window: "0-5", goal: coreGoal(input.templateId), musicSection: "intro" },
      { phase: "core-loop", window: "5-20", goal: "重复核心循环，形成可理解的奖励与风险", musicSection: "build" },
      { phase: "variation", window: "20-40", goal: "加入一个新条件，让玩家作出选择", musicSection: "drop" },
      { phase: "climax", window: "40-60", goal: "用一次高潮、胜负或明确下一关目标收束首局", musicSection: "climax" },
    ],
    audio: {
      version: 1,
      ambience,
      sections: [
        { section: "intro", startSecond: 0, tension: 0.24, musicGain: 0.72, ambienceGain: 0.8, cue: "看懂目标，完成第一次操作" },
        { section: "build", startSecond: 5, tension: 0.5, musicGain: 0.84, ambienceGain: 0.9, cue: "建立核心循环和奖励节奏" },
        { section: "drop", startSecond: 20, tension: 0.72, musicGain: 0.96, ambienceGain: 1, cue: "变化出现，强调选择与反馈" },
        { section: "climax", startSecond: 40, tension: 0.92, musicGain: 1, ambienceGain: 0.86, cue: "高潮、Boss 或首局结算" },
      ],
      sfx: ["input", "pickup", "impact", "power", "boss", "victory", "defeat"],
      mix: { musicGain: 0.72, ambienceGain: 0.16, sfxGain: 0.7, maxConcurrentSfx: 4, duckMusicOnImpact: 0.12 },
      mobile: { startsAfterFirstGesture: true, pausesWhenHidden: true, maxConcurrentSfx: 4 },
    },
  };
}
