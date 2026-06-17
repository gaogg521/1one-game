import Phaser from "phaser";

export type AnipopGemKind = "frog" | "hippo" | "fox" | "owl" | "chick";

export const ANIPOP_GEM_KINDS: readonly AnipopGemKind[] = ["frog", "hippo", "fox", "owl", "chick"];

export const ANIPOP_GEM_COLORS = ["#4ade80", "#38bdf8", "#f87171", "#a78bfa", "#facc15"] as const;

export function anipopKindFromColorIndex(index: number): AnipopGemKind {
  return ANIPOP_GEM_KINDS[index % ANIPOP_GEM_KINDS.length] ?? "frog";
}

/** 开心消消乐风格：蓝天 + 绿叶藤蔓边框 */
export function paintAnipopBackdrop(scene: Phaser.Scene, w: number, h: number): void {
  const sky = scene.add.graphics().setDepth(-10);
  sky.fillGradientStyle(0x7dd3fc, 0x7dd3fc, 0x38bdf8, 0x0ea5e9, 1);
  sky.fillRect(0, 0, w, h);

  const clouds = scene.add.graphics().setDepth(-9);
  for (let i = 0; i < 5; i += 1) {
    const cx = w * (0.12 + i * 0.19);
    const cy = 36 + (i % 2) * 18;
    clouds.fillStyle(0xffffff, 0.42);
    clouds.fillEllipse(cx, cy, 72 + i * 8, 22);
    clouds.fillEllipse(cx + 24, cy + 4, 48, 18);
  }

  const leaves = scene.add.graphics().setDepth(-8);
  leaves.fillStyle(0x15803d, 0.55);
  leaves.fillTriangle(0, 0, 90, 0, 0, 70);
  leaves.fillTriangle(w, 0, w - 90, 0, w, 70);
  leaves.lineStyle(5, 0x166534, 0.45);
  leaves.lineBetween(8, 8, w * 0.35, 42);
  leaves.lineBetween(w - 8, 8, w * 0.65, 42);
}

/** 木质棋盘外框 + 深色格子底 */
export function drawAnipopBoardFrame(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  boardW: number,
  boardH: number,
): void {
  const pad = 14;
  gfx.fillStyle(0x92400e, 1);
  gfx.fillRoundedRect(x - pad, y - pad, boardW + pad * 2, boardH + pad * 2, 18);
  gfx.fillStyle(0xb45309, 0.85);
  gfx.fillRoundedRect(x - pad + 4, y - pad + 4, boardW + pad * 2 - 8, boardH + pad * 2 - 8, 14);
  gfx.lineStyle(3, 0xfcd34d, 0.35);
  gfx.strokeRoundedRect(x - pad + 2, y - pad + 2, boardW + pad * 2 - 4, boardH + pad * 2 - 4, 16);

  gfx.fillStyle(0x1e3a5f, 0.92);
  gfx.fillRoundedRect(x, y, boardW, boardH, 10);
  gfx.fillStyle(0x0f2744, 0.55);
  gfx.fillRoundedRect(x + 3, y + 3, boardW - 6, boardH - 6, 8);
}

