import {
  coerceBriefToNarrativeMode,
  defaultStoryBeatsForDirectPlot,
  defaultStoryBeatsForSourceFidelity,
  looksLikeDirectStoryConcept,
  resolveChildrenInputKind,
  resolveChildrenNarrativeMode,
  requiresChildrenSourceFidelity,
  textAlignsWithUserPrompt,
} from "@/lib/children-source-fidelity";
import { getChildrenAgeTier, parseChildrenTargetAge, type ChildrenTargetAge } from "@/lib/children-age-length";
import { CHILDREN_FORBIDDEN_PRESETS } from "@/lib/children-novel-creative";
import type { ChildrenCreativeBrief } from "@/lib/literary-brief/children-brief-types";

const ELDER_PATTERN = /婆婆|奶奶|外婆|姥爷|老师|叔叔|阿姨/;
const HEAVY_PATTERN = /苦|放弃|难受|肚子疼|生病|中毒|流血|乱尝|救/;

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max);
}

function dedupeAvoid(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of [...list, ...CHILDREN_FORBIDDEN_PRESETS]) {
    const t = n.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 10) break;
  }
  return out;
}

/** 低幼档 Brief 强制瘦身（源材料复述模式保留典故人物） */
export function sanitizeChildrenBriefForTier(
  brief: ChildrenCreativeBrief,
  targetAge?: ChildrenTargetAge,
): ChildrenCreativeBrief {
  const age = parseChildrenTargetAge(targetAge ?? brief.targetAge);
  const tier = getChildrenAgeTier(age);
  const inputKind = resolveChildrenInputKind(brief.userPrompt, brief.inputKind);
  const fidelity = requiresChildrenSourceFidelity(inputKind);
  const coerced = coerceBriefToNarrativeMode({
    userPrompt: brief.userPrompt,
    cast: brief.cast,
    storyBeats: brief.storyBeats,
    scene: brief.scene,
    inputKind: brief.inputKind,
    narrativeMode: brief.narrativeMode,
    targetAge: age,
  });
  const narrativeMode = coerced.narrativeMode;
  const isLow = tier.tierId === "infant_0_3" || tier.tierId === "kindergarten_3_6";

  if (!isLow) {
    return {
      ...brief,
      targetAge: age,
      inputKind,
      narrativeMode,
      cast: coerced.cast,
      storyBeats: coerced.storyBeats,
      scene: coerced.scene,
      avoid: dedupeAvoid(
        fidelity
          ? [...brief.avoid, "禁止背离家长输入的主题改写成无关现代故事"]
          : brief.avoid,
      ),
    };
  }

  const maxBeats = tier.tierId === "infant_0_3" ? 2 : 3;
  let cast = coerced.cast;
  if (
    ELDER_PATTERN.test(cast) &&
    !(fidelity && textAlignsWithUserPrompt(cast, brief.userPrompt))
  ) {
    cast = cast.replace(ELDER_PATTERN, "").trim() || coerced.cast;
  }

  const heavyInBeat = (b: string) =>
    HEAVY_PATTERN.test(b) && !(fidelity && textAlignsWithUserPrompt(b, brief.userPrompt));

  let storyBeats = coerced.storyBeats
    .filter((b) => b.trim() && !heavyInBeat(b))
    .slice(0, maxBeats)
    .map((b) => truncate(b, 28));

  const defaultBeats = fidelity
    ? defaultStoryBeatsForSourceFidelity(
        brief.userPrompt,
        maxBeats,
        tier.tierId === "infant_0_3",
        narrativeMode,
      )
    : looksLikeDirectStoryConcept(brief.userPrompt)
      ? defaultStoryBeatsForDirectPlot(
          brief.userPrompt,
          maxBeats,
          tier.tierId === "infant_0_3",
        )
      : tier.tierId === "infant_0_3"
        ? ["暖暖阳光下摸叶子", "和伙伴笑着说晚安"]
        : ["和伙伴完成一件小事", "感受到小小的善意", "遇到困难问大人"];

  while (storyBeats.length < maxBeats) {
    storyBeats.push(defaultBeats[storyBeats.length]!);
  }

  let interpretation = brief.interpretation;
  const interpMax = tier.tierId === "infant_0_3" ? 80 : 100;
  if (
    (HEAVY_PATTERN.test(interpretation) &&
      !(fidelity && textAlignsWithUserPrompt(interpretation, brief.userPrompt))) ||
    interpretation.length > interpMax
  ) {
    interpretation = truncate(
      fidelity
        ? "这是家长说的典故或成语，故事里充满了为大家着想的善意。"
        : "很久很久以前，有人愿意为大家动脑筋做好一件事。",
      interpMax,
    );
  }

  const fidelityAvoid = fidelity
    ? [
        "禁止背离家长输入改题",
        "禁止无关现代郊游式换题",
        narrativeMode === "retelling" ? "禁止现代孩子听完再模仿顶替主角" : "",
        "禁止与输入无关的书名",
      ].filter(Boolean)
    : ["禁止无关路人导师", "禁止强刺激情节", "禁止危险模仿"];

  return {
    ...brief,
    targetAge: age,
    inputKind,
    narrativeMode,
    cast: truncate(cast, 48),
    interpretation,
    storyBeats,
    scene: truncate(coerced.scene.replace(/集市|市场/g, "山野"), 60),
    moral: truncate(
      HEAVY_PATTERN.test(brief.moral) && !fidelity ? "温柔探索，问大人更安全" : brief.moral,
      40,
    ),
    avoid: dedupeAvoid([...brief.avoid, ...fidelityAvoid]),
  };
}
