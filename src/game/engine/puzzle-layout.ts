export type PuzzleGridLayout = {
  cell: number;
  ox: number;
  oy: number;
};

/** Resolve a board against both dimensions instead of only its width. */
export function resolvePuzzleGridLayout(params: {
  width: number;
  height: number;
  cols: number;
  rows: number;
  anipop: boolean;
}): PuzzleGridLayout {
  const { width, height, cols, rows, anipop } = params;
  const horizontalPadding = anipop ? 48 : 40;
  const topReserved = anipop ? 88 : 76;
  const bottomReserved = anipop ? 104 : 62;
  const maxCell = anipop ? 42 : 48;
  const cell = Math.max(
    30,
    Math.min(maxCell, (width - horizontalPadding) / cols, (height - topReserved - bottomReserved) / rows),
  );
  const ox = (width - cell * cols) / 2;
  const centeredY = (height - cell * rows) / 2 + 12;
  const maxY = height - bottomReserved - cell * rows;
  const oy = Math.max(topReserved, Math.min(centeredY, maxY));
  return { cell, ox, oy };
}
