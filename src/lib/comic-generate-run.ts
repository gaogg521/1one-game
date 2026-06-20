import { ensureComicCoverAfterCreate } from "@/lib/cover-generation";
import { inferStoryGenre, resolveNovelCoverGenre } from "@/lib/cover-genre";
import type { ComicChapterScope } from "@/lib/comic-chapter-scope";
import {
  resolvePageCountForChapterScope,
  sliceNovelByChapterScope,
} from "@/lib/comic-chapter-scope";
import { loadNovelGenerationMeta } from "@/lib/novel-pipeline-meta-db";
import { loadNovelCharacterRoster } from "@/lib/novel-character-roster-db";
import {
  applyCharacterSheetUrlsToRoster,
  collectCharacterSheetUrls,
  mergeCharacterRosterReferenceUrls,
  type ComicCharacterRoster,
} from "@/lib/comic-character-roster";
import { resolveComicStylePreset } from "@/lib/comic-style-presets";
import { getComicStoryboardModelCascade } from "@/lib/llm";
import {
  ComicGenerateError,
  ComicGenerationRunError,
  resolveComicRunErrorMessage,
} from "@/lib/comic-run-errors";
import { generateComicPages, type ComicChunkCheckpoint } from "@/lib/comic-pipeline";
import type { ComicPage, ComicReadMode } from "@/lib/comic-format";
import { parseComicImageUrls } from "@/lib/comic-format";
import { comicCreativeNeedsExpansion, expandComicCreativeToStoryBody } from "@/lib/comic-creative-expand";
import type { ComicDirectorPack } from "@/lib/comic-director-types";
import {
  buildPartialComicDoc,
  findDraftStoryboardComic,
  resumeChunkIndexFromDoc,
  upsertStoryboardDraftComic,
  COMIC_STATUS_DRAFT_STORYBOARD,
} from "@/lib/comic-storyboard-checkpoint";
import type { ComicStreamEmitter } from "@/lib/comic-pipeline-events";
import {
  comicPagesAreAllPlaceholders,
  enrichPagesFromNovelSegments,
} from "@/lib/comic-dialogue-extract";
import { splitNovelIntoSegments } from "@/lib/comic-storyboard-segments";
import {
  ensureComicPanelsHaveReadableText,
  formatComicConsistencyIssues,
} from "@/lib/comic-panel-consistency";
import {
  panelsPerPageForLayout,
  resolveComicLayoutId,
  resolveComicPageCount,
  shouldUseLongComicPipeline,
  type ComicLayoutId,
} from "@/lib/comic-generate-config";
import {
  resolveComicOutputLocale,
  resolveComicLayoutForLocale,
  resolveStoryboardChunkPagesForTier,
} from "@/lib/comic-locale-prompts";
import { formatComicStorageTitle } from "@/lib/comic-display";
import { renderComicPanels, serializeComicPanels } from "@/lib/comic-panel-render";
import { generateCharacterSheets } from "@/lib/comic-character-sheet-gen";
import {
  extractNovelTitleFromContent,
  normalizeNovelTitle,
  validateNovelTitleInput,
} from "@/lib/novel-display";
import {
  isChildrenNovelTier,
  parseNovelLengthTier,
  resolveNovelLengthTier,
} from "@/lib/novel-length";
import { inferNovelGenreTagFromStoredPrompt } from "@/lib/novel-genre-tags";
import { loadChildrenNovelMeta } from "@/lib/children-novel-meta-db";
import {
  extractComicCreativePitch,
  resolveMediaCreativeBrief,
} from "@/lib/creative-brief/resolve-media-brief";
import {
  parseChildrenCreativeBrief,
  parseNovelCreativeBrief,
  type ChildrenCreativeBrief,
  type NovelBriefUserRevision,
  type NovelCreativeBrief,
} from "@/lib/literary-brief";
import { saveComicCreativeBriefJson } from "@/lib/comic-creative-brief-db";
import {
  loadChildrenCreativeBrief,
  loadNovelCreativeBrief,
  saveNovelCreativeBriefJson,
  serializeChildrenCreativeBrief,
  serializeNovelCreativeBrief,
} from "@/lib/novel-creative-brief-db";
import { defaultWorkVisibility } from "@/lib/auth/work-visibility";
import { prisma } from "@/lib/prisma";
import { PRODUCT } from "@/lib/product-config";
import type { AppLocale } from "@/i18n/routing";
import { progressComicMessage } from "@/lib/i18n/progress-message";
import { untitledNovelLabel } from "@/lib/i18n/chapter-labels";

