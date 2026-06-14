import type { GameSpec } from "@/lib/game-spec";

export type CoasterPathPoint = {
  x: number;
  y: number;
  z: number;
};

export type CoasterMode = "coaster" | "endlessRoad";

export type CoasterBlueprint = {
  mode?: CoasterMode;
  /** 轨道采样点（世界坐标，z 为前进方向） */
  path: CoasterPathPoint[];
  /** 目标圈速（秒），用于 HUD */
  targetTimeSec: number;
  /** 第三人称相机距离 */
  cameraDistance: number;
  /** endlessRoad：目标距离（米） */
  distanceGoal?: number;
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function inferCoasterMode(opts: { prompt?: string; sampleId?: string }): CoasterMode {
  void opts.sampleId;
  const blob = (opts.prompt ?? "").toLowerCase();
  if (/crashy roads|无尽公路|撞车|endless road|swerve/i.test(blob)) return "endlessRoad";
  return "coaster";
}

function buildEndlessRoadPath(length: number): CoasterPathPoint[] {
  const path: CoasterPathPoint[] = [];
  const segments = 80;
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    path.push({
      x: Math.sin(t * Math.PI * 6) * 12,
      y: 0,
      z: t * length,
    });
  }
  return path;
}

/** 从 GameSpec / prompt 生成空中过山车轨道（Phaser 伪 3D 与 Godot Path3D 共用） */
export function buildCoasterBlueprint(opts: {
  prompt?: string;
  spec?: GameSpec;
  sampleId?: string;
}): CoasterBlueprint {
  const hint = opts.prompt ?? opts.spec?.title ?? "coaster";
  const mode = inferCoasterMode({ prompt: hint, sampleId: opts.sampleId });
  const intensity = opts.spec?.director?.intensity ?? 0.62;
  if (mode === "endlessRoad") {
    const length = 920 + Math.round(intensity * 380);
    return {
      mode,
      path: buildEndlessRoadPath(length),
      targetTimeSec: 999,
      cameraDistance: 8,
      distanceGoal: Math.round(750 + intensity * 320),
    };
  }
  const seed = hashSeed(hint);
  const segments = 76 + (seed % 16);
  const path: CoasterPathPoint[] = [];
  const length = 300 + intensity * 240;

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const wave = Math.sin(t * Math.PI * 4 + seed * 0.001) * (18 + intensity * 22);
    const climb = Math.sin(t * Math.PI * 2.2) * (12 + intensity * 28);
    const loop = t > 0.38 && t < 0.48 ? Math.sin((t - 0.38) / 0.1 * Math.PI) * 26 : 0;
    const drop = t > 0.62 && t < 0.72 ? -Math.sin((t - 0.62) / 0.1 * Math.PI) * 34 : 0;
    path.push({
      x: wave + Math.sin(t * Math.PI * 7) * 6,
      y: climb + loop + drop,
      z: t * length,
    });
  }

  const targetTimeSec = Math.round(42 + (1 - intensity) * 18 + (seed % 7));
  const cameraDistance = 6.5 + intensity * 2.5;

  return { mode: "coaster", path, targetTimeSec, cameraDistance };
}

export function coasterPathLength(path: CoasterPathPoint[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return total;
}

/** 按弧长比例 0..1 插值轨道点与切线 */
export function sampleCoasterPath(
  path: CoasterPathPoint[],
  t: number,
): { pos: CoasterPathPoint; tangent: CoasterPathPoint; bank: number } {
  if (path.length < 2) {
    return { pos: { x: 0, y: 0, z: 0 }, tangent: { x: 0, y: 0, z: 1 }, bank: 0 };
  }
  const total = coasterPathLength(path);
  const target = Math.max(0, Math.min(1, t)) * total;
  let acc = 0;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (acc + seg >= target || i === path.length - 1) {
      const local = seg > 0 ? (target - acc) / seg : 0;
      const lt = Math.max(0, Math.min(1, local));
      const pos = {
        x: a.x + (b.x - a.x) * lt,
        y: a.y + (b.y - a.y) * lt,
        z: a.z + (b.z - a.z) * lt,
      };
      const tangent = {
        x: b.x - a.x,
        y: b.y - a.y,
        z: b.z - a.z,
      };
      const len = Math.hypot(tangent.x, tangent.y, tangent.z) || 1;
      tangent.x /= len;
      tangent.y /= len;
      tangent.z /= len;
      const bank = Math.atan2(b.x - a.x, b.z - a.z) * 0.35;
      return { pos, tangent, bank };
    }
    acc += seg;
  }
  const last = path[path.length - 1];
  const prev = path[path.length - 2];
  return {
    pos: last,
    tangent: {
      x: last.x - prev.x,
      y: last.y - prev.y,
      z: last.z - prev.z,
    },
    bank: 0,
  };
}