function drawGemFace(
  gfx: Phaser.GameObjects.Graphics,
  kind: AnipopGemKind,
  cx: number,
  cy: number,
  r: number,
): void {
  const palette: Record<AnipopGemKind, { body: number; dark: number; cheek: number }> = {
    frog: { body: 0x4ade80, dark: 0x16a34a, cheek: 0x86efac },
    hippo: { body: 0x38bdf8, dark: 0x0284c7, cheek: 0x7dd3fc },
    fox: { body: 0xf87171, dark: 0xdc2626, cheek: 0xfca5a5 },
    owl: { body: 0xa78bfa, dark: 0x7c3aed, cheek: 0xc4b5fd },
    chick: { body: 0xfacc15, dark: 0xca8a04, cheek: 0xfde047 },
  };
  const p = palette[kind];

  gfx.fillStyle(0x000000, 0.18);
  gfx.fillEllipse(cx, cy + r * 0.72, r * 1.5, r * 0.42);

  gfx.fillStyle(p.dark, 1);
  gfx.fillCircle(cx, cy + r * 0.06, r * 1.02);
  gfx.fillStyle(p.body, 1);
  gfx.fillCircle(cx, cy - r * 0.04, r * 0.94);

  gfx.fillStyle(0xffffff, 0.9);
  gfx.fillCircle(cx - r * 0.28, cy - r * 0.12, r * 0.22);
  gfx.fillCircle(cx + r * 0.28, cy - r * 0.12, r * 0.22);
  gfx.fillStyle(0x1e293b, 1);
  gfx.fillCircle(cx - r * 0.26, cy - r * 0.1, r * 0.11);
  gfx.fillCircle(cx + r * 0.26, cy - r * 0.1, r * 0.11);
  gfx.fillStyle(0xffffff, 0.85);
  gfx.fillCircle(cx - r * 0.3, cy - r * 0.16, r * 0.05);
  gfx.fillCircle(cx + r * 0.22, cy - r * 0.16, r * 0.05);

  gfx.fillStyle(p.cheek, 0.75);
  gfx.fillCircle(cx - r * 0.48, cy + r * 0.08, r * 0.14);
  gfx.fillCircle(cx + r * 0.48, cy + r * 0.08, r * 0.14);

  if (kind === "frog") {
    gfx.fillStyle(p.dark, 1);
    gfx.fillCircle(cx - r * 0.42, cy - r * 0.52, r * 0.28);
    gfx.fillCircle(cx + r * 0.42, cy - r * 0.52, r * 0.28);
    gfx.fillStyle(0xffffff, 0.8);
    gfx.fillCircle(cx - r * 0.42, cy - r * 0.54, r * 0.1);
    gfx.fillCircle(cx + r * 0.42, cy - r * 0.54, r * 0.1);
  } else if (kind === "fox") {
    gfx.fillStyle(p.dark, 1);
    gfx.fillTriangle(cx - r * 0.55, cy - r * 0.35, cx - r * 0.2, cy - r * 0.95, cx - r * 0.05, cy - r * 0.35);
    gfx.fillTriangle(cx + r * 0.55, cy - r * 0.35, cx + r * 0.2, cy - r * 0.95, cx + r * 0.05, cy - r * 0.35);
  } else if (kind === "owl") {
    gfx.fillStyle(0xfef3c7, 0.9);
    gfx.fillEllipse(cx, cy + r * 0.08, r * 0.42, r * 0.28);
  } else if (kind === "hippo") {
    gfx.fillStyle(0xf8fafc, 0.9);
    gfx.fillRoundedRect(cx - r * 0.34, cy + r * 0.12, r * 0.68, r * 0.22, 4);
  } else {
    gfx.fillStyle(p.dark, 1);
    gfx.fillTriangle(cx - r * 0.2, cy - r * 0.72, cx, cy - r * 1.05, cx + r * 0.2, cy - r * 0.72);
  }

  gfx.lineStyle(2, shiftColor(p.body, -30), 0.45);
  gfx.strokeCircle(cx, cy, r * 0.96);
}

function shiftColor(c: number, d: number): number {
  const r = Phaser.Math.Clamp(((c >> 16) & 0xff) + d, 0, 255);
  const g = Phaser.Math.Clamp(((c >> 8) & 0xff) + d, 0, 255);
  const b = Phaser.Math.Clamp((c & 0xff) + d, 0, 255);
  return (r << 16) | (g << 8) | b;
}

/** 动物宝石块 */
export function drawAnipopGem(
  gfx: Phaser.GameObjects.Graphics,
  kind: AnipopGemKind,
  x: number,
  y: number,
  size: number,
  selected = false,
): void {
  const pad = 4;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = (size - pad * 2) / 2 - 2;

  if (selected) {
    gfx.lineStyle(3, 0xfef08a, 0.95);
    gfx.strokeRoundedRect(x + 2, y + 2, size - 4, size - 4, 10);
    gfx.fillStyle(0xfef08a, 0.15);
    gfx.fillRoundedRect(x + 2, y + 2, size - 4, size - 4, 10);
  }

  drawGemFace(gfx, kind, cx, cy, r);
}

export type AnipopTopBarLayout = {
  levelCx: number;
  levelCy: number;
  movesCx: number;
  movesLabelY: number;
  movesNumY: number;
  objectiveCenters: { score: number; ice: number; chick: number };
  objectiveValueY: number;
};