export type { ComicGenerateErrorKey } from "@/lib/comic-run-errors";
export { ComicGenerateError, ComicGenerationRunError, resolveComicRunErrorMessage } from "@/lib/comic-run-errors";

export type { ComicSourceMode } from "@/lib/comic-pipeline-mode";
export { resolveComicPipelineMode, validateComicPipelineRequest } from "@/lib/comic-pipeline-mode";
import { resolveComicPipelineMode, validateComicPipelineRequest, type ComicSourceMode } from "@/lib/comic-pipeline-mode";
import {
  comicCreativeExpandKey,
  comicProgressScopeKey,
  comicProgressStartKey,
  resolveChapterScopeForComicGenerate,
  shouldSkipStandaloneComicBrief,
  shouldSkipComicBriefExpand,
} from "@/lib/comic-standalone-pipeline";

export type ComicGenerateRunInput = {
  ownerKey: string;
  /** 从已有小说改编时传入；独立创作勿传 */
  novelId?: string;
  /** standalone=独立漫画流水线；from_novel=绑定小说并继承 Brief/改编机制 */
  sourceMode?: ComicSourceMode;
  content?: string;
  /** 一句话漫画创意（全文粘贴时可单独填写；不填则从短文或首段提取） */
  creativePrompt?: string;
  /** 客户端已预览的 Brief，避免重复 LLM 扩写 */
  creativeBrief?: NovelCreativeBrief | ChildrenCreativeBrief;
  briefRevision?: NovelBriefUserRevision;
  title?: string;
  pageCount?: number;
  layoutId?: string;
  lengthTier?: string;
  /** 漫画画风预设：japanese_clean | chibi_cute | korean_shoujo | chinese_wuxia | chinese_campus */
  stylePreset?: string;
  /** segment=按段落分批；full=全书精读后再分镜 */
  readMode?: ComicReadMode;
  /** 按章改编（不传=全书） */
  chapterScope?: ComicChapterScope | null;
  /** 用户锁定的人设（优先于自动提取） */
  characterRoster?: ComicCharacterRoster | null;
  /** 续跑未完成的分镜草稿（status=draft_storyboard） */
  resumeComicId?: string;
  /** 跳过导演流水线，直接轻量分镜 */
  forceLightStoryboard?: boolean;
  /** 跳过人设参考图文生图（分镜仍可进行，无跨格锚定） */
  skipCharSheets?: boolean;
  /** 单角色参考图超时（毫秒）；QA 可设较短值 */
  charSheetTimeoutMs?: number;
  uiLocale?: AppLocale;
};

export type ComicGenerateRunResult = {
  comicId: string;
  pageCount: number;
  panelCount: number;
  panelsRendered: number;
  pipeline: string;
  storyboardSource: "llm" | "emergency";
  needsPanelRender: boolean;
  imagesWarning?: string;
  consistencyWarnings?: string;
  provider: string;
  model: string;
  imageSource: string;
};

