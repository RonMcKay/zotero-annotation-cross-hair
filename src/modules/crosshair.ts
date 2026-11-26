import { isDarkBackground } from "./background";
import { findPageIndex, lineBoxes, type Point, type Rect } from "./geometry";
import type { Settings } from "./settings";

export interface CrosshairDeps {
  isToolActive(): boolean;
  getSettings(): Settings;
}

const PREFIX = "annotationcrosshair";
const OVERLAY_ID = `${PREFIX}-overlay`;
const STYLE_ID = `${PREFIX}-style`;
const ACTIVE_CLASS = `${PREFIX}-active`;

// The reader sets `cursor` inline on #viewerContainer. Only its plain
// `default` cursor is replaced, so resize/move cursors over existing
// annotations keep working.
const STYLESHEET = `
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483000;
  overflow: hidden;
}
#${OVERLAY_ID} > div {
  position: absolute;
  pointer-events: none;
}
#${OVERLAY_ID} > .h { height: 1px; }
#${OVERLAY_ID} > .v { width: 1px; }
html.${ACTIVE_CLASS} #viewerContainer[style*="cursor: default"] {
  cursor: crosshair !important;
}
`;

const LISTENER_OPTIONS: AddEventListenerOptions = {
  capture: true,
  passive: true,
};

/**
 * Draws the crosshair inside one pdf.js view window. Pure DOM: it knows
 * nothing about Zotero beyond the two callbacks in `deps`.
 */
export class CrosshairController {
  readonly win: Window;
  onDestroy?: () => void;

  private readonly deps: CrosshairDeps;
  private overlay: HTMLElement | null = null;
  private hLine: HTMLElement | null = null;
  private vLine: HTMLElement | null = null;
  private style: HTMLStyleElement | null = null;
  private darkQuery: MediaQueryList | null = null;
  private lastPoint: Point | null = null;
  private dragPage: number | null = null;
  private _destroyed = false;

