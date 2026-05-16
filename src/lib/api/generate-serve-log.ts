/**
 * GENERATE_STRUCTURED_LOG=1 时输出单行 JSON（便于 grep / 聚合）；默认不输出以免影响噪音。
 */

export type GenerateServeLogPhase = "generate" | "generate_stream_done" | "variants" | "novel_generate" | "comic_generate";

export function emitGenerateServeLog(params: {
  phase: GenerateServeLogPhase;
  requestId: string;
  durationMs?: number;
  byteLength?: number;
  promptChars?: number;
  source?: string;
  llmProvider?: string;
  /** variants 等与编排 trace 解耦时的客户端参考图条目数摘要 */
  manifestItemCount?: number;
}) {
  if (process.env.GENERATE_STRUCTURED_LOG?.trim() !== "1") return;
  console.info(
    JSON.stringify({
      type: "gc_generate",
      ts: Date.now(),
      phase: params.phase,
      requestId: params.requestId,
      ...(params.durationMs !== undefined ? { durationMs: params.durationMs } : {}),
      ...(params.byteLength !== undefined ? { requestBodyBytes: params.byteLength } : {}),
      ...(params.promptChars !== undefined ? { promptChars: params.promptChars } : {}),
      ...(params.source !== undefined ? { generationSource: params.source } : {}),
      ...(params.llmProvider !== undefined ? { llmProvider: params.llmProvider } : {}),
      ...(params.manifestItemCount !== undefined ? { clientAssetManifestItemCount: params.manifestItemCount } : {}),
    }),
  );
}
