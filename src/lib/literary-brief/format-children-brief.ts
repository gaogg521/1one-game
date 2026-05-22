import {
  CHILDREN_NARRATIVE_MODE_LABELS,
  childrenCoreSubjectFromUserPrompt,
  childrenSourceFidelityBlock,
  resolveChildrenInputKind,
  resolveChildrenNarrativeMode,
} from "@/lib/children-source-fidelity";
import type {
  ChildrenBriefUserRevision,
  ChildrenCreativeBrief,
} from "@/lib/literary-brief/children-brief-types";

export function formatChildrenBriefOneLineSummary(brief: ChildrenCreativeBrief): string {
  const beat = brief.storyBeats[0] ?? "";
  return `${brief.cast}：${beat || brief.interpretation}`.slice(0, 120);
}

export function mergeChildrenBriefRevision(
  brief: ChildrenCreativeBrief,
  rev: ChildrenBriefUserRevision,
): ChildrenCreativeBrief {
  const next = { ...brief };
  if (rev.storyLine?.trim()) {
    const beats = rev.storyLine
      .split(/[；;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (beats.length) next.storyBeats = beats;
  }
  if (rev.addonNotes?.trim()) {
    next.avoid = Array.from(
      new Set([...next.avoid, `用户补充：${rev.addonNotes.trim()}`]),
    ).slice(0, 8);
  }
  return next;
}

export function formatChildrenRevisionBlock(rev: ChildrenBriefUserRevision): string {
  const lines: string[] = ["【用户修订的构思】"];
  if (rev.storyLine?.trim()) lines.push(`- 三句话故事：${rev.storyLine.trim()}`);
  if (rev.addonNotes?.trim()) lines.push(`- 补充：${rev.addonNotes.trim()}`);
  return lines.join("\n");
}

/** 儿童正文生成 pipeline prompt（独立于网文 formatNovelBriefForPipeline） */
export function formatChildrenBriefForPipeline(brief: ChildrenCreativeBrief): string {
  const beats = brief.storyBeats.map((b, i) => `${i + 1}. ${b}`).join("\n");
  const tierNote = `读者档位码 ${brief.targetAge}（见创作页年龄选择）`;
  const narrativeMode = resolveChildrenNarrativeMode(
    brief.userPrompt,
    resolveChildrenInputKind(brief.userPrompt, brief.inputKind),
    brief.targetAge,
    brief.narrativeMode,
  );

  const lines = [
    "【儿童故事构思】",
    brief.title ? `书名：${brief.title}` : "",
    tierNote,
    `叙事模式：${CHILDREN_NARRATIVE_MODE_LABELS[narrativeMode]}`,
    `家长输入：${brief.userPrompt.trim().slice(0, 500)}`,
    "",
    "【创意解读】",
    brief.interpretation,
    "",
    "【角色】",
    brief.cast,
    "",
    "【三句话故事】",
    beats,
    "",
    "【场景】",
    brief.scene,
    "",
    "【结尾寓意】",
    brief.moral,
    "",
    "【写作要求】",
    "- 童真童趣、寓教于乐、浅语暖心",
    "- 严格按该读者档位字数与三块成稿格式",
    "- 一条线、单场景，好朗读；低幼禁止分章",
    (() => {
      const core = childrenCoreSubjectFromUserPrompt(brief.userPrompt);
      const kind = resolveChildrenInputKind(brief.userPrompt, brief.inputKind);
      return core
        ? `- 故事标题须紧扣家长输入（${kind}），核心主题：「${core}」`
        : "";
    })(),
    childrenSourceFidelityBlock(
      brief.userPrompt,
      resolveChildrenInputKind(brief.userPrompt, brief.inputKind),
      brief.targetAge,
      narrativeMode,
    ),
    brief.avoid.length
      ? `\n【别写】\n${brief.avoid.map((a) => `- ${a}`).join("\n")}`
      : "",
  ];

  return lines.filter(Boolean).join("\n").slice(0, 2200);
}

export function buildChildrenPipelinePrompt(
  userPrompt: string,
  brief: ChildrenCreativeBrief,
  rev?: ChildrenBriefUserRevision | null,
): string {
  const merged = rev ? mergeChildrenBriefRevision(brief, rev) : brief;
  const block = formatChildrenBriefForPipeline(merged);
  const revBlock = rev ? formatChildrenRevisionBlock(rev) : "";
  return [userPrompt.trim(), "---", block, revBlock].filter(Boolean).join("\n\n").slice(0, 4000);
}