/** 顶栏：关卡 | 三目标牌 | 步数（单行，无重复进度条/分割线） */
export function drawAnipopTopBar(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  zh: boolean,
): AnipopTopBarLayout {
  gfx.clear();

  gfx.fillStyle(0x14532d, 0.32);
  gfx.fillRect(0, 0, w, 68);

  const levelCx = 46;
  const levelCy = 35;
  gfx.fillStyle(0x92400e, 0.92);
  gfx.fillRoundedRect(10, 12, 72, 46, 10);
  gfx.fillStyle(0xfef3c7, 0.92);
  gfx.fillRoundedRect(14, 16, 64, 38, 8);

  const movesCx = w - 47;
  gfx.fillStyle(0x92400e, 1);
  gfx.fillRoundedRect(w - 84, 12, 74, 46, 12);
  gfx.fillStyle(0xfcd34d, 0.22);
  gfx.fillRoundedRect(w - 80, 16, 66, 38, 10);

  const objectiveCenters = { score: w * 0.3, ice: w * 0.5, chick: w * 0.7 };
  const signs = [
    { x: objectiveCenters.score, label: zh ? "得分" : "Score", color: 0x4ade80 },
    { x: objectiveCenters.ice, label: zh ? "破冰" : "Ice", color: 0x38bdf8 },
    { x: objectiveCenters.chick, label: zh ? "小鸡" : "Chick", color: 0xfacc15 },
  ];
  for (const sign of signs) {
    gfx.fillStyle(0x92400e, 0.95);
    gfx.fillRoundedRect(sign.x - 44, 14, 88, 42, 9);
    gfx.fillStyle(0xfef3c7, 0.92);
    gfx.fillRoundedRect(sign.x - 40, 18, 80, 34, 7);
    gfx.fillStyle(sign.color, 0.28);
    gfx.fillCircle(sign.x - 26, 32, 11);
    gfx.fillStyle(0x78350f, 0.75);
    void sign.label;
  }

  return {
    levelCx,
    levelCy,
    movesCx,
    movesLabelY: 26,
    movesNumY: 42,
    objectiveCenters,
    objectiveValueY: 38,
  };
}

export function anipopHudTexts(
  zh: boolean,
  level: number,
  score: number,
  target: number,
  movesLeft: number,
): { level: string; score: string; moves: string; movesLabel: string } {
  return {
    level: zh ? `第 ${level} 关` : `Lv ${level}`,
    score: `${score}`,
    moves: `${movesLeft}`,
    movesLabel: zh ? "剩余步数" : "Moves",
  };
}

export function anipopSwapHint(zh: boolean): string {
  return zh ? "滑动相邻动物交换，连成 3 个消除" : "Swap adjacent animals to match 3+";
}

/** 棋盘格浅色底纹，提升方块边界可读性 */
export function drawAnipopCellBg(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  shade: boolean,
): void {
  gfx.fillStyle(shade ? 0x1e3a5f : 0x172554, 0.85);
  gfx.fillRoundedRect(x + 1, y + 1, size - 2, size - 2, 6);
}


export type AnipopBoosterId = "hammer" | "shuffle" | "steps";

export const ANIPOP_BOOSTERS: readonly AnipopBoosterId[] = ["hammer", "shuffle", "steps"];

export function anipopBoosterLabel(id: AnipopBoosterId, zh: boolean): string {
  if (id === "hammer") return zh ? "锤子" : "Hammer";
  if (id === "shuffle") return zh ? "重排" : "Shuffle";
  return zh ? "+5步" : "+5";
}

/** 冰块覆盖层（1–2 层） */
export function drawAnipopIceOverlay(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  layers: number,
): void {
  const alpha = layers >= 2 ? 0.82 : 0.62;
  gfx.fillStyle(0xbae6fd, alpha);
  gfx.fillRoundedRect(x + 3, y + 3, size - 6, size - 6, 8);
  gfx.lineStyle(2, 0xffffff, 0.75);
  gfx.strokeRoundedRect(x + 5, y + 5, size - 10, size - 10, 6);
  gfx.lineStyle(1.5, 0x7dd3fc, 0.9);
  gfx.lineBetween(x + 8, y + size * 0.35, x + size - 8, y + size * 0.55);
  gfx.lineBetween(x + size * 0.4, y + 8, x + size * 0.55, y + size - 8);
  if (layers >= 2) {
    gfx.fillStyle(0xffffff, 0.35);
    gfx.fillCircle(x + size * 0.72, y + size * 0.28, size * 0.08);
  }
}

