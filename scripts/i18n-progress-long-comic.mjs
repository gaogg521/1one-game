/** SSE progress keys for long novel + comic pipelines — imported by i18n-bulk-catalog.mjs */

export const progressNovelLongZhHans = {
  resumeReady: "从第 {start} 批续写（已完成 {done} 批，约 {length} 字）…",
  bibleStartLong: "正在生成世界观与人物设定（设定圣经）…",
  chapterPlanStartLong: "正在规划全书分章要点…",
  chapterPlanReadyLong: "章规划完成，共 {count} 章，开始分批写作…",
  segmentBatch: "第 {index}/{total} 批（{phase}）· 第 {nums} 章…",
  consistencyStart: "第 {index} 批一致性检查…",
  consistencyOk: "本批章节结构正常",
  polishBatchStart: "第 {index} 批润色中…",
  polishBatchDone: "第 {index} 批润色完成",
  continueStart: "{reason}，{hint}{polish}（请勿关闭页面）…",
  continuePolishSuffix: "，含润色",
  continueSynopsis: "正在更新剧情简介…",
  continueDone: "续写完成",
  continueNoDelta: "续写未增加正文长度",
  continueFailed: "续写失败：模型未返回有效增量，请稍后重试",
  continueProcessError: "续写过程异常",
  continuePrep: "正在准备长篇续写…",
  bibleRecoverStart: "未找到流水线存档，正在恢复设定圣经…",
  bibleRecoverReady: "设定恢复完成：《{title}》",
  chapterPlanContinueStart: "正在根据已有正文规划后续章节…",
  chapterPlanContinueReady: "后续 {count} 章已规划，开始续写…",
  chapterPlanNewStart: "原规划章节已全部写完，正在规划新章节…",
  chapterPlanNewReady: "已追加 {count} 章规划",
  continueLimited: "本次续写 {count} 章（已按你的设置限制）",
  continueBatchPlan: "将分 {batches} 批续写 {chapters} 章（剩余篇幅约 {remaining} 字）",
  continueChapterHintAll: "全部待写章",
  continueChapterHintMax: "本次最多 {count} 章",
  continueNoChapters: "无可续写章节且无法追加规划",
  plannedShortFailed: "短篇正文生成失败",
};

export const progressNovelLongEn = {
  resumeReady: "Resuming from batch {start} (completed {done} batches, ~{length} chars)…",
  bibleStartLong: "Building world and character bible…",
  chapterPlanStartLong: "Planning full-book chapter outline…",
  chapterPlanReadyLong: "Chapter plan ready — {count} chapters, starting segmented writing…",
  segmentBatch: "Batch {index}/{total} ({phase}) · chapters {nums}…",
  consistencyStart: "Batch {index} consistency check…",
  consistencyOk: "Batch chapter structure looks good",
  polishBatchStart: "Polishing batch {index}…",
  polishBatchDone: "Batch {index} polish complete",
  continueStart: "{reason}, {hint}{polish} (keep this page open)…",
  continuePolishSuffix: ", with polish",
  continueSynopsis: "Updating synopsis…",
  continueDone: "Continue writing complete",
  continueNoDelta: "Continue writing did not add body text",
  continueFailed: "Continue failed: models returned no valid delta, retry later",
  continueProcessError: "Continue process error",
  continuePrep: "Preparing long-form continue…",
  bibleRecoverStart: "Pipeline archive missing — rebuilding character bible…",
  bibleRecoverReady: "Bible restored: \"{title}\"",
  chapterPlanContinueStart: "Planning remaining chapters from existing body…",
  chapterPlanContinueReady: "{count} follow-up chapters planned — starting continue…",
  chapterPlanNewStart: "Original plan complete — planning new chapters…",
  chapterPlanNewReady: "Added {count} new chapters to the plan",
  continueLimited: "Writing {count} chapters this session (per your limit)",
  continueBatchPlan: "{batches} batches for {chapters} chapters (~{remaining} chars remaining)",
  continueChapterHintAll: "all pending chapters",
  continueChapterHintMax: "up to {count} chapters this session",
  continueNoChapters: "No chapters to continue and cannot extend plan",
  plannedShortFailed: "Short-form body generation failed",
};

