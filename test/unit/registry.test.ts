import { expect } from "chai";
import type { CrosshairDeps } from "../../src/modules/crosshair";
import {
  ReaderRegistry,
  type ControllerLike,
} from "../../src/modules/registry";
import { DEFAULT_SETTINGS } from "../../src/modules/settings";

class FakeController implements ControllerLike {
  attached = 0;
  refreshed = 0;
  destroyed = false;
  onDestroy?: () => void;
  constructor(
    readonly win: Window,
    readonly deps: CrosshairDeps,
  ) {}
  attach() {
    this.attached++;
  }
  refresh() {
    this.refreshed++;
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.onDestroy?.();
  }
}

const fakeWin = (name: string) => ({ name }) as unknown as Window;

function pdfReader(primary: Window | null, secondary: Window | null = null) {
  return {
    type: "pdf",
    _internalReader: {
      toolType: "pointer",
      _primaryView: primary && { _iframeWindow: primary },
      _secondaryView: secondary && { _iframeWindow: secondary },
    },
  };
}

function setup() {
  const created: FakeController[] = [];
  const registry = new ReaderRegistry(
    () => DEFAULT_SETTINGS,
    (win, deps) => {
      const c = new FakeController(win, deps);
      created.push(c);
      return c;
    },
  );
  return { registry, created };
}

describe("ReaderRegistry", function () {
  it("attaches one controller per new view window", function () {
    const { registry, created } = setup();
    registry.sync([pdfReader(fakeWin("a"))]);
    expect(created).to.have.length(1);
    expect(created[0].attached).to.equal(1);
    expect(registry.size).to.equal(1);
  });

  it("refreshes known windows instead of re-attaching", function () {
    const { registry, created } = setup();
    const r = pdfReader(fakeWin("a"));
    registry.sync([r]);
    registry.sync([r]);
    expect(created).to.have.length(1);
    expect(created[0].refreshed).to.equal(1);
  });

  it("picks up a split view that opens later", function () {
    const { registry } = setup();
    const a = fakeWin("a");
    const r = pdfReader(a);
    registry.sync([r]);
    r._internalReader._secondaryView = { _iframeWindow: fakeWin("b") };
    registry.sync([r]);
    expect(registry.size).to.equal(2);
  });

  it("replaces the controller when a view is re-created", function () {
    const { registry, created } = setup();
    const r = pdfReader(fakeWin("a"));
    registry.sync([r]);
    r._internalReader._primaryView = { _iframeWindow: fakeWin("a2") };
    registry.sync([r]);
    expect(created[0].destroyed).to.be.true;
    expect(created[1].destroyed).to.be.false;
    expect(registry.size).to.equal(1);
  });

  it("destroys controllers of closed readers", function () {
    const { registry, created } = setup();
    registry.sync([pdfReader(fakeWin("a"), fakeWin("b"))]);
    registry.sync([]);
    expect(created.every((c) => c.destroyed)).to.be.true;
    expect(registry.size).to.equal(0);
  });

  it("forgets a controller that destroys itself", function () {
    const { registry, created } = setup();
    registry.sync([pdfReader(fakeWin("a"))]);
    created[0].destroy();
    expect(registry.size).to.equal(0);
  });

  it("tolerates readers whose internals throw", function () {
    const { registry } = setup();
    const broken = {
      type: "pdf",
      get _internalReader(): never {
        throw new Error("internals changed");
      },
    };
    expect(() =>
      registry.sync([broken, pdfReader(fakeWin("a"))]),
    ).not.to.throw();
    expect(registry.size).to.equal(1);
  });

  it("gives each controller its own reader's tool state", function () {
    const { registry, created } = setup();
    const r1 = pdfReader(fakeWin("a"));
    const r2 = pdfReader(fakeWin("b"));
    r2._internalReader.toolType = "image";
    registry.sync([r1, r2]);
    expect(created.map((c) => c.deps.isToolActive())).to.deep.equal([
      false,
      true,
    ]);
  });

  it("refreshes every controller", function () {
    const { registry, created } = setup();
    registry.sync([pdfReader(fakeWin("a"), fakeWin("b"))]);
    registry.refreshAll();
    expect(created.map((c) => c.refreshed)).to.deep.equal([1, 1]);
  });

  it("destroys everything on destroyAll", function () {
    const { registry, created } = setup();
    registry.sync([pdfReader(fakeWin("a"), fakeWin("b"))]);
    registry.destroyAll();
    expect(created.every((c) => c.destroyed)).to.be.true;
    expect(registry.size).to.equal(0);
  });
});
