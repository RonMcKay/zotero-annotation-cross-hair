import { expect } from "chai";
import { Window as HappyWindow } from "happy-dom";
import { CrosshairController } from "../../src/modules/crosshair";
import type { Rect } from "../../src/modules/geometry";
import type { Settings } from "../../src/modules/settings";

interface Harness {
  win: Window;
  doc: Document;
  pages: HTMLElement[];
  setPageRect(i: number, r: Rect): void;
  state: { tool: boolean; settings: Settings };
  ctrl: CrosshairController;
  move(x: number, y: number): PointerEvent;
  fire(
    type: string,
    x?: number,
    y?: number,
    init?: { button?: number; buttons?: number },
  ): PointerEvent;
  rectReads(): number;
  darkQuery: FakeMediaQueryList;
  overlay(): HTMLElement | null;
  line(cls: "h" | "v"): HTMLElement;
  visible(): boolean;
}

class FakeMediaQueryList {
  matches = false;
  private listeners = new Set<() => void>();
  addEventListener(_type: string, fn: () => void) {
    this.listeners.add(fn);
  }
  removeEventListener(_type: string, fn: () => void) {
    this.listeners.delete(fn);
  }
  get listenerCount() {
    return this.listeners.size;
  }
  set(matches: boolean) {
    this.matches = matches;
    this.listeners.forEach((fn) => fn());
  }
}