/** 底部道具栏 */
export function drawAnipopBoosterBar(
  gfx: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  counts: Record<AnipopBoosterId, number>,
  armed: AnipopBoosterId | null,
  zh: boolean,
): { id: AnipopBoosterId; x: number; y: number; r: number }[] {
  gfx.clear();
  const barY = h - 58;
  gfx.fillStyle(0x14532d, 0.45);
  gfx.fillRect(0, barY - 18, w, 76);

  const slots: { id: AnipopBoosterId; x: number; y: number; r: number }[] = [];
  const xs = [w * 0.22, w * 0.5, w * 0.78];
  const ids: AnipopBoosterId[] = ["hammer", "shuffle", "steps"];
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]!;
    const cx = xs[i]!;
    const cy = barY + 10;
    const r = 28;
    const active = armed === id;
    const left = counts[id];
    gfx.fillStyle(0x92400e, left > 0 ? 0.95 : 0.45);
    gfx.fillCircle(cx, cy, r);
    gfx.fillStyle(active ? 0xfef08a : 0xfef3c7, left > 0 ? 0.92 : 0.35);
    gfx.fillCircle(cx, cy, r - 4);
    if (id === "hammer") {
      gfx.fillStyle(0x78350f, 1);
      gfx.fillRect(cx - 4, cy - 10, 8, 16);
      gfx.fillRect(cx - 10, cy + 4, 20, 6);
    } else if (id === "shuffle") {
      gfx.lineStyle(3, 0x0284c7, 0.9);
      gfx.strokeCircle(cx, cy, 10);
      gfx.lineBetween(cx - 6, cy - 4, cx + 2, cy - 8);
    } else {
      gfx.fillStyle(0x16a34a, 0.9);
      gfx.fillRoundedRect(cx - 12, cy - 8, 24, 16, 4);
    }
    gfx.fillStyle(0x78350f, 1);
    gfx.fillCircle(cx + 16, cy - 16, 9);
    gfx.fillStyle(0xfef3c7, 1);
    gfx.fillCircle(cx + 16, cy - 16, 7);
    slots.push({ id, x: cx, y: cy, r });
    void anipopBoosterLabel(id, zh);
  }
  return slots;
}

export function hitAnipopBooster(
  slots: readonly { id: AnipopBoosterId; x: number; y: number; r: number }[],
  px: number,
  py: number,
): AnipopBoosterId | null {
  for (const slot of slots) {
    const dx = px - slot.x;
    const dy = py - slot.y;
    if (dx * dx + dy * dy <= (slot.r + 6) * (slot.r + 6)) return slot.id;
  }
  return null;
}


/** 冰块下的特殊块外圈高亮（穿透冰层提示） */
export function drawAnipopIcedSpecialGlow(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  gfx.lineStyle(3, 0xfef08a, 0.92);
  gfx.strokeRoundedRect(x + 5, y + 5, size - 10, size - 10, 9);
  gfx.lineStyle(2, 0xfbbf24, 0.55);
  gfx.strokeCircle(cx, cy, size * 0.44);
  gfx.fillStyle(0xfef08a, 0.85);
  gfx.fillCircle(x + size * 0.18, y + size * 0.2, 3);
  gfx.fillCircle(x + size * 0.82, y + size * 0.24, 3);
}

/** 特殊块标记（四连/五连生成） */
export function drawAnipopSpecialMark(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  kind: "rowClear" | "colClear" | "bomb" | "rainbow",
  underIce = false,
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.28;
  if (underIce) {
    gfx.lineStyle(4, 0xfef08a, 0.95);
    gfx.strokeRoundedRect(x + 4, y + 4, size - 8, size - 8, 9);
  }
  if (kind === "rainbow") {
    const hues = [0xf87171, 0xfacc15, 0x4ade80, 0x38bdf8, 0xa78bfa];
    for (let i = 0; i < hues.length; i += 1) {
      gfx.fillStyle(hues[i]!, underIce ? 1 : 0.85);
      gfx.fillCircle(cx + Math.cos(i * 1.25) * r * 0.5, cy + Math.sin(i * 1.25) * r * 0.5, r * 0.48);
    }
    return;
  }
  if (kind === "bomb") {
    gfx.fillStyle(0xf97316, underIce ? 1 : 0.9);
    gfx.fillCircle(cx, cy, r * 0.85);
    gfx.lineStyle(2, 0xffffff, 0.8);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      gfx.lineBetween(cx, cy, cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
    }
    return;
  }
  const lineW = underIce ? 4 : 3;
  gfx.lineStyle(lineW, kind === "rowClear" ? 0xf472b6 : 0x38bdf8, underIce ? 1 : 0.9);
  if (kind === "rowClear") {
    gfx.lineBetween(x + 6, cy, x + size - 6, cy);
  } else {
    gfx.lineBetween(cx, y + 6, cx, y + size - 6);
  }
}
