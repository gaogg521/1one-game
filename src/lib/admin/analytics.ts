/** 按本地日历日聚合时间序列（运营后台图表用） */

export type DayPoint = { date: string; value: number };

export function buildDayRange(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(toDayKey(d));
  }
  return out;
}

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function countByDay(timestamps: Date[], dayKeys: string[]): DayPoint[] {
  const counts = new Map<string, number>(dayKeys.map((k) => [k, 0]));
  for (const ts of timestamps) {
    const key = toDayKey(ts);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return dayKeys.map((date) => ({ date, value: counts.get(date) ?? 0 }));
}

export function clampDays(raw: string | null, fallback = 14): number {
  const n = parseInt(raw ?? String(fallback), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 1), 90);
}