export const progressComicZhHans = {
  resumeChunk: "从第 {start}/{total} 批分镜续跑（已有 {pages} 页）…",
  lightChunk: "轻量分镜 第 {index}/{total} 批（第 {from}–{to} 页）…",
  chunkDone: "第 {index} 批分镜完成",
  reuseDirector: "复用导演包：{chars} 角色 · {locs} 场景",
  directorStart: "正在生成漫画导演包（角色/场景/页节拍）…",
  directorDone: "导演包完成：{chars} 角色 · {locs} 场景 · {beats} 页节拍",
  storyboardChunk: "分镜第 {index}/{total} 批（第 {from}–{to} 页）…",
  shotPlanStart: "正在合成镜头与统一生图描述…",
  shotPlanDone: "镜头规划完成",
  prereadStart: "全书精读：正在通读剧情并锁定人设…",
  prereadDone: "精读完成，开始分镜…",
  rosterStart: "正在提取主要角色人设…",
  rosterDone: "已锁定 {count} 位角色",
  pipelineLong: "使用长篇导演流水线",
  pipelineLight: "使用轻量分镜流水线",
  consistencyStart: "一致性检查…",
  directorFallback: "导演分镜失败，自动降级为轻量分镜：{error}",
  lightFallback: "轻量分镜仍失败，使用保底静态分镜：{error}",
  unknownError: "未知错误",
  creativeExpand: "已将一句话创意扩写为短篇正文（含场景与对白），开始漫画改编…",
  startAdapt: "开始改编漫画（{scope} · {readMode}），共 {pages} 页…",
  readModeFull: "全书精读",
  readModeSegment: "段落精读",
  resumeDraft: "续跑分镜草稿（已有 {pages} 页）",
  resumeFromBatch: "发现未完成分镜，从第 {start} 批续跑…",
  checkpointSaved: "分镜 checkpoint：{index}/{total} 批已入库",
  textFilled: "已补全 {count} 格叠字（对白/旁白/解说，画面不含可读文字）",
  charSheetStart: "正在并行生成 {count} 位角色参考图（全片人设锚定）…",
  charSheetReady: "角色参考图就绪（{ready}/{total}），分镜配图将锚定人设",
  panelsRenderStart: "正在生成 {count} 格配图…",
  panelProgress: "配图 {index}/{total}…",
  panelBatchDone: "已完成 {done}/{total} 格",
  saveStart: "正在保存漫画…",
  coverStart: "封面将在后台生成…",
  panelsDeferredWithSheets: "分镜已就绪（{count} 格，含对白/旁白叠字）。角色参考图已入库，将跳转漫画页并行配图…",
  panelsDeferred: "分镜已就绪（{count} 格，含对白/旁白叠字），将跳转漫画页批量配图…",
  comicDone: "漫画生成完成",
  comicFailed: "漫画生成失败",
  needNovelOrContent: "请提供 novelId 或直接粘贴小说内容",
  storyboardFailed: "漫画分镜生成失败",
  storyboardPlaceholder:
    "分镜未对齐小说正文（模型返回占位格）。请重试生成，或改用「全书精读」模式后再试。",
  storyboardExtractFailed: "漫画分镜提取失败（模型未返回有效分镜）",
  storyboardJsonInvalid: "模型未返回有效 JSON",
  storyboardPageJsonFailed: "第 {page} 页分镜 JSON 失败",
  storyboardChunkEmpty:
    "分镜第 {index}/{total} 批生成失败：模型未返回有效 JSON，请重试或切换阅读模式",
};

