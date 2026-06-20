/** Phaser 侧专业场景族（实现层） */
export type PhaserRuntimeFamily =
  | "arena"
  | "platformer"
  | "towerDefense"
  | "shooter"
  | "coaster"
  | "puzzle"
  | "farming"
  | "physics"
  | "chess"
  | "customization"
  | "strategy"
  | "rhythm"
  | "sports"
  | "card"
  | "fighting"
  | "moba"
  | "horror"
  | "mahjong"
  | "tetris"
  | "endlessRunner"
  | "fruitNinja"
  | "mahjongSolitaire"
  | "douDizhu"
  | "breakout"
  | "merge2048"
  | "agentic";

/** Godot ai-mother-universal 运行时场景键 */
export type GodotRuntimeKey =
  | "avoider"
  | "collector"
  | "survivor"
  | "platformer"
  | "towerDefense"
  | "shooter"
  | "coaster"
  | "puzzle"
  | "farming"
  | "physics"
  | "chess"
  | "customization"
  | "strategy"
  | "rhythm"
  | "sports"
  | "card"
  | "fighting"
  | "moba"
  | "horror"
  | "mahjong"
  | "tetris"
  | "endlessRunner"
  | "fruitNinja"
  | "mahjongSolitaire"
  | "douDizhu"
  | "breakout"
  | "merge2048";

export type ArenaMode = "avoider" | "collector" | "survivor";

export type TemplateBlueprintKind =
  | "towerDefense"
  | "coaster"
  | "puzzle"
  | "farming"
  | "strategy"
  | "rhythm"
  | "sports"
  | "card"
  | "fighting"
  | "moba"
  | "horror"
  | "mahjong"
  | "tetris"
  | "endlessRunner"
  | "fruitNinja"
  | "mahjongSolitaire"
  | "douDizhu"
  | "breakout"
  | "merge2048";

export type TemplateInferRule = {
  pattern: RegExp;
  /** 同 prompt 多规则命中时取 priority 最高 */
  priority: number;
};

/** 语义模板：面向用户创意 / LLM / 样品馆；与实现族解耦 */
export type GameTemplateDefinition = {
  id: string;
  phaser: PhaserRuntimeFamily;
  godot: GodotRuntimeKey;
  /** arena 族在 PlayScene / arena_runtime 内的子模式 */
  arenaMode?: ArenaMode;
  godotExport: boolean;
  infer: TemplateInferRule[];
  blueprint?: TemplateBlueprintKind;
  defaultSubtitle?: string;
  /** 供 generate-spec 系统提示的一行说明 */
  llmSummary?: string;
};

export type ResolvedTemplateRuntime = {
  templateId: string;
  phaser: PhaserRuntimeFamily;
  godot: GodotRuntimeKey;
  arenaMode?: ArenaMode;
  godotExport: boolean;
  blueprint?: TemplateBlueprintKind;
};
