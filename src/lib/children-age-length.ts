/** 儿童短篇目标读者年龄（2 = 3岁以下） */
export type ChildrenTargetAge = 2 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const CHILDREN_AGE_LENGTH_OPTIONS: {
  age: ChildrenTargetAge;
  label: string;
  maxChars: number;
}[] = [
  { age: 2, label: "3岁以下", maxChars: 200 },
  { age: 4, label: "4岁", maxChars: 300 },
  { age: 5, label: "5岁", maxChars: 400 },
  { age: 6, label: "6岁", maxChars: 500 },
  { age: 7, label: "7岁", maxChars: 600 },
  { age: 8, label: "8岁", maxChars: 700 },
  { age: 9, label: "9岁", maxChars: 800 },
  { age: 10, label: "10岁", maxChars: 900 },
];

export const CHILDREN_CHARS_MIN = 200;
export const CHILDREN_CHARS_MAX = 900;

const BY_AGE = new Map(CHILDREN_AGE_LENGTH_OPTIONS.map((o) => [o.age, o]));

export const DEFAULT_CHILDREN_TARGET_AGE: ChildrenTargetAge = 5;

export function parseChildrenTargetAge(raw: unknown): ChildrenTargetAge {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (BY_AGE.has(n as ChildrenTargetAge)) return n as ChildrenTargetAge;
  return DEFAULT_CHILDREN_TARGET_AGE;
}

export function childrenMaxCharsForAge(age: ChildrenTargetAge): number {
  return BY_AGE.get(age)?.maxChars ?? 400;
}

export function childrenAgeLabel(age: ChildrenTargetAge): string {
  return BY_AGE.get(age)?.label ?? "5岁";
}

/** 生成侧最低可接受字数（目标上限 −50 字浮动，且不低于 100） */
export function childrenMinAcceptCharsForAge(age: ChildrenTargetAge): number {
  const max = childrenMaxCharsForAge(age);
  return Math.max(100, max - 50);
}

export function childrenChapterHintForAge(age: ChildrenTargetAge, maxChars: number): string {
  const chapters = maxChars <= 300 ? "1–2" : "2–3";
  return `${chapters} 章，全文约 ${maxChars} 字以内，语言难度贴合${childrenAgeLabel(age)}`;
}
