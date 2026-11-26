export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface LineBoxes {
  h: { left: number; top: number; width: number };
  v: { left: number; top: number; height: number };
}

/** Lines are 1 CSS px thick; offsetting by half centres them on the pointer. */
const HALF_LINE = 0.5;

/** Index of the page containing `p` (edges inclusive), or -1. */
export function findPageIndex(pages: readonly Rect[], p: Point): number {
  return pages.findIndex(
    (r) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom,
  );
}

export function clampToRect(r: Rect, p: Point): Point {
  return {
    x: Math.min(Math.max(p.x, r.left), r.right),
    y: Math.min(Math.max(p.y, r.top), r.bottom),
  };
}

/** Boxes for a horizontal and vertical line through `p`, spanning `page`. */
export function lineBoxes(page: Rect, p: Point): LineBoxes {
  const c = clampToRect(page, p);
  return {
    h: { left: page.left, top: c.y - HALF_LINE, width: page.right - page.left },
    v: { left: c.x - HALF_LINE, top: page.top, height: page.bottom - page.top },
  };
}