  constructor(win: Window, deps: CrosshairDeps) {
    this.win = win;
    this.deps = deps;
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  attach(): void {
    if (this._destroyed || this.overlay) return;
    const doc = this.win.document;
    const root = doc.documentElement;
    if (!root) return;

    this.style = doc.createElement("style");
    this.style.id = STYLE_ID;
    this.style.textContent = STYLESHEET;
    (doc.head ?? root).appendChild(this.style);

    this.overlay = doc.createElement("div");
    this.overlay.id = OVERLAY_ID;
    this.overlay.style.display = "none";
    this.hLine = doc.createElement("div");
    this.hLine.className = "h";
    this.vLine = doc.createElement("div");
    this.vLine.className = "v";
    this.overlay.append(this.hLine, this.vLine);
    (doc.body ?? root).appendChild(this.overlay);

    this.win.addEventListener(
      "pointermove",
      this.onPointerMove,
      LISTENER_OPTIONS,
    );
    this.win.addEventListener(
      "pointerdown",
      this.onPointerDown,
      LISTENER_OPTIONS,
    );
    this.win.addEventListener("pointerup", this.onPointerUp, LISTENER_OPTIONS);
    this.win.addEventListener(
      "pointercancel",
      this.onPointerUp,
      LISTENER_OPTIONS,
    );
    this.win.addEventListener("scroll", this.onRefreshEvent, LISTENER_OPTIONS);
    this.win.addEventListener("keyup", this.onRefreshEvent, LISTENER_OPTIONS);
    this.win.addEventListener("unload", this.onUnload, LISTENER_OPTIONS);
    root.addEventListener(
      "pointerleave",
      this.onPointerLeave,
      LISTENER_OPTIONS,
    );
    try {
      this.darkQuery = this.win.matchMedia("(prefers-color-scheme: dark)");
      this.darkQuery?.addEventListener("change", this.onRefreshEvent);
    } catch {
      this.darkQuery = null;
    }
  }

  /** Re-evaluate visibility and position (tool, settings or layout changed). */
  refresh(): void {
    this.update();
  }

  /** Draws or hides the lines; returns the page index used, or -1. */
  private update(): number {
    if (this._destroyed || !this.overlay || !this.hLine || !this.vLine) {
      return -1;
    }
    const settings = this.deps.getSettings();
    const p = this.lastPoint;
    // Cheap checks first: measuring pages forces layout, and this runs on
    // every pointer move for every tool.
    if (
      !p ||
      !settings.enabled ||
      (this.dragPage === null && !this.inViewport(p)) ||
      !this.safeToolActive()
    ) {
      this.setVisible(false);
      return -1;
    }
    const pages = this.pageRects();
    const pageIndex = this.dragPage ?? findPageIndex(pages, p);
    const page = pages[pageIndex];
    if (!page) {
      this.setVisible(false);
      return -1;
    }
    const { h, v } = lineBoxes(page, p);
    const color = this.pageIsDark() ? settings.colorDark : settings.colorLight;
    Object.assign(this.hLine.style, {
      left: `${h.left}px`,
      top: `${h.top}px`,
      width: `${h.width}px`,
      backgroundColor: color,
    });
    Object.assign(this.vLine.style, {
      left: `${v.left}px`,
      top: `${v.top}px`,
      height: `${v.height}px`,
      backgroundColor: color,
    });
    this.setVisible(true);
    return pageIndex;
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    try {
      this.win.removeEventListener(
        "pointermove",
        this.onPointerMove,
        LISTENER_OPTIONS,
      );
      this.win.removeEventListener(
        "pointerdown",
        this.onPointerDown,
        LISTENER_OPTIONS,
      );
      this.win.removeEventListener(
        "pointerup",
        this.onPointerUp,
        LISTENER_OPTIONS,
      );
      this.win.removeEventListener(
        "pointercancel",
        this.onPointerUp,
        LISTENER_OPTIONS,
      );
      this.win.removeEventListener(
        "scroll",
        this.onRefreshEvent,
        LISTENER_OPTIONS,
      );
      this.win.removeEventListener(
        "keyup",
        this.onRefreshEvent,
        LISTENER_OPTIONS,
      );
      this.win.removeEventListener("unload", this.onUnload, LISTENER_OPTIONS);
      const root = this.win.document?.documentElement;
      root?.removeEventListener(
        "pointerleave",
        this.onPointerLeave,
        LISTENER_OPTIONS,
      );
      root?.classList.remove(ACTIVE_CLASS);
      this.darkQuery?.removeEventListener("change", this.onRefreshEvent);
      this.overlay?.remove();
      this.style?.remove();
    } catch {
      // The window may already be dead (tab closed); nothing left to clean.
    }
    this.overlay = this.hLine = this.vLine = this.style = null;
    this.darkQuery = null;
    this.onDestroy?.();
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    // A drag whose pointerup we never saw (e.g. swallowed by a popup).
    if (this.dragPage !== null && e.buttons === 0) this.dragPage = null;
    this.lastPoint = { x: e.clientX, y: e.clientY };
    this.update();
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.lastPoint = { x: e.clientX, y: e.clientY };
    const index = this.update();
    // Only a primary-button press starts a selection drag.
    this.dragPage = e.button === 0 && index >= 0 ? index : null;
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    this.dragPage = null;
    this.lastPoint = { x: e.clientX, y: e.clientY };
    this.refresh();
  };

  private readonly onPointerLeave = (): void => {
    if (this.dragPage !== null) return;
    this.lastPoint = null;
    this.refresh();
  };

  private readonly onRefreshEvent = (): void => this.refresh();

  private readonly onUnload = (): void => this.destroy();

  private safeToolActive(): boolean {
    try {
      return this.deps.isToolActive();
    } catch {
      return false;
    }
  }

  private pageRects(): Rect[] {
    const pages = this.win.document.querySelectorAll("#viewerContainer .page");
    const rects: Rect[] = [];
    pages.forEach((el: Element) => rects.push(el.getBoundingClientRect()));
    return rects;
  }

  /**
   * Whether the lines sit on a dark page. Newer Zotero sets the page background
   * as `--background-color` on the view's root element (from app mode, the
   * reader theme for that mode and per-reader overrides), so it is the best
   * signal. Zotero 7 has no themes: its viewer CSS darkens pages when the
   * reader's `data-color-scheme` is "dark" or the app prefers dark, unless
   * the body has `disableDarkMode` ("use dark mode for content" is off).
   */
  private pageIsDark(): boolean {
    const doc = this.win.document;
    const root = doc.documentElement as HTMLElement | null;
    const bg = root?.style.getPropertyValue("--background-color") ?? "";
    const fromTheme = isDarkBackground(bg);
    if (fromTheme !== null) return fromTheme;
    const darkScheme =
      root?.dataset.colorScheme === "dark" || !!this.darkQuery?.matches;
    return darkScheme && !doc.body?.classList.contains("disableDarkMode");
  }

  private inViewport(p: Point): boolean {
    return (
      p.x >= 0 &&
      p.y >= 0 &&
      p.x <= this.win.innerWidth &&
      p.y <= this.win.innerHeight
    );
  }

  private setVisible(visible: boolean): void {
    if (!this.overlay) return;
    this.overlay.style.display = visible ? "" : "none";
    this.win.document.documentElement?.classList.toggle(ACTIVE_CLASS, visible);
  }
}
