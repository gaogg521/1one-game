import { z } from "zod";

/** 烘焙进 specJson 的样品/克隆定制层（Astrocade 式 per-game logic，非运行时 SAMPLE_MODES） */
export const SamplePlayProfileSchema = z.object({
  variantId: z.string().min(1).max(48),
  platformer: z
    .object({
      treasureHeist: z.boolean().optional(),
      laserSentries: z.boolean().optional(),
      grapplePull: z.number().min(0.01).max(0.05).optional(),
    })
    .optional(),
  physics: z
    .object({
      hitImpulse: z.number().min(0.5).max(3).optional(),
      comboWindowMs: z.number().min(400).max(3000).optional(),
      comboMultiplier: z.number().min(1).max(4).optional(),
      targetHits: z.number().min(20).max(999).optional(),
    })
    .optional(),
  puzzle: z
    .object({
      whimsicalPanels: z.boolean().optional(),
      diffCount: z.number().min(3).max(12).optional(),
      match3BloomScale: z.number().min(1).max(2.5).optional(),
      memoryTimerSec: z.number().min(30).max(300).optional(),
      kidsJigsaw: z.boolean().optional(),
      starReward: z.boolean().optional(),
      jigsawLargeBlocks: z.boolean().optional(),
    })
    .optional(),
  farming: z
    .object({
      autoWater: z.boolean().optional(),
      harvestGoalBoost: z.number().min(1).max(2).optional(),
      decorativeFence: z.boolean().optional(),
      gridBoost: z.number().min(0).max(2).optional(),
    })
    .optional(),
  chess: z
    .object({
      showLegalMoves: z.boolean().optional(),
      isometricHints: z.boolean().optional(),
      winMoves: z.number().min(4).max(24).optional(),
    })
    .optional(),
  strategy: z
    .object({
      rushMode: z.boolean().optional(),
      winNodes: z.number().min(2).max(6).optional(),
      aiAggression: z.number().min(0.8).max(2).optional(),
    })
    .optional(),
  coaster: z
    .object({
      speedBoost: z.number().min(1).max(1.5).optional(),
      bankIntensity: z.number().min(0.5).max(2).optional(),
    })
    .optional(),
  customization: z
    .object({
      potterySpin: z.number().min(0.5).max(2.5).optional(),
      editGoal: z.number().min(3).max(12).optional(),
    })
    .optional(),
  towerDefense: z
    .object({
      mergeGrid: z.boolean().optional(),
      mergeBonusCoins: z.number().min(0).max(200).optional(),
    })
    .optional(),
  shooter: z
    .object({
      orbitChopper: z.boolean().optional(),
      sniperScope: z.boolean().optional(),
    })
    .optional(),
});

export type SamplePlayProfile = z.infer<typeof SamplePlayProfileSchema>;
