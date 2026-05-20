/** 漫画生成流水线 SSE 事件（generate/stream）。 */
export type ComicStreamEmitter = (event: Record<string, unknown>) => void;

export const COMIC_SSE_STEPS = [
  "start",
  "pipeline_mode",
  "model_start",
  "director_start",
  "director_ready",
  "storyboard_chunk_start",
  "storyboard_chunk_done",
  "shot_plan_start",
  "shot_plan_done",
  "consistency_start",
  "consistency_warn",
  "light_chunk_start",
  "light_chunk_done",
  "panels_render_start",
  "panels_render_progress",
  "save_start",
  "cover_start",
  "done",
  "error",
  "ping",
  "model_error",
] as const;