function setup(opts: { pageBackground?: string } = {}): Harness {
  const happy = new HappyWindow({ width: 1200, height: 1000 });
  const win = happy as unknown as Window;
  const darkQuery = new FakeMediaQueryList();
  (win as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (
    q: string,
  ) => {
    if (q !== "(prefers-color-scheme: dark)") throw new Error(q);
    return darkQuery;
  };
  const doc = win.document;
  doc.body!.innerHTML = `<div id="viewerContainer" style="cursor: default;"><div class="page"></div><div class="page"></div></div>`;
  if (opts.pageBackground) {
    (doc.documentElement as HTMLElement).style.setProperty(
      "--background-color",
      opts.pageBackground,
    );
  }
  const pages = Array.from(doc.querySelectorAll(".page")) as HTMLElement[];
  const rects: Rect[] = [];
  let rectReads = 0;
  const setPageRect = (i: number, r: Rect) => {
    rects[i] = r;
    pages[i].getBoundingClientRect = () => {
      rectReads++;
      return {
        ...rects[i],
        x: rects[i].left,
        y: rects[i].top,
        width: rects[i].right - rects[i].left,
        height: rects[i].bottom - rects[i].top,
      } as DOMRect;
    };
  };
  setPageRect(0, { left: 0, top: 0, right: 600, bottom: 800 });
  setPageRect(1, { left: 0, top: 810, right: 600, bottom: 1610 });

  const state = {
    tool: true,
    settings: { enabled: true, colorLight: "#666666", colorDark: "#bbbbbb" },
  };
  const ctrl = new CrosshairController(win, {
    isToolActive: () => state.tool,
    getSettings: () => state.settings,
  });
  ctrl.attach();

  const fire = (
    type: string,
    x = 0,
    y = 0,
    init: { button?: number; buttons?: number } = {},
  ) => {
    const PointerEventCtor = (
      win as unknown as { PointerEvent: typeof PointerEvent }
    ).PointerEvent;
    const ev = new PointerEventCtor(type, {
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    doc.getElementById("viewerContainer")!.dispatchEvent(ev);
    return ev;
  };
  const overlay = () =>
    doc.getElementById("annotationcrosshair-overlay") as HTMLElement | null;
  return {
    win,
    doc,
    pages,
    setPageRect,
    rectReads: () => rectReads,
    state,
    ctrl,
    darkQuery,
    fire,
    move: (x, y) => fire("pointermove", x, y),
    overlay,
    line: (cls) => overlay()!.querySelector<HTMLElement>(`.${cls}`)!,
    visible: () => overlay()!.style.display !== "none",
  };
}

function expectColor(el: HTMLElement, hex: string): void {
  const n = parseInt(hex.slice(1), 16);
  const rgb = `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  expect([hex, rgb]).to.include(el.style.backgroundColor);
}

describe("CrosshairController", function () {
  it("inserts one overlay and one stylesheet even if attached twice", function () {
    const t = setup();
    t.ctrl.attach();
    expect(
      t.doc.querySelectorAll("#annotationcrosshair-overlay"),
    ).to.have.length(1);
    expect(t.doc.querySelectorAll("#annotationcrosshair-style")).to.have.length(
      1,
    );
  });

  it("stays hidden while another tool is active", function () {
    const t = setup();
    t.state.tool = false;
    t.move(100, 200);
    expect(t.visible()).to.be.false;
  });

  it("draws page-spanning lines through the pointer", function () {
    const t = setup();
    t.move(100, 200);
    expect(t.visible()).to.be.true;
    const h = t.line("h").style;
    const v = t.line("v").style;
    expect([h.top, h.left, h.width]).to.deep.equal(["199.5px", "0px", "600px"]);
    expect([v.left, v.top, v.height]).to.deep.equal(["99.5px", "0px", "800px"]);
    expect(
      t.doc.documentElement!.classList.contains("annotationcrosshair-active"),
    ).to.be.true;
  });

  it("uses the configured colour", function () {
    const t = setup();
    t.move(100, 200);
    t.state.settings = { ...t.state.settings, colorLight: "#00ff00" };
    t.ctrl.refresh();
    expectColor(t.line("h"), "#00ff00");
    expectColor(t.line("v"), "#00ff00");
  });

  it("uses the light-page colour when nothing says the page is dark", function () {
    const t = setup();
    t.move(100, 200);
    expectColor(t.line("h"), "#666666");
  });

  it("uses the dark-page colour on a dark page background", function () {
    const t = setup({ pageBackground: "#2E3440" });
    t.move(100, 200);
    expectColor(t.line("h"), "#bbbbbb");
    expectColor(t.line("v"), "#bbbbbb");
  });

  it("follows the page, not the app, when they disagree", function () {
    const t = setup({ pageBackground: "#F4ECD8" }); // Sepia in dark mode
    t.darkQuery.set(true);
    t.move(100, 200);
    expectColor(t.line("h"), "#666666");
  });

  it("switches colour when the page background changes", function () {
    const t = setup({ pageBackground: "#FFFFFF" });
    t.move(100, 200);
    (t.doc.documentElement as HTMLElement).style.setProperty(
      "--background-color",
      "#000000",
    );
    t.ctrl.refresh();
    expectColor(t.line("h"), "#bbbbbb");
  });

  it("falls back to the app colour scheme without a page background", function () {
    const t = setup();
    t.darkQuery.set(true);
    t.move(100, 200);
    expectColor(t.line("h"), "#bbbbbb");
  });

  it("uses the dark-page colour for a dark reader scheme without themes (Zotero 7)", function () {
    const t = setup();
    (t.doc.documentElement as HTMLElement).dataset.colorScheme = "dark";
    t.move(100, 200);
    expectColor(t.line("h"), "#bbbbbb");
  });

  it("keeps the light-page colour when dark mode for content is off (Zotero 7)", function () {
    const t = setup();
    (t.doc.documentElement as HTMLElement).dataset.colorScheme = "dark";
    t.doc.body!.classList.add("disableDarkMode");
    t.move(100, 200);
    expectColor(t.line("h"), "#666666");
  });

  it("updates immediately when the app colour scheme changes", function () {
    const t = setup();
    t.move(100, 200);
    expectColor(t.line("h"), "#666666");
    t.darkQuery.set(true);
    expectColor(t.line("h"), "#bbbbbb");
  });

  it("hides in the gap between pages", function () {
    const t = setup();
    t.move(100, 805);
    expect(t.visible()).to.be.false;
    expect(
      t.doc.documentElement!.classList.contains("annotationcrosshair-active"),
    ).to.be.false;
  });

  it("keeps the drag's page and clamps when the pointer leaves it", function () {
    const t = setup();
    t.fire("pointerdown", 100, 700, { button: 0, buttons: 1 });
    t.fire("pointermove", 100, 900, { buttons: 1 });
    expect(t.visible()).to.be.true;
    expect(t.line("h").style.top).to.equal("799.5px");
    expect(t.line("v").style.height).to.equal("800px");
    t.fire("pointerup", 100, 900);
    expect(t.line("v").style.top).to.equal("810px");
  });

  it("follows the page when it scrolls under a still pointer", function () {
    const t = setup();
    t.move(100, 200);
    t.setPageRect(0, { left: 0, top: -100, right: 600, bottom: 700 });
    t.win.dispatchEvent(new t.win.Event("scroll"));
    expect(t.line("v").style.top).to.equal("-100px");
    expect(t.line("v").style.height).to.equal("800px");
  });

  it("hides when disabled in settings", function () {
    const t = setup();
    t.move(100, 200);
    t.state.settings = { ...t.state.settings, enabled: false };
    t.ctrl.refresh();
    expect(t.visible()).to.be.false;
  });

  it("hides when the pointer leaves the document", function () {
    const t = setup();
    t.move(100, 200);
    t.doc.documentElement!.dispatchEvent(new t.win.Event("pointerleave"));
    expect(t.visible()).to.be.false;
  });

  it("never cancels the reader's pointer events", function () {
    const t = setup();
    expect(t.fire("pointerdown", 100, 200).defaultPrevented).to.be.false;
    expect(t.move(110, 210).defaultPrevented).to.be.false;
    expect(t.fire("pointerup", 110, 210).defaultPrevented).to.be.false;
  });

  it("replaces only the reader's default cursor", function () {
    const t = setup();
    const css = t.doc.getElementById("annotationcrosshair-style")!.textContent;
    expect(css).to.contain(
      'html.annotationcrosshair-active #viewerContainer[style*="cursor: default"]',
    );
    expect(css).to.contain("cursor: crosshair !important");
  });

  it("removes everything on destroy and ignores later events", function () {
    const t = setup();
    let destroyed = 0;
    t.ctrl.onDestroy = () => destroyed++;
    t.move(100, 200);
    t.ctrl.destroy();
    t.ctrl.destroy();
    expect(t.overlay()).to.be.null;
    expect(t.doc.getElementById("annotationcrosshair-style")).to.be.null;
    expect(
      t.doc.documentElement!.classList.contains("annotationcrosshair-active"),
    ).to.be.false;
    expect(t.ctrl.destroyed).to.be.true;
    expect(destroyed).to.equal(1);
    expect(t.darkQuery.listenerCount).to.equal(0);
    t.move(120, 220);
    expect(t.overlay()).to.be.null;
  });

  it("does not measure pages while another tool is active", function () {
    const t = setup();
    t.state.tool = false;
    const before = t.rectReads();
    t.move(100, 200);
    t.ctrl.refresh();
    expect(t.rectReads()).to.equal(before);
  });

  it("does not measure pages while disabled", function () {
    const t = setup();
    t.state.settings = { ...t.state.settings, enabled: false };
    const before = t.rectReads();
    t.move(100, 200);
    expect(t.rectReads()).to.equal(before);
  });

  it("does not lock onto a page for non-primary buttons", function () {
    const t = setup();
    t.fire("pointerdown", 100, 700, { button: 2, buttons: 2 });
    // The context menu swallows the matching pointerup.
    t.move(100, 805);
    expect(t.visible()).to.be.false;
  });

  it("releases a drag lock whose pointerup was lost", function () {
    const t = setup();
    t.fire("pointerdown", 100, 700, { button: 0, buttons: 1 });
    t.fire("pointermove", 100, 805, { buttons: 0 });
    expect(t.visible()).to.be.false;
  });

  it("hides after a drag released outside the viewport", function () {
    const t = setup();
    t.setPageRect(0, { left: 0, top: 0, right: 600, bottom: 2000 });
    t.fire("pointerdown", 100, 700, { button: 0, buttons: 1 });
    t.fire("pointermove", 100, 1100, { buttons: 1 });
    t.fire("pointerup", 100, 1100, { button: 0, buttons: 0 });
    expect(t.visible()).to.be.false;
  });

  it("destroys itself when its window unloads", function () {
    const t = setup();
    t.win.dispatchEvent(new t.win.Event("unload"));
    expect(t.ctrl.destroyed).to.be.true;
  });
});