export const progressComicEn = {
  resumeChunk: "Resuming storyboard from batch {start}/{total} ({pages} pages so far)…",
  lightChunk: "Light storyboard batch {index}/{total} (pages {from}–{to})…",
  chunkDone: "Storyboard batch {index} complete",
  reuseDirector: "Reusing director pack: {chars} characters · {locs} locations",
  directorStart: "Generating comic director pack (characters/scenes/page beats)…",
  directorDone: "Director pack ready: {chars} characters · {locs} locations · {beats} page beats",
  storyboardChunk: "Storyboard batch {index}/{total} (pages {from}–{to})…",
  shotPlanStart: "Composing shots and unified image prompts…",
  shotPlanDone: "Shot planning complete",
  prereadStart: "Full-book read: locking character design…",
  prereadDone: "Pre-read complete, starting storyboard…",
  rosterStart: "Extracting main character roster…",
  rosterDone: "Locked {count} characters",
  pipelineLong: "Using long-form director pipeline",
  pipelineLight: "Using lightweight storyboard pipeline",
  consistencyStart: "Consistency check…",
  directorFallback: "Director storyboard failed, falling back to light storyboard: {error}",
  lightFallback: "Light storyboard also failed, using static fallback: {error}",
  unknownError: "Unknown error",
  creativeExpand: "Expanded one-line pitch into short prose — starting comic adaptation…",
  startAdapt: "Starting comic adaptation ({scope} · {readMode}), {pages} pages…",
  readModeFull: "full-book read",
  readModeSegment: "segment read",
  resumeDraft: "Resuming storyboard draft ({pages} pages so far)",
  resumeFromBatch: "Incomplete storyboard found — resuming from batch {start}…",
  checkpointSaved: "Storyboard checkpoint saved: batch {index}/{total}",
  textFilled: "Filled {count} panel text overlays (dialogue/caption — no readable text in art)",
  charSheetStart: "Generating {count} character reference sheets in parallel…",
  charSheetReady: "Character sheets ready ({ready}/{total}) — panels will anchor designs",
  panelsRenderStart: "Generating {count} panel images…",
  panelProgress: "Panel image {index}/{total}…",
  panelBatchDone: "Completed {done}/{total} panels",
  saveStart: "Saving comic…",
  coverStart: "Cover will generate in the background…",
  panelsDeferredWithSheets:
    "Storyboard ready ({count} panels with text overlays). Character sheets saved — opening comic page for parallel rendering…",
  panelsDeferred:
    "Storyboard ready ({count} panels with text overlays) — opening comic page for batch rendering…",
  comicDone: "Comic generation complete",
  comicFailed: "Comic generation failed",
  needNovelOrContent: "Provide novelId or paste novel content",
  storyboardFailed: "Comic storyboard generation failed",
  storyboardPlaceholder:
    "Storyboard did not match the novel (model returned placeholders). Retry or use full-book read mode.",
  storyboardExtractFailed: "Storyboard extraction failed (model returned no valid panels)",
  storyboardJsonInvalid: "Model did not return valid JSON",
  storyboardPageJsonFailed: "Storyboard JSON failed for page {page}",
  storyboardChunkEmpty:
    "Storyboard batch {index}/{total} failed: model returned no valid JSON — retry or switch read mode",
};

export const apiErrorsExtraZhHans = {
  unauthorized: "未授权",
  notFound: "未找到",
  continueRateLimited: "续写次数过多，请稍后再试",
  quotaInsufficient: "生成额度不足，请邀请好友或升级套餐",
};

export const apiErrorsExtraEn = {
  unauthorized: "Unauthorized",
  notFound: "Not found",
  continueRateLimited: "Too many continue requests. Please try again later.",
  quotaInsufficient: "Not enough generation quota. Invite friends or upgrade your plan.",
};

export function mergeProgressLongComic(locale, zhHans, enExtra) {
  const isZh = locale === "zh-Hans" || locale === "zh-Hant";
  const progressNovelLong =
    locale === "zh-Hant"
      ? Object.fromEntries(
          Object.entries(progressNovelLongZhHans).map(([k, v]) => [
            k,
            v
              .replace(/润色/g, "潤飾")
              .replace(/设定/g, "設定")
              .replace(/规划/g, "規劃")
              .replace(/续写/g, "續寫")
              .replace(/简介/g, "簡介"),
          ]),
        )
      : isZh
        ? progressNovelLongZhHans
        : progressNovelLongEn;

  const progressComic =
    locale === "zh-Hant"
      ? Object.fromEntries(
          Object.entries(progressComicZhHans).map(([k, v]) => [
            k,
            v.replace(/复用/g, "複用").replace(/润色/g, "潤飾").replace(/锁定/g, "鎖定"),
          ]),
        )
      : isZh
        ? progressComicZhHans
        : progressComicEn;

  const apiErrorsExtra = isZh ? apiErrorsExtraZhHans : enExtra ?? apiErrorsExtraEn;

  return { progressNovelLong, progressComic, apiErrorsExtra };
}
