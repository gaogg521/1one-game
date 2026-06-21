/**
 * Director Ledger —— 移植自 threejs-game-skills 的 director 编排模式。
 *
 * 生成 GameSpec 时维护 4 张 ledger（账本），写入 orchestration trace，让生成过程可审计：
 *  1. skill-loading ledger：加载了哪些"技能模块"（creative-brief / template-override / genre-pack / blueprint）
 *  2. reference ledger：加载了哪些"参考文件"（template-brief-override[tmpl] / blueprint / genre-pack）
 *  3. asset ledger：每个视觉面用程序化 / 文生图 / 外部 API 的决策
 *  4. phase ledger：4 阶段（intent → brief → spec → quality）执行状态 + 证据
 *
 * 不改变生成结果，只记录过程，供前端"制作过程（高级）"面板与 QA 审计使用。
 */
import type { GameSpec } from "@/lib/game-spec";
import { getTemplateBriefOverride } from "@/lib/creative-brief/template-brief-overrides";
import { scoreVisualQuality, type VisualScorecard } from "@/lib/visual-scorecard";

export type SkillLoadingEntry = {
  skill: string;
  loaded: boolean;
  pathOrReason: string;
};

export type ReferenceEntry = {
  reference: string;
  loaded: boolean;
  pathOrReason: string;
};

export type AssetSourcingEntry = {
  surface: string; // hero / obstacles / rewards / world / ui
  source: "procedural" | "text-to-image" | "external-api" | "not-needed";
  reason: string;
};

export type PhaseEntry = {
  phase: "intent" | "brief" | "spec" | "quality";
  status: "pending" | "running" | "done" | "skipped" | "blocked";
  evidence: string;
};

export type DirectorLedger = {
  skillLoading: SkillLoadingEntry[];
  references: ReferenceEntry[];
  assets: AssetSourcingEntry[];
  phases: PhaseEntry[];
  scorecard?: VisualScorecard;
};

export type LedgerRecorder = {
  addSkill(skill: string, loaded: boolean, pathOrReason: string): void;
  addReference(reference: string, loaded: boolean, pathOrReason: string): void;
  addAsset(surface: string, source: AssetSourcingEntry["source"], reason: string): void;
  setPhase(phase: PhaseEntry["phase"], status: PhaseEntry["status"], evidence: string): void;
  finalizeWithScorecard(spec: GameSpec): void;
  toLedger(): DirectorLedger;
};

export function createDirectorLedger(): LedgerRecorder {
  const ledger: DirectorLedger = {
    skillLoading: [],
    references: [],
    assets: [],
    phases: [],
  };

  return {
    addSkill(skill, loaded, pathOrReason) {
      ledger.skillLoading.push({ skill, loaded, pathOrReason });
    },
    addReference(reference, loaded, pathOrReason) {
      ledger.references.push({ reference, loaded, pathOrReason });
    },
    addAsset(surface, source, reason) {
      ledger.assets.push({ surface, source, reason });
    },
    setPhase(phase, status, evidence) {
      const existing = ledger.phases.find((p) => p.phase === phase);
      if (existing) {
        existing.status = status;
        existing.evidence = evidence;
      } else {
        ledger.phases.push({ phase, status, evidence });
      }
    },
    finalizeWithScorecard(spec) {
      ledger.scorecard = scoreVisualQuality(spec);
      ledger.phases.find((p) => p.phase === "quality")!.evidence =
        `avg=${ledger.scorecard.average.toFixed(2)} passing=${ledger.scorecard.passing} failures=${ledger.scorecard.automaticFailures.length}`;
    },
    toLedger() {
      return { ...ledger };
    },
  };
}

/**
 * 给定 templateId + prompt，预填标准的 ledger 条目（skill-loading + reference + asset 默认决策）。
 * 调用方在生成各阶段补充 phase 状态。
 */
export function seedStandardLedger(
  rec: LedgerRecorder,
  templateId: string,
  prompt: string,
): void {
  // skill-loading ledger
  rec.addSkill("creative-brief-parse", true, "src/lib/creative-brief/parse-intent.ts");
  rec.addSkill("template-selector", true, "src/lib/template-selector.ts");
  rec.addSkill("game-templates-infer", true, "src/lib/game-templates/infer.ts");
  rec.addSkill("creative-brief-expand", true, "src/lib/creative-brief/expand-brief.ts");

  const ov = getTemplateBriefOverride(templateId);
  rec.addSkill(
    "template-brief-override",
    Boolean(ov),
    ov ? `template-brief-overrides[${templateId}]` : `no override for ${templateId}, fallback general-arcade`,
  );

  // reference ledger
  rec.addReference(
    `template-brief-override[${templateId}]`,
    Boolean(ov),
    ov ? `world: ${ov.world.slice(0, 40)}` : "missing",
  );
  if (ov?.playableLoop) {
    rec.addReference(
      `playable-loop[${templateId}]`,
      true,
      `verb=${ov.playableLoop.verb}; objective=${ov.playableLoop.objective}`,
    );
  }
  rec.addReference("game-spec-schema", true, "src/lib/game-spec.ts");
  rec.addReference("generate-spec-system-prompt", true, "src/lib/generate-spec.ts (SYSTEM)");

  // asset sourcing ledger（默认决策：程序化为主，封面走文生图）
  rec.addAsset("hero/player", "procedural", `${templateId} Scene 内置程序化角色/emoji`);
  rec.addAsset("obstacles/enemies", "procedural", `${templateId} Scene 内置程序化/emoji`);
  rec.addAsset("rewards/collectibles", "procedural", `${templateId} Scene 内置程序化/emoji`);
  rec.addAsset("world/background", "text-to-image", "封面文生图（若有 API key）");
  rec.addAsset("ui/hud", "procedural", "HudFrame 程序化绘制");

  // phase ledger 初始
  rec.setPhase("intent", "done", `templateId=${templateId}; prompt=${prompt.slice(0, 40)}`);
  rec.setPhase("brief", "pending", "");
  rec.setPhase("spec", "pending", "");
  rec.setPhase("quality", "pending", "");
}
