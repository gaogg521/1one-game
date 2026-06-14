type DayPoint = { date: string; value: number };

/** 趋势图 Y 轴上限：单日异常峰值不压扁其余柱形 */
export function chartScaleMax(points: DayPoint[]): number {
  const vals = points.map((p) => p.value).filter((v) => v > 0);
  if (vals.length === 0) return 1;

  const sorted = [...vals].sort((a, b) => a - b);
  const rawMax = sorted[sorted.length - 1]!;
  if (vals.length < 3) return Math.max(rawMax, 1);

  const prevMax = sorted[sorted.length - 2] ?? rawMax;
  if (rawMax > prevMax * 2) {
    return Math.max(Math.ceil(prevMax * 1.25), 1);
  }
  return Math.max(rawMax, 1);
}
