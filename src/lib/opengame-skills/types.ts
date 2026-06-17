/** OpenGame Skills 类型（提炼自 leigest519/OpenGame，适配 Operone 单文件 Agentic 运行时） */

export type DebugStage = "proactive" | "build" | "runtime";

export type DebugProtocolEntryKind = "proactive" | "reactive";

export type DebugProtocolSignature = {
  stage: DebugStage;
  errorCode: string;
  messagePattern: string;
  fileContext?: string;
};

export type DebugProtocolFix = {
  type: "edit" | "config" | "hint";
  description: string;
  patch: string;
};

export type DebugProtocolEntry = {
  id: string;
  kind: DebugProtocolEntryKind;
  signature: DebugProtocolSignature;
  rootCause: string;
  tags: string[];
  fix: DebugProtocolFix;
};

export type DebugProtocol = {
  version: number;
  name: string;
  description: string;
  attribution: string;
  entries: DebugProtocolEntry[];
};

export type DebugCheckResult = {
  entryId: string;
  errorCode: string;
  message: string;
  fix: DebugProtocolFix;
  rootCause: string;
};

export type TemplateArchetypeId =
  | "gravity_side_view"
  | "top_down_continuous"
  | "path_and_wave"
  | "grid_logic"
  | "ui_heavy"
  | "physics_sandbox";

export type TemplateArchetype = {
  id: TemplateArchetypeId;
  label: string;
  /** OpenGame module family 对应关系 */
  opengameModule: string;
  physicsProfile: string;
  /** 单文件 createGame 内必须实现的结构钩子 */
  hooks: string[];
  /** 注入 LLM 的 scaffold 说明 */
  scaffoldLines: string[];
  /** 最低可玩性要求 */
  playabilityChecks: string[];
};
