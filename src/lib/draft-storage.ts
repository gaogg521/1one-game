/**
 * 生成草稿自动保存工具
 * 支持：游戏(create)、小说(novel/create)、漫画(comic/create)
 */

const DRAFT_KEY = "gc_draft_state";
const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24小时过期

export type DraftType = "game" | "novel" | "comic";

export interface DraftState {
  type: DraftType;
  prompt: string;
  title?: string;
  extra?: string; // comic的content等额外字段
  createdAt: number;
  updatedAt: number;
  generating: boolean; // 是否正在生成中
  generatedId?: string; // 如果生成完成，记录ID
}

function getDraftKey(type: DraftType): string {
  return `${DRAFT_KEY}_${type}`;
}

/**
 * 保存草稿到 localStorage
 */
export function saveDraft(draft: Omit<DraftState, "createdAt" | "updatedAt">): void {
  if (typeof window === "undefined") return;
  const key = getDraftKey(draft.type);
  const now = Date.now();
  const existing = loadDraft(draft.type);
  const state: DraftState = {
    ...draft,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // localStorage 满了，忽略
  }
}

/**
 * 从 localStorage 加载草稿
 */
export function loadDraft(type: DraftType): DraftState | null {
  if (typeof window === "undefined") return null;
  const key = getDraftKey(type);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const state = JSON.parse(raw) as DraftState;
    // 检查过期
    if (Date.now() - state.updatedAt > DRAFT_EXPIRY_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

/**
 * 清除草稿
 */
export function clearDraft(type: DraftType): void {
  if (typeof window === "undefined") return;
  const key = getDraftKey(type);
  localStorage.removeItem(key);
}

/**
 * 检查是否有正在生成中的草稿
 */
export function hasGeneratingDraft(type: DraftType): boolean {
  const draft = loadDraft(type);
  return draft?.generating === true && !draft.generatedId;
}

/**
 * 标记草稿为生成完成
 */
export function markDraftGenerated(type: DraftType, generatedId: string): void {
  const draft = loadDraft(type);
  if (draft) {
    saveDraft({
      ...draft,
      generating: false,
      generatedId,
    });
  }
}

/**
 * 标记草稿开始生成
 */
export function markDraftGenerating(type: DraftType, prompt: string, title?: string, extra?: string): void {
  saveDraft({
    type,
    prompt,
    title,
    extra,
    generating: true,
  });
}

/**
 * 获取所有未完成的草稿
 */
export function getAllUnfinishedDrafts(): DraftState[] {
  const types: DraftType[] = ["game", "novel", "comic"];
  return types
    .map((type) => loadDraft(type))
    .filter((d): d is DraftState => {
      if (!d) return false;
      // 只返回正在生成中且未完成的草稿
      return d.generating && !d.generatedId;
    });
}
