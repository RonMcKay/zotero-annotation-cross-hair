import { CrosshairController, type CrosshairDeps } from "./crosshair";
import type { Settings } from "./settings";
import { getViewWindows, isAreaToolActive } from "./tool";

export interface ControllerLike {
  readonly win: Window;
  readonly destroyed: boolean;
  attach(): void;
  refresh(): void;
  destroy(): void;
  onDestroy?: () => void;
}

export type ControllerFactory = (
  win: Window,
  deps: CrosshairDeps,
) => ControllerLike;

const defaultFactory: ControllerFactory = (win, deps) =>
  new CrosshairController(win, deps);

/** Keeps exactly one crosshair controller per live pdf.js view window. */
export class ReaderRegistry {
  private readonly controllers = new Map<Window, ControllerLike>();

  constructor(
    private readonly getSettings: () => Settings,
    private readonly factory: ControllerFactory = defaultFactory,
  ) {}

  get size(): number {
    return this.controllers.size;
  }

  sync(readers: Iterable<unknown>): void {
    const live = new Set<Window>();
    for (const reader of readers) {
      for (const win of getViewWindows(reader)) {
        live.add(win);
        const existing = this.controllers.get(win);
        if (existing) {
          this.safely(() => existing.refresh());
        } else {
          this.add(win, reader);
        }
      }
    }
    for (const [win, controller] of [...this.controllers]) {
      if (!live.has(win)) this.safely(() => controller.destroy());
    }
  }

  refreshAll(): void {
    for (const controller of [...this.controllers.values()]) {
      this.safely(() => controller.refresh());
    }
  }

  destroyAll(): void {
    for (const controller of [...this.controllers.values()]) {
      this.safely(() => controller.destroy());
    }
    this.controllers.clear();
  }

  private add(win: Window, reader: unknown): void {
    const controller = this.factory(win, {
      isToolActive: () => isAreaToolActive(reader),
      getSettings: this.getSettings,
    });
    controller.onDestroy = () => {
      if (this.controllers.get(win) === controller) {
        this.controllers.delete(win);
      }
    };
    this.controllers.set(win, controller);
    this.safely(() => controller.attach());
  }

  private safely(fn: () => void): void {
    try {
      fn();
    } catch {
      // A dead or half-initialised view window must not break the others.
    }
  }
}
