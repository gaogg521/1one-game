import type { CreativeBrief } from "@/lib/creative-brief/types";
import { parseComicImageUrls, type ComicDocument } from "@/lib/comic-format";
import { parseComicDirectorPack } from "@/lib/comic-director-types";
import {
  buildCreatorQualityReport,
  type CreatorQualityEngagement,
  type CreatorQualityReport,
  type CreatorQualityUnit,
} from "@/lib/creator-workflow";
import { evaluateGameVerticalSlice, type GameVerticalSliceScorecard } from "@/lib/game-vertical-slice";
import type { GameSpec } from "@/lib/game-spec";
import { assessNovelCompleteness } from "@/lib/novel-completeness";
import { parseNovelChapters } from "@/lib/novel-chapters";
import type { NovelLengthTier } from "@/lib/novel-length";
import { checkSegmentConsistency } from "@/lib/novel-long-consistency";
import type { NovelGenerationMeta } from "@/lib/novel-long-pipeline-types";

export type CreatorQualityAssessment = {
  report: CreatorQualityReport;
  scorecard?: GameVerticalSliceScorecard;
};

/** Attach observed consumption signals without recalibrating the static score. */
export function withCreatorEngagementQuality(
  report: CreatorQualityReport,
  engagement: CreatorQualityEngagement,
): CreatorQualityReport {
  const evidence = [
    ...(engagement.reads !== undefined ? [`reads:${engagement.reads}`] : []),
    ...(engagement.likes !== undefined ? [`likes:${engagement.likes}`] : []),
    ...(engagement.starts !== undefined ? [`play_starts:${engagement.starts}`] : []),
    ...(engagement.firstActionRate !== undefined ? [`first_action_rate:${engagement.firstActionRate}%`] : []),
    ...(engagement.firstMinuteRate !== undefined ? [`first_minute_rate:${engagement.firstMinuteRate}%`] : []),
    ...(engagement.retryRate !== undefined ? [`retry_rate:${engagement.retryRate}%`] : []),
    ...(engagement.averageFailureSec !== undefined ? [`average_failure_sec:${engagement.averageFailureSec}`] : []),
    ...(engagement.completed !== undefined ? [`completed_reads:${engagement.completed}`] : []),
    ...(engagement.completionRate !== undefined ? [`completion_rate:${engagement.completionRate}%`] : []),
    ...(engagement.averageProgressRate !== undefined ? [`average_progress_rate:${engagement.averageProgressRate}%`] : []),
    ...(engagement.unitViews !== undefined ? [`unit_views:${engagement.unitViews}`] : []),
  ];
  return { ...report, evidence: [...report.evidence, ...evidence], engagement };
}

/**
 * Convert existing product-line checks into the platform's shared quality
 * envelope. This deliberately reports evidence only; publish routes remain
 * permissive until production thresholds have been calibrated from real data.
 */
export function assessGameCreatorQuality(
  spec: GameSpec,
  brief?: CreativeBrief | null,
): CreatorQualityAssessment {
  const scorecard = evaluateGameVerticalSlice(spec, brief ?? undefined);
  return {
    scorecard,
    report: buildCreatorQualityReport({
      kind: "game",
      score: scorecard.score,
      evidence: [
        `template:${scorecard.templateId}`,
        `first_minute_beats:${scorecard.contract.firstMinute.length}`,
        `art_direction:${scorecard.artDirection.visual.assetStyle}`,
        ...scorecard.reasons,
      ],
    }),
  };
}

function uniqueParagraphRatio(content: string): number {
  const paragraphs = content
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length >= 30);
  if (paragraphs.length === 0) return 0;
  return new Set(paragraphs).size / paragraphs.length;
}

