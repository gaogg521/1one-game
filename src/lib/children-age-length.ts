/**
 * 儿童短篇五档读者年龄（API/DB 用数字码，见 parseChildrenTargetAge 兼容旧值）
 * - 2：0-3 岁
 * - 4：3-6 岁
 * - 7：6-8 岁
 * - 9：9 岁
 * - 10：10 岁
 */
export type ChildrenTargetAge = 2 | 4 | 7 | 9 | 10;

export type ChildrenAgeTierId =
  | "infant_0_3"
  | "kindergarten_3_6"
  | "primary_6_8"
  | "grade_9"
  | "grade_10";

export type ChildrenAgeTier = {
  age: ChildrenTargetAge;
  tierId: ChildrenAgeTierId;
  label: string;
  stage: string;
  minChars: number;
  maxChars: number;
  /** 生成 prompt 主推字数 */
  targetChars: number;
  charRangeLabel: string;
  features: string;
  interpretMark: string;
  bodyMark: string;
  closingMark: string;
  interpretationMax: number;
  closingMax: number;
};

export const CHILDREN_AGE_TIERS: ChildrenAgeTier[] = [
  {
    age: 2,
    tierId: "infant_0_3",
    label: "0-3 岁",
    stage: "婴幼儿启蒙",
    minChars: 90,
    maxChars: 110,
    targetChars: 100,
    charRangeLabel: "90-110 字",
    features: "短句叠词、极简画面、哄睡磨耳朵",
    interpretMark: "【简短创意解读】",
    bodyMark: "【适龄小故事】",
    closingMark: "【一句暖心小寄语】",
    interpretationMax: 80,
    closingMax: 28,
  },
  {
    age: 4,
    tierId: "kindergarten_3_6",
    label: "3-6 岁",
    stage: "幼儿园",
    minChars: 100,
    maxChars: 250,
    targetChars: 180,
    charRangeLabel: "100-250 字",
    features: "童趣可爱、角色简单、浅白道理",
    interpretMark: "【创意解读】",
    bodyMark: "【儿童故事】",
    closingMark: "【启蒙小道理】",
    interpretationMax: 120,
    closingMax: 40,
  },
  {
    age: 7,
    tierId: "primary_6_8",
    label: "6-8 岁",
    stage: "1-2 年级",
    minChars: 300,
    maxChars: 500,
    targetChars: 400,
    charRangeLabel: "300-500 字",
    features: "情节完整、适量好词、低年级阅读",
    interpretMark: "【内容解读】",
    bodyMark: "【成长故事】",
    closingMark: "【成长感悟】",
    interpretationMax: 180,
    closingMax: 60,
  },
  {
    age: 9,
    tierId: "grade_9",
    label: "9 岁",
    stage: "3 年级",
    minChars: 600,
    maxChars: 700,
    targetChars: 650,
    charRangeLabel: "600-700 字",
    features: "叙事流畅、国学常识、写作积累",
    interpretMark: "【典故&创意解读】",
    bodyMark: "【完整故事】",
    closingMark: "【学识感悟】",
    interpretationMax: 280,
    closingMax: 80,
  },
  {
    age: 10,
    tierId: "grade_10",
    label: "10 岁",
    stage: "4 年级",
    minChars: 700,
    maxChars: 900,
    targetChars: 800,
    charRangeLabel: "700-900 字",
    features: "情节饱满、有深度、贴合课内素养",
    interpretMark: "【深度创意解读】",
    bodyMark: "【精品儿童故事】",
    closingMark: "【素养心得】",
    interpretationMax: 360,
    closingMax: 100,
  },
];

/** UI 与配置用（与 CHILDREN_AGE_TIERS 一致） */
export const CHILDREN_AGE_LENGTH_OPTIONS = CHILDREN_AGE_TIERS.map((t) => ({
  age: t.age,
  label: t.label,
  stage: t.stage,
  minChars: t.minChars,
  maxChars: t.maxChars,
  targetChars: t.targetChars,
  charRangeLabel: t.charRangeLabel,
  features: t.features,
}));