export async function resolveComicGenerateNovel(
  input: ComicGenerateRunInput,
): Promise<{
  novelTitle: string;
  novelContent: string;
  novelSummary: string;
  novelPrompt: string;
  actualNovelId: string | null;
  novelLengthTier: ReturnType<typeof parseNovelLengthTier>;
  novelMeta: Awaited<ReturnType<typeof loadNovelGenerationMeta>>;
  creativeExpanded: boolean;
}> {
  let novelTitle = input.title?.trim() || untitledNovelLabel(input.uiLocale ?? "zh-Hans");
  let novelContent = "";
  let novelSummary = "";
  let novelPrompt = "";
  let actualNovelId: string | null = input.novelId ?? null;
  let novelLengthTier = parseNovelLengthTier(input.lengthTier);
  let novelMeta = null;
  let creativeExpanded = false;
  const uiLocale = input.uiLocale ?? "zh-Hans";
  const sourceMode = resolveComicPipelineMode(input);
  const fromNovel = sourceMode === "from_novel";

  if (fromNovel && actualNovelId) {
    const novel = await prisma.novel.findUnique({ where: { id: actualNovelId } });
    if (!novel) throw new ComicGenerateError("novelNotFound", 404);
    if (novel.ownerKey !== input.ownerKey) throw new ComicGenerateError("comicNovelForbidden", 403);
    novelContent = novel.content;
    novelSummary = novel.summary ?? "";
    novelPrompt = novel.prompt ?? "";
    novelTitle = normalizeNovelTitle(novel.title, novel.prompt, undefined, uiLocale);
    if (novel.lengthTier) novelLengthTier = parseNovelLengthTier(novel.lengthTier);
    const genreFromPrompt = inferNovelGenreTagFromStoredPrompt(novelPrompt);
    novelLengthTier = resolveNovelLengthTier({
      genreTagId: genreFromPrompt?.id,
      lengthTierPick: novelLengthTier,
    });
    novelMeta = await loadNovelGenerationMeta(actualNovelId);
  } else if (input.content?.trim() || input.creativePrompt?.trim()) {
    const pitch = input.creativePrompt?.trim();
    if (input.content?.trim()) {
      novelContent = input.content.trim();
      const expandFrom =
        pitch && pitch.length >= 2 && comicCreativeNeedsExpansion(novelContent) ? pitch : novelContent;
      if (comicCreativeNeedsExpansion(novelContent)) {
        const expanded = await expandComicCreativeToStoryBody(expandFrom, input.title);
        novelContent = expanded.body;
        creativeExpanded = expanded.expanded;
        if (expanded.expanded) {
          novelSummary = novelContent.slice(0, 200).replace(/\n/g, " ").slice(0, 160) + "…";
        }
      }
    } else if (pitch) {
      const expanded = await expandComicCreativeToStoryBody(pitch, input.title);
      novelContent = expanded.body;
      creativeExpanded = true;
      novelSummary = novelContent.slice(0, 200).replace(/\n/g, " ").slice(0, 160) + "…";
    }
    if (input.title?.trim()) {
      const tv = validateNovelTitleInput(input.title.trim());
      novelTitle = tv.ok
        ? tv.value
        : normalizeNovelTitle(input.title.trim(), novelContent.slice(0, 500), undefined, uiLocale);
    } else {
      novelTitle = extractNovelTitleFromContent(
        novelContent,
        pitch,
        novelContent.slice(0, 500),
        uiLocale,
      );
    }
    novelPrompt = pitch ?? extractComicCreativePitch(novelContent, input.creativePrompt).slice(0, 400);
    actualNovelId = null;
  } else if (fromNovel) {
    throw new ComicGenerateError("novelNotFound", 404);
  } else {
    throw new ComicGenerateError("needNovelOrContent", 400);
  }

  return {
    novelTitle,
    novelContent,
    novelSummary,
    novelPrompt,
    actualNovelId: actualNovelId,
    novelLengthTier,
    novelMeta,
    creativeExpanded,
  };
}

