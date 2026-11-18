// Pure helpers for dragging photos in a wrapped grid.

/** The list with the item at `from` moved to `to`. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

/** Top-left corner of grid slot `i`. */
export const slotXY = (i: number, cols: number, step: number) => ({ x: (i % cols) * step, y: Math.floor(i / cols) * step });

/** The slot under a tile that started in slot `from` and was moved by (dx, dy). */
export function slotAt(from: number, dx: number, dy: number, cols: number, step: number, count: number) {
  const start = slotXY(from, cols, step);
  const rows = Math.max(1, Math.ceil(count / cols));
  const col = Math.max(0, Math.min(cols - 1, Math.round((start.x + dx) / step)));
  const row = Math.max(0, Math.min(rows - 1, Math.round((start.y + dy) / step)));
  return Math.max(0, Math.min(count - 1, row * cols + col));
}