export function assessNovelCreatorQuality(input: {
  content: string;
  prompt: string;
  lengthTier?: string | null;
  generationMeta?: NovelGenerationMeta | null;
}): CreatorQualityAssessment {
  const tier = (input.lengthTier ?? "medium") as NovelLengthTier;
  const content = input.content.trim();
  const chapters = parseNovelChapters(content);
  const completeness = assessNovelCompleteness(content, tier, undefined, input.prompt);
  const firstChapter = chapters[0]?.body.trim() ?? "";
  const lastChapter = chapters.at(-1)?.body.trim() ?? "";
  const paragraphUniqueness = uniqueParagraphRatio(content);
  let score = 0;
  if (content.length >= 800) score += 20;
  if (firstChapter.length >= 300) score += 15;
  if (chapters.length >= (tier === "children" ? 1 : 3)) score += 15;
  if (completeness.ok) score += 35;
  if (lastChapter.length >= 180) score += 10;
  if (paragraphUniqueness >= 0.85) score += 5;

  const evidence = [
    `chapters:${chapters.length}`,
    `opening_chars:${firstChapter.length}`,
    `ending_chars:${lastChapter.length}`,
    `completeness:${completeness.ok ? "passed" : "needs_repair"}`,
    `paragraph_uniqueness:${Math.round(paragraphUniqueness * 100)}%`,
  ];
  if (!completeness.ok) evidence.push(`completeness_reason:${completeness.reason}`);
  if (firstChapter.length < 300) evidence.push("opening_hook_needs_review");
  if (paragraphUniqueness < 0.85) evidence.push("repetition_needs_review");

  const planIssues: string[] = [];
  if (input.generationMeta) {
    const consistency = checkSegmentConsistency({
      bible: input.generationMeta.bible,
      expectedChapters: input.generationMeta.chapterPlan.chapters,
      segmentText: content,
      previousContent: "",
    });
    const materialCodes = new Set([
      "no_chapter_markers",
      "duplicate_chapter_num",
      "chapter_rewind",
      "missing_planned_chapter",
      "unexpected_chapter",
    ]);
    for (const issue of consistency.issues) {
      if (materialCodes.has(issue.code)) planIssues.push(issue.code);
    }
    const chaptersByNum = new Map(chapters.map((chapter) => [chapter.num, chapter]));
    for (const planned of input.generationMeta.chapterPlan.chapters) {
      const actual = chaptersByNum.get(planned.num);
      if (actual && planned.targetChars && actual.body.trim().length < Math.max(100, Math.floor(planned.targetChars * 0.4))) {
        planIssues.push(`planned_chapter_under_target:${planned.num}`);
      }
    }
    evidence.push(
      `story_plan:${planIssues.length === 0 ? "aligned" : "needs_repair"}`,
      ...[...new Set(planIssues)].map((code) => `story_plan_issue:${code}`),
    );
  }

  const units: CreatorQualityUnit[] = chapters.map((chapter, index) => {
    const body = chapter.body.trim();
    const chapterUniqueness = uniqueParagraphRatio(body);
    let chapterScore = 0;
    if (body.length >= 180) chapterScore += 40;
    if (body.length >= 500) chapterScore += 20;
    if (chapter.title.trim().length > 0) chapterScore += 10;
    if (index === 0 && body.length >= 300) chapterScore += 15;
    if (chapterUniqueness >= 0.85) chapterScore += 15;
    const chapterReport = buildCreatorQualityReport({
      kind: "novel",
      score: chapterScore,
      evidence: [
        `chapter_chars:${body.length}`,
        `chapter_uniqueness:${Math.round(chapterUniqueness * 100)}%`,
        ...(index === 0 && body.length < 300 ? ["opening_hook_needs_review"] : []),
        ...(body.length < 180 ? ["chapter_body_needs_expansion"] : []),
      ],
    });
    return { id: `chapter-${chapter.num}`, label: `chapter:${chapter.num}`, ...chapterReport, score: chapterScore };
  });

  const report = buildCreatorQualityReport({ kind: "novel", score, evidence });
  return {
    report: {
      ...report,
      ...(input.generationMeta && planIssues.length > 0 && report.verdict !== "blocked" ? { verdict: "needs_polish" as const } : {}),
      units,
    },
  };
}

type ComicStoryboardIntegrity = {
  structured: boolean;
  ok: boolean;
  evidence: string[];
};

/**
 * Validate only durable storyboard references, never inferred image quality.
 * A long-director comic can be repaired when an author sees an unknown
 * character/location, a missing shot binding, or regressed scene order.
 */