export async function runComicGeneration(
  input: ComicGenerateRunInput,
  emit?: ComicStreamEmitter,
): Promise<ComicGenerateRunResult> {
  const send = emit ?? (() => {});
  const uiLocale = input.uiLocale ?? "zh-Hans";
  const sourceMode = resolveComicPipelineMode(input);

  const resolved = await resolveComicGenerateNovel(input);
  const {
    novelTitle,
    novelSummary,
    actualNovelId,
    novelLengthTier,
    novelMeta,
    creativeExpanded,
  } = resolved;
  let { novelContent, novelPrompt } = resolved;

  if (creativeExpanded) {
    send({
      step: "creative_expand",
      message: progressComicMessage(uiLocale, comicCreativeExpandKey(sourceMode)),
    });
  }

  const creativePitch = extractComicCreativePitch(
    novelContent,
    input.creativePrompt ?? (novelPrompt.trim().length >= 2 ? novelPrompt : undefined),
  );

  let inheritedBrief = input.creativeBrief;
  if (!inheritedBrief && actualNovelId) {
    if (isChildrenNovelTier(novelLengthTier)) {
      inheritedBrief = (await loadChildrenCreativeBrief(actualNovelId)) ?? undefined;
    }
    if (!inheritedBrief) {
      inheritedBrief = (await loadNovelCreativeBrief(actualNovelId)) ?? undefined;
    }
  }

  let comicBriefJson: string | null = null;
  const skipStandaloneBrief = shouldSkipStandaloneComicBrief({
    sourceMode,
    contentLength: novelContent.length,
    hasInheritedBrief: Boolean(inheritedBrief),
    hasUserBrief: Boolean(input.creativeBrief),
  });
  const skipBriefExpand = shouldSkipComicBriefExpand({
    sourceMode,
    actualNovelId,
    hasBriefRevision: Boolean(input.briefRevision),
    skipStandaloneBrief,
  });

  if (
    PRODUCT.comic.creativeBriefExpand &&
    creativePitch.length >= 2 &&
    !skipBriefExpand
  ) {
    const childrenMeta =
      isChildrenNovelTier(novelLengthTier) && actualNovelId
        ? await loadChildrenNovelMeta(actualNovelId)
        : null;
    const preParsed = inheritedBrief
      ? parseChildrenCreativeBrief(inheritedBrief) ??
        parseNovelCreativeBrief(inheritedBrief)
      : null;
    const briefResult = await resolveMediaCreativeBrief(creativePitch, "comic", {
      preExpanded: preParsed ?? undefined,
      userRevision: input.briefRevision ?? undefined,
      novelGenreId: isChildrenNovelTier(novelLengthTier) ? "children" : undefined,
      childrenTargetAge: childrenMeta?.targetAge,
    });
    if (briefResult) {
      comicBriefJson =
        briefResult.kind === "children"
          ? serializeChildrenCreativeBrief(briefResult.brief)
          : serializeNovelCreativeBrief(briefResult.brief);
      send({
        step: "brief",
        summary: briefResult.oneLineSummary,
        brief: briefResult.brief,
      });
      novelPrompt = briefResult.augmentedPrompt;
    }
  }

  const fullContentLength = novelContent.length;
  const comicScopeOpts = { isChildren: isChildrenNovelTier(novelLengthTier), uiLocale };
  const fullNovelContent = novelContent;
  const effectiveChapterScope = resolveChapterScopeForComicGenerate(sourceMode, input.chapterScope);
  const scoped = sliceNovelByChapterScope(novelContent, effectiveChapterScope, comicScopeOpts);
  novelContent = scoped.content;
  const chapterScopeLabel = scoped.scopeLabel;
  const progressScope =
    comicProgressScopeKey(sourceMode) != null
      ? progressComicMessage(uiLocale, comicProgressScopeKey(sourceMode)!)
      : chapterScopeLabel;

  const pageCount = resolvePageCountForChapterScope({
    fullContentLength,
    scopedContentLength: novelContent.length,
    lengthTier: novelLengthTier,
    pageCount: input.pageCount,
  });
  const genreFromPrompt = inferNovelGenreTagFromStoredPrompt(novelPrompt);
  const storyGenre = resolveNovelCoverGenre({
    genreTagCoverGenre: genreFromPrompt?.coverGenre,
    title: novelTitle,
    summary: novelSummary,
    prompt: novelPrompt,
    contentSnippet: novelContent.slice(0, 1200),
  });
  const outputLocale = resolveComicOutputLocale(novelPrompt, novelContent);
  const layoutId = resolveComicLayoutForLocale(
    resolveComicLayoutId({
      lengthTier: novelLengthTier,
      layoutId: (input.layoutId as ComicLayoutId | undefined) ?? null,
    }),
    outputLocale,
    pageCount,
  );
  const storyboardChunkSize = resolveStoryboardChunkPagesForTier(
    novelLengthTier,
    outputLocale,
    PRODUCT.comic.storyboardChunkPages,
  );
  const panelsPerPage = panelsPerPageForLayout(layoutId);
  const stylePreset = resolveComicStylePreset({
    preset: input.stylePreset,
    genre: storyGenre,
    lengthTier: novelLengthTier,
  });
  const readMode: ComicReadMode = input.readMode === "full" ? "full" : "segment";

  send({
    step: "start",
    message: progressComicMessage(uiLocale, comicProgressStartKey(sourceMode), {
      scope: progressScope,
      readMode: progressComicMessage(
        uiLocale,
        readMode === "full" ? "readModeFull" : "readModeSegment",
      ),
      pages: pageCount,
    }),
    pageCount,
    stylePreset,
    readMode,
    chapterScopeLabel: progressScope,
  });

  const storageTitle = formatComicStorageTitle(novelTitle, novelContent.slice(0, 300), uiLocale);
  const checkpointScope = effectiveChapterScope;
  let draftComicId: string | undefined = input.resumeComicId;
  let existingPages: ComicPage[] | undefined;
  let existingDirector: ComicDirectorPack | null | undefined;
  let startChunkIndex = 0;

  const draftMatchesCurrentRun = (doc: ReturnType<typeof parseComicImageUrls>) => {
    const docLayout = doc.layoutId;
    if (docLayout && docLayout !== layoutId) return false;
    if (doc.director && !shouldUseLongComicPipeline(pageCount, novelLengthTier, outputLocale, {
      forceLightStoryboard: input.forceLightStoryboard === true,
    })) {
      return false;
    }
    return true;
  };

  if (draftComicId) {
    const row = await prisma.comic.findUnique({ where: { id: draftComicId } });
    if (
      row &&
      row.ownerKey === input.ownerKey &&
      row.status === COMIC_STATUS_DRAFT_STORYBOARD
    ) {
      const doc = parseComicImageUrls(row.imageUrls);
      if (draftMatchesCurrentRun(doc)) {
        existingPages = doc.pages;
        existingDirector = doc.director ?? null;
        startChunkIndex = resumeChunkIndexFromDoc(doc, {
          chunkSize: storyboardChunkSize,
          pageCount,
        });
        send({
          step: "resume_found",
          message: progressComicMessage(uiLocale, "resumeDraft", { pages: existingPages.length }),
          comicId: draftComicId,
        });
      } else {
        draftComicId = undefined;
      }
    } else {
      draftComicId = undefined;
    }
  }
  if (!draftComicId) {
    const found = await findDraftStoryboardComic(
      input.ownerKey,
      actualNovelId,
      checkpointScope,
    );
    if (found && draftMatchesCurrentRun(found.doc)) {
      draftComicId = found.id;
      existingPages = found.doc.pages;
      existingDirector = found.doc.director ?? null;
      startChunkIndex = resumeChunkIndexFromDoc(found.doc, {
        chunkSize: storyboardChunkSize,
        pageCount,
      });
      send({
        step: "resume_found",
        message: progressComicMessage(uiLocale, "resumeFromBatch", { start: startChunkIndex + 1 }),
        comicId: draftComicId,
      });
    }
  }

  const onChunkCheckpoint = async (ev: ComicChunkCheckpoint) => {
    // P1 修复：checkpoint 时使用 gen 返回的 director（若已有），避免续跑时 director 丢失
    const checkpointDirector = gen?.director ?? existingDirector ?? null;
    const partialDoc = buildPartialComicDoc({
      pages: ev.pages,
      stylePreset,
      layoutId,
      readMode,
      chapterScopeLabel,
      chapterScope: checkpointScope,
      director: checkpointDirector,
      progress: { chunkIndex: ev.chunkIndex, chunkCount: ev.chunkCount, phase: "storyboard" },
    });
    draftComicId = await upsertStoryboardDraftComic({
      comicId: draftComicId,
      ownerKey: input.ownerKey,
      novelId: actualNovelId,
      title: storageTitle,
      prompt: novelContent.slice(0, 200),
      doc: partialDoc,
    });
    send({
      step: "checkpoint_saved",
      message: progressComicMessage(uiLocale, "checkpointSaved", {
        index: ev.chunkIndex,
        total: ev.chunkCount,
      }),
      comicId: draftComicId,
      pagesSoFar: ev.pages.length,
    });
  };

  const cascade = getComicStoryboardModelCascade();
  let gen = null as Awaited<ReturnType<typeof generateComicPages>> | null;
  let lastError = "";

  let effectiveCharacterRoster = input.characterRoster ?? null;
  if (actualNovelId) {
    const serverRoster = await loadNovelCharacterRoster(actualNovelId);
    effectiveCharacterRoster = mergeCharacterRosterReferenceUrls(
      effectiveCharacterRoster,
      serverRoster,
    );
  }

  for (const model of cascade) {
    send({ step: "model_start", model });
    // 关键修复：cascade retry 时从 DB checkpoint 恢复，不让前模型已生成内容丢弃
    // model A 可能在 chunk 2 失败但已 checkpoint 了 chunk 0-1，model B 应从 chunk 2 继续
    if (draftComicId) {
      const refreshRow = await prisma.comic.findUnique({ where: { id: draftComicId } });
      if (refreshRow && refreshRow.status === COMIC_STATUS_DRAFT_STORYBOARD) {
        const refreshDoc = parseComicImageUrls(refreshRow.imageUrls);
        if (draftMatchesCurrentRun(refreshDoc) && refreshDoc.pages.length > 0) {
          existingPages = refreshDoc.pages;
          existingDirector = refreshDoc.director ?? existingDirector ?? null;
          startChunkIndex = resumeChunkIndexFromDoc(refreshDoc, {
            chunkSize: storyboardChunkSize,
            pageCount,
          });
          send({
            step: "resume_found",
            message: progressComicMessage(uiLocale, "resumeFromBatch", { start: startChunkIndex + 1 }),
            comicId: draftComicId,
          });
        }
      }
    }
    try {
      gen = await generateComicPages({
        novelTitle,
        novelPrompt,
        novelSummary,
        novelContent,
        fullNovelContent,
        scopedChapters: scoped.chapters,
        pageCount,
        storyGenre,
        stylePreset,
        readMode,
        layoutId,
        characterRoster: effectiveCharacterRoster,
        lengthTier: novelLengthTier,
        novelMeta,
        model,
        uiLocale,
        emit: send,
        existingPages,
        existingDirector,
        startChunkIndex,
        onChunkCheckpoint,
        forceLightStoryboard: input.forceLightStoryboard === true,
      });
      break;
    } catch (e) {
      lastError = resolveComicRunErrorMessage(uiLocale, e);
      send({ step: "model_error", model, message: lastError });
    }
  }

  if (!gen) {
    throw new ComicGenerationRunError("storyboardFailed");
  }

  let pages = gen.pages;
  const segments = splitNovelIntoSegments(novelContent, 24, outputLocale);
  if (segments.length > 0) {
    pages = enrichPagesFromNovelSegments(pages, segments);
  }
  if (comicPagesAreAllPlaceholders(pages)) {
    throw new ComicGenerationRunError("storyboardPlaceholder");
  }

  const textFilled = ensureComicPanelsHaveReadableText(pages);
  if (textFilled > 0) {
    send({
      step: "text_fill",
      message: progressComicMessage(uiLocale, "textFilled", { count: textFilled }),
    });
  }

  const panelCount = pages.reduce((n, p) => n + p.panels.length, 0);
  if (pages.length < 1 || panelCount < panelsPerPage) {
    throw new ComicGenerationRunError("storyboardExtractFailed");
  }

  const defaultInlineMax = PRODUCT.comic.inlinePanelMaxCount ?? 16;
  const inlineMax =
    novelLengthTier === "short" && panelCount <= 12 ? panelCount : defaultInlineMax;
  const skipInlinePanels = panelCount > inlineMax;
  let rendered = 0;
  let imageSource = "none";

  // Character Sheet First：优先复用 roster 已有 referenceImageUrl，仅对缺失角色生成
  let charSheetUrls: string[] = [];
  const rosterForSheets =
    mergeCharacterRosterReferenceUrls(gen.characterRoster, effectiveCharacterRoster) ??
    gen.characterRoster ??
    effectiveCharacterRoster;
  charSheetUrls = collectCharacterSheetUrls(rosterForSheets);

  const charSubjects =
    gen.director?.characters?.length
      ? gen.director.characters.map((c) => ({
          id: c.id,
          name: c.name,
          visualDesc: [c.appearanceEn, c.outfitEn, c.hairEn].filter(Boolean).join(", "),
        }))
      : rosterForSheets?.characters?.length
        ? rosterForSheets.characters.map((c) => ({
            id: c.id,
            name: c.name,
            visualDesc: [c.appearanceZh, c.outfitZh, c.notes].filter(Boolean).join(", "),
          }))
        : [];

  const rosterRefById = new Map(
    (rosterForSheets?.characters ?? [])
      .filter((c) => c.referenceImageUrl?.trim())
      .map((c) => [c.id, c.referenceImageUrl!.trim()]),
  );
  const needGenerate = charSubjects.filter((s) => !rosterRefById.has(s.id));
  const willRenderPanelsInline = !skipInlinePanels;

  if (charSubjects.length > 0) {
    if (charSheetUrls.length > 0) {
      send({
        step: "char_sheets_reuse",
        message: progressComicMessage(uiLocale, "charSheetReuse", {
          ready: charSheetUrls.length,
          total: charSubjects.length,
        }),
        charSheetUrls,
      });
    }
    if (!willRenderPanelsInline) {
      send({
        step: "char_sheets_deferred",
        message: progressComicMessage(uiLocale, "charSheetDeferred"),
      });
    } else if (input.skipCharSheets) {
      send({
        step: "char_sheets_skip",
        message: progressComicMessage(uiLocale, "charSheetSkip"),
      });
    } else if (needGenerate.length > 0) {
      send({
        step: "char_sheets_start",
        message: progressComicMessage(uiLocale, "charSheetStart", { count: needGenerate.length }),
      });
      // P0 修复：character sheet 生成失败不阻塞主 pipeline（角色表是可选的）
      let sheets: Awaited<ReturnType<typeof generateCharacterSheets>>;
      try {
        sheets = await generateCharacterSheets({
          subjects: needGenerate,
          stylePreset,
          comicKey: draftComicId ?? actualNovelId ?? `standalone-${storageTitle.slice(0, 24)}`,
          uiLocale,
          timeoutMs: input.charSheetTimeoutMs ?? PRODUCT.comic.charSheetTimeoutMs,
        });
      } catch (sheetErr) {
        send({
          step: "char_sheets_failed",
          message: `角色表生成失败（不影响分镜）：${sheetErr instanceof Error ? sheetErr.message : String(sheetErr)}`,
        });
        sheets = [];
      }
      const newUrls = sheets.filter((s) => s.url).map((s) => s.url!);
      charSheetUrls = [...charSheetUrls, ...newUrls];
      if (rosterForSheets && newUrls.length > 0) {
        effectiveCharacterRoster = applyCharacterSheetUrlsToRoster(rosterForSheets, sheets);
      }
      if (newUrls.length > 0) {
        send({
          step: "char_sheets_done",
          message: progressComicMessage(uiLocale, "charSheetReady", {
            ready: charSheetUrls.length,
            total: charSubjects.length,
          }),
          charSheetUrls,
        });
      }
    }
  }

  const finalCharacterRoster =
    effectiveCharacterRoster ?? rosterForSheets ?? gen.characterRoster ?? null;

  const comicDoc = {
    formatVersion: gen.director ? 3 : 2,
    pageCount: pages.length,
    pages,
    stylePreset,
    layoutId,
    readMode,
    chapterScopeLabel,
    ...(checkpointScope ? { chapterScope: checkpointScope } : {}),
    ...(finalCharacterRoster ? { characterRoster: finalCharacterRoster } : {}),
    ...(gen.plotDigest ? { plotDigest: gen.plotDigest } : {}),
    ...(gen.adaptationBlueprint ? { adaptationBlueprint: gen.adaptationBlueprint } : {}),
    ...(gen.director ? { director: gen.director, pipeline: gen.pipeline } : { pipeline: gen.pipeline }),
    storyboardSource: gen.storyboardSource,
    ...(charSheetUrls.length ? { characterSheetUrls: charSheetUrls } : {}),
  };

  if (!skipInlinePanels) {
    send({
      step: "panels_render_start",
      message: progressComicMessage(uiLocale, "panelsRenderStart", { count: panelCount }),
      panelCount,
    });
    const renderResult = await renderComicPanels(comicDoc, {
      onlyMissing: false,
      storyGenre,
      storyContext: {
        title: novelTitle,
        summary: novelSummary || novelContent.slice(0, 400).replace(/\n/g, " "),
      },
      skipStyleRefs: charSheetUrls.length === 0,
      director: gen.director,
      characterSheetUrls: charSheetUrls,
      onProgress: (ev) => {
        if (ev.type === "panel_start") {
          send({
            step: "panels_render_progress",
            index: ev.index,
            total: ev.total,
            message: progressComicMessage(uiLocale, "panelProgress", {
              index: ev.index,
              total: ev.total,
            }),
          });
        }
        if (ev.type === "panel_done") {
          send({
            step: "panels_render_progress",
            index: ev.index,
            total: ev.total,
            ok: ev.ok,
            withImage: ev.withImage,
            message: ev.ok
              ? progressComicMessage(uiLocale, "panelBatchDone", {
                  done: ev.withImage,
                  total: ev.total,
                })
              : ev.error,
          });
          // P0 修复：每格渲染完成立即 DB 保存，防中途崩溃丢失已渲染 panel
          if (draftComicId && ev.imageUrls) {
            void prisma.comic.update({
              where: { id: draftComicId },
              data: {
                imageUrls: ev.imageUrls,
                status: ev.withImage > 0 ? "ready" : "draft_storyboard",
              },
            }).catch(() => {});
          }
        }
      },
    });
    Object.assign(comicDoc, renderResult.doc);
    rendered = renderResult.rendered;
    imageSource = renderResult.imageSource;
  } else {
    send({
      step: "panels_render_start",
      message: progressComicMessage(
        uiLocale,
        charSheetUrls.length > 0 ? "panelsDeferredWithSheets" : "panelsDeferred",
        { count: panelCount },
      ),
      panelCount,
      deferred: true,
      charSheetUrls,
    });
  }

  send({ step: "save_start", message: progressComicMessage(uiLocale, "saveStart") });
  const imageUrls = serializeComicPanels(comicDoc);
  const finalStatus = rendered > 0 ? "ready" : "pending_images";

  let comicId: string;
  if (draftComicId) {
    await prisma.comic.update({
      where: { id: draftComicId },
      data: {
        title: storageTitle,
        prompt: novelContent.slice(0, 200),
        imageUrls,
        status: finalStatus,
      },
    });
    comicId = draftComicId;
  } else {
    const created = await prisma.comic.create({
      data: {
        ownerKey: input.ownerKey,
        novelId: actualNovelId,
        title: storageTitle,
        prompt: novelContent.slice(0, 200),
        imageUrls,
        status: finalStatus,
        visibility: defaultWorkVisibility(),
      },
    });
    comicId = created.id;
  }

  if (comicBriefJson) {
    await saveComicCreativeBriefJson(comicId, comicBriefJson);
    if (actualNovelId) {
      await saveNovelCreativeBriefJson(actualNovelId, comicBriefJson);
    }
  }

  send({ step: "cover_start", message: progressComicMessage(uiLocale, "coverStart") });
  void ensureComicCoverAfterCreate(
    comicId,
    storageTitle,
    novelSummary || novelContent.slice(0, 400).replace(/\n/g, " "),
    novelContent.slice(0, 800),
    600_000,
    storyGenre,
  ).catch((e) => {
    if (process.env.GENERATE_STRUCTURED_LOG === "1") {
      console.warn("[comic] cover async failed", comicId, e);
    }
  });

  const consistencyNote =
    gen.consistencyIssues.length > 0
      ? formatComicConsistencyIssues(gen.consistencyIssues)
      : undefined;

  const needsPanelRender = skipInlinePanels || rendered < panelCount;
  const imagesWarning = needsPanelRender
    ? progressComicMessage(
        uiLocale,
        charSheetUrls.length > 0 ? "panelsDeferredWithSheets" : "panelsDeferred",
        { count: panelCount },
      )
    : undefined;

  return {
    comicId,
    pageCount: pages.length,
    panelCount,
    panelsRendered: rendered,
    pipeline: gen.pipeline,
    storyboardSource: gen.storyboardSource,
    needsPanelRender,
    imagesWarning,
    consistencyWarnings: consistencyNote,
    provider: gen.provider,
    model: gen.model,
    imageSource,
  };
}