export const CHILDREN_CHARS_MIN = 90;
export const CHILDREN_CHARS_MAX = 900;

const BY_AGE = new Map(CHILDREN_AGE_TIERS.map((t) => [t.age, t]));

export const DEFAULT_CHILDREN_TARGET_AGE: ChildrenTargetAge = 4;

/** 兼容旧存档：3→0-3，4/5/6→3-6，7/8→6-8 */
export function parseChildrenTargetAge(raw: unknown): ChildrenTargetAge {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (n === 2 || n === 3) return 2;
  if (n === 4 || n === 5 || n === 6) return 4;
  if (n === 7 || n === 8) return 7;
  if (n === 9) return 9;
  if (n === 10) return 10;
  return DEFAULT_CHILDREN_TARGET_AGE;
}

export function getChildrenAgeTier(age: ChildrenTargetAge): ChildrenAgeTier {
  return BY_AGE.get(age) ?? BY_AGE.get(DEFAULT_CHILDREN_TARGET_AGE)!;
}

export function childrenTierId(age: ChildrenTargetAge): ChildrenAgeTierId {
  return getChildrenAgeTier(age).tierId;
}

export function childrenMaxCharsForAge(age: ChildrenTargetAge): number {
  return getChildrenAgeTier(age).maxChars;
}

export function childrenMinCharsForAge(age: ChildrenTargetAge): number {
  return getChildrenAgeTier(age).minChars;
}

export function childrenTargetCharsForAge(age: ChildrenTargetAge): number {
  return getChildrenAgeTier(age).targetChars;
}

export function childrenAgeLabel(age: ChildrenTargetAge): string {
  return getChildrenAgeTier(age).label;
}

export function childrenStageLabel(age: ChildrenTargetAge): string {
  return getChildrenAgeTier(age).stage;
}

export function childrenCharRangeLabel(age: ChildrenTargetAge): string {
  return getChildrenAgeTier(age).charRangeLabel;
}

export function childrenFeaturesLabel(age: ChildrenTargetAge): string {
  return getChildrenAgeTier(age).features;
}

/** 生成侧最低可接受字数（按档下限，婴幼儿为 90） */
export function childrenMinAcceptCharsForAge(age: ChildrenTargetAge): number {
  return getChildrenAgeTier(age).minChars;
}

export function childrenChapterHintForAge(age: ChildrenTargetAge, maxChars: number): string {
  const tier = getChildrenAgeTier(age);
  if (tier.tierId === "infant_0_3" || tier.tierId === "kindergarten_3_6") {
    return `单篇连贯，不分章，正文 ${tier.charRangeLabel}`;
  }
  if (tier.tierId === "primary_6_8") {
    return `1 篇完整故事（可有起因经过结局），正文 ${tier.charRangeLabel}`;
  }
  const chapters = maxChars <= 700 ? "1–2" : "2–3";
  return `${chapters} 章同一故事线，正文 ${tier.charRangeLabel}`;
}

/** 所有档位成稿标记 + 旧版标记（解析兼容） */
export const CHILDREN_LEGACY_OUTPUT_MARKS = {
  interpret: "【创意/典故深度解读】",
  title: "【故事标题】",
  body: "【正文】",
  closing: "【家长共读】",
} as const;

export function allChildrenInterpretMarks(): string[] {
  return [
    ...CHILDREN_AGE_TIERS.map((t) => t.interpretMark),
    CHILDREN_LEGACY_OUTPUT_MARKS.interpret,
  ];
}

export function allChildrenBodyMarks(): string[] {
  return [...CHILDREN_AGE_TIERS.map((t) => t.bodyMark), CHILDREN_LEGACY_OUTPUT_MARKS.body];
}

export function allChildrenClosingMarks(): string[] {
  return [
    ...CHILDREN_AGE_TIERS.map((t) => t.closingMark),
    CHILDREN_LEGACY_OUTPUT_MARKS.closing,
  ];
}