function assessComicStoryboardIntegrity(doc: ComicDocument): ComicStoryboardIntegrity {
  const panels = doc.pages.flatMap((page) => page.panels);
  const director = parseComicDirectorPack(doc.director);
  const hasPanelBindings = panels.some(
    (panel) => panel.characterIds !== undefined || panel.locationId !== undefined || panel.shotType !== undefined,
  );
  const structured = doc.pipeline === "long_director" || Boolean(doc.director) || hasPanelBindings;
  if (!structured) return { structured: false, ok: true, evidence: ["storyboard_integrity:light_pipeline"] };

  const issues: string[] = [];
  if (!director) {
    issues.push("director_pack_invalid");
  } else {
    const characterIds = new Set(director.characters.map((character) => character.id));
    const locationIds = new Set(director.locations.map((location) => location.id));
    const unknownCharacters = new Set<string>();
    const unknownLocations = new Set<string>();
    let missingBindings = 0;
    let previousScene = -1;
    let sceneRegressions = 0;
    let previousShot: string | undefined;
    let sameShotRun = 0;
    let repetitiveShotRuns = 0;

    for (const panel of panels) {
      if (!panel.characterIds || !panel.locationId || !panel.shotType) missingBindings += 1;
      for (const characterId of panel.characterIds ?? []) {
        if (!characterIds.has(characterId)) unknownCharacters.add(characterId);
      }
      if (panel.locationId && !locationIds.has(panel.locationId)) unknownLocations.add(panel.locationId);
      if (panel.scene !== undefined) {
        if (previousScene > panel.scene) sceneRegressions += 1;
        previousScene = panel.scene;
      }
      if (panel.shotType && panel.shotType === previousShot) {
        sameShotRun += 1;
        if (sameShotRun === 4) repetitiveShotRuns += 1;
      } else {
        previousShot = panel.shotType;
        sameShotRun = 1;
      }
    }
    const beatPages = new Set(director.pageBeats.map((beat) => beat.page));
    const missingBeats = doc.pages.filter((page) => !beatPages.has(page.page)).length;
    if (missingBindings) issues.push(`storyboard_binding_missing:${missingBindings}/${panels.length}`);
    if (unknownCharacters.size) issues.push(`storyboard_unknown_characters:${unknownCharacters.size}`);
    if (unknownLocations.size) issues.push(`storyboard_unknown_locations:${unknownLocations.size}`);
    if (missingBeats) issues.push(`storyboard_page_beats_missing:${missingBeats}/${doc.pages.length}`);
    if (sceneRegressions) issues.push(`storyboard_scene_order_regressed:${sceneRegressions}`);
    if (repetitiveShotRuns) issues.push(`storyboard_shot_variety_needs_review:${repetitiveShotRuns}`);
  }

  return {
    structured: true,
    ok: issues.length === 0,
    evidence: ["storyboard_integrity:structured", ...issues],
  };
}

function assessComicDocument(doc: ComicDocument): CreatorQualityReport {
  const panels = doc.pages.flatMap((page) => page.panels);
  const renderedPanels = panels.filter((panel) => Boolean(panel.imageUrl?.trim())).length;
  const readablePanels = panels.filter(
    (panel) => panel.caption.trim().length > 0 && panel.caption.length <= 180 && panel.prompt.trim().length > 0,
  ).length;
  const director = parseComicDirectorPack(doc.director);
  const anchored = Boolean(director || doc.characterRoster?.characters?.length || doc.characterSheetUrls?.length);
  const integrity = assessComicStoryboardIntegrity(doc);
  const hasPageRhythm = doc.pages.length >= 2 || panels.length >= 4;
  let score = 0;
  if (doc.pages.length > 0) score += 20;
  if (panels.length >= 4) score += 15;
  if (readablePanels === panels.length && panels.length > 0) score += 20;
  if (anchored) score += 15;
  if (hasPageRhythm) score += 10;
  if (renderedPanels === panels.length && panels.length > 0) score += 20;

  const evidence = [
    `pages:${doc.pages.length}`,
    `panels:${panels.length}`,
    `rendered_panels:${renderedPanels}/${panels.length}`,
    `readable_panels:${readablePanels}/${panels.length}`,
    `visual_anchors:${anchored ? "present" : "missing"}`,
    ...integrity.evidence,
  ];
  if (!anchored) evidence.push("character_scene_anchor_needs_review");
  if (renderedPanels < panels.length) evidence.push("panel_rendering_incomplete");
  if (readablePanels < panels.length) evidence.push("panel_text_or_prompt_needs_review");
  const report = buildCreatorQualityReport({ kind: "comic", score, evidence });
  if (integrity.structured && !integrity.ok && report.verdict !== "blocked") {
    return { ...report, verdict: "needs_polish" };
  }
  return report;
}

export function assessComicCreatorQuality(rawDocument: string): CreatorQualityAssessment {
  const doc = parseComicImageUrls(rawDocument);
  const report = assessComicDocument(doc);
  const units: CreatorQualityUnit[] = doc.pages.map((page) => {
    const panels = page.panels;
    const rendered = panels.filter((panel) => Boolean(panel.imageUrl?.trim())).length;
    const readable = panels.filter(
      (panel) => panel.caption.trim().length > 0 && panel.caption.length <= 180 && panel.prompt.trim().length > 0,
    ).length;
    let score = 0;
    if (panels.length > 0) score += 25;
    if (panels.length >= 2) score += 20;
    if (readable === panels.length && panels.length > 0) score += 25;
    if (rendered === panels.length && panels.length > 0) score += 30;
    const pageReport = buildCreatorQualityReport({
      kind: "comic",
      score,
      evidence: [
        `page_panels:${panels.length}`,
        `page_rendered_panels:${rendered}/${panels.length}`,
        `page_readable_panels:${readable}/${panels.length}`,
        ...(rendered < panels.length ? ["page_rendering_incomplete"] : []),
        ...(readable < panels.length ? ["page_text_or_prompt_needs_review"] : []),
      ],
    });
    return { id: `page-${page.page}`, label: `page:${page.page}`, ...pageReport, score };
  });
  return { report: { ...report, units } };
}
