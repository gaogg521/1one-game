import fs from "node:fs";
import path from "node:path";
import type { GameSpec } from "@/lib/game-spec";
import type { Sample } from "@/lib/samples";
import { expectedPhaserSceneName } from "@/lib/game-templates/runtime";
import { specForSample } from "@/lib/sample-specs";
import { normalizeAstrocadePlaySpec } from "@/lib/astrocade-play-spec";
import { runDebugSkillPipeline } from "@/lib/opengame-skills/debug-skill";
import { buildTemplateFallbackModule } from "@/lib/agentic/template-fallback-modules";
import {
  resolveTemplateArchetype,
} from "@/lib/opengame-skills/template-archetypes";
import type { TemplateArchetypeId } from "@/lib/opengame-skills/types";
import { shouldUseDedicatedSceneForTemplateFirst } from "@/lib/opengame-skills/play-route";

/** Phase C：Template Skill 族 ↔ 样品 templateId ↔ 专用 Phaser Scene */
export type SampleTemplateSkillParityRow = {
  sampleId: string;
  templateId: GameSpec["templateId"];
  phaserScene: string;
  archetypeId: TemplateArchetypeId;
  /** 样品馆应走 dedicated 路由（非 Agentic 用户复杂创意路径） */
  expectDedicatedRoute: boolean;
  /** Phase C 试点：对照 Template hook 做 Scene 源码断言 */
  pilotSceneHooks?: string[];
};

/** 14 款保留样品 + Template Skill 对照（Phase C 基线） */
export const SAMPLE_TEMPLATE_SKILL_PILOTS: Partial<Record<string, string[]>> = {
  "elastic-thief-2": ["physics.add.collider", "setVelocityY", "physics.add.overlap"],
  "smash-the-dummy": ["physics.add", "pointerdown", "hitDummy"],
  "color-bloom": ["drawAnipopTopBar", "match3Specials", "anipopMode"],
  "number-merge-2048": ["merge2048Grid", "build2048"],
  "temple-relic-runner": ["templeDead", "templeRunFinalized", "templeLaneX"],
  "crashy-roads": ["crashyRoadMode", "crashyWaveAt", "crashyNearStreak"],
  "gun-merge-3d-zombie-apocalypse": ["mergeGridEnabled", "mergeTierColor"],
  "blade-defender-merge": ["mergeGridEnabled", "mergeTierLabel"],
  "grow-a-garden": ["harvestGoal", "harvestStreak", "cropEmoji"],
  "pottery-master-3d": ["potterySpinRate", "drawPottery", 'mode === "pottery"'],
  "classic-xiangqi-board": ['ruleset === "xiangqi"', "xiangqiInCheck", "xiangqiGeneralOf"],
  "classic-international-chess": ['ruleset === "international"', "intlInCheck", "intlKingOf"],
  "zen-go-board": ['ruleset === "go"', "goKoBan", "goCapturesW"],
  "jungle-animal-chess": ['ruleset === "jungle"', "jungleAnimalIcon", "junglePieceText"],
};

export function buildSampleTemplateSkillParityRow(sample: Sample): SampleTemplateSkillParityRow {
  const spec = normalizeAstrocadePlaySpec(specForSample(sample));
  const archetype = resolveTemplateArchetype(spec, sample.prompt);
  return {
    sampleId: sample.id,
    templateId: spec.templateId,
    phaserScene: expectedPhaserSceneName(spec),
    archetypeId: archetype.id,
    expectDedicatedRoute: shouldUseDedicatedSceneForTemplateFirst(spec),
    pilotSceneHooks: SAMPLE_TEMPLATE_SKILL_PILOTS[sample.id],
  };
}

export function checkSampleTemplateSkillParity(sample: Sample): string[] {
  const issues: string[] = [];
  const spec = normalizeAstrocadePlaySpec(specForSample(sample));
  const row = buildSampleTemplateSkillParityRow(sample);

  if (row.expectDedicatedRoute !== true) {
    issues.push(`${sample.id}: sample should use dedicated Scene route`);
  }
  if (spec.agenticPlayRoute === "agentic") {
    issues.push(`${sample.id}: sample spec should not be agenticPlayRoute=agentic`);
  }

  const fallback = buildTemplateFallbackModule(spec);
  const debug = runDebugSkillPipeline(fallback);
  if (!debug.ok) {
    issues.push(`${sample.id}: template fallback failed Debug Skill (${debug.reason})`);
  }

  if (row.pilotSceneHooks?.length) {
    const sceneFile = sceneSourcePath(row.phaserScene);
    if (!sceneFile) {
      issues.push(`${sample.id}: unknown phaser scene ${row.phaserScene}`);
    } else {
      try {
        const src = fs.readFileSync(sceneFile, "utf8");
        for (const hook of row.pilotSceneHooks) {
          if (!src.includes(hook)) {
            issues.push(`${sample.id}: ${row.phaserScene} missing Template pilot hook "${hook}"`);
          }
        }
      } catch {
        issues.push(`${sample.id}: could not read ${row.phaserScene} source`);
      }
    }
  }

  return issues;
}

function sceneSourcePath(sceneName: string): string | null {
  const map: Record<string, string> = {
    PlayScene: "src/game/engine/PlayScene.ts",
    PlatformerScene: "src/game/engine/PlatformerScene.ts",
    TowerDefenseScene: "src/game/engine/TowerDefenseScene.ts",
    ShooterScene: "src/game/engine/ShooterScene.ts",
    CoasterScene: "src/game/engine/CoasterScene.ts",
    PuzzleScene: "src/game/engine/PuzzleScene.ts",
    FarmingScene: "src/game/engine/FarmingScene.ts",
    PhysicsScene: "src/game/engine/PhysicsScene.ts",
    ChessScene: "src/game/engine/ChessScene.ts",
    CustomizationScene: "src/game/engine/CustomizationScene.ts",
    StrategyScene: "src/game/engine/StrategyScene.ts",
    AgenticScene: "src/game/engine/AgenticScene.ts",
  };
  const rel = map[sceneName];
  if (!rel) return null;
  return path.join(process.cwd(), rel);
}
