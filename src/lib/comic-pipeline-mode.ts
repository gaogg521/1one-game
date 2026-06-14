export type ComicSourceMode = "standalone" | "from_novel";

/** 判定漫画生成是否走「小说改编」流水线（绑定 novelId、继承 Brief 等） */
export function resolveComicPipelineMode(input: {
  sourceMode?: ComicSourceMode;
  novelId?: string;
}): ComicSourceMode {
  if (input.sourceMode === "from_novel" || input.sourceMode === "standalone") {
    return input.sourceMode;
  }
  return input.novelId?.trim() ? "from_novel" : "standalone";
}

/** 生成前校验：from_novel 必须有 novelId；standalone 必须有正文或创意 */
export function validateComicPipelineRequest(input: {
  sourceMode?: ComicSourceMode;
  novelId?: string;
  content?: string;
  creativePrompt?: string;
}): "novelNotFound" | "needNovelOrContent" | null {
  const mode = resolveComicPipelineMode(input);
  if (mode === "from_novel") {
    return input.novelId?.trim() ? null : "novelNotFound";
  }
  if (input.content?.trim() || input.creativePrompt?.trim()) return null;
  return "needNovelOrContent";
}
