import { assert } from "chai";
import { config } from "../../package.json";
import { FIXTURE_PDF_BASE64 } from "./fixture";

const OVERLAY_ID = "annotationcrosshair-overlay";

async function waitFor<T>(
  fn: () => T | null | undefined | false,
  what: string,
  timeoutMs = 10000,
): Promise<T> {
  const start = Date.now();
  for (;;) {
    let value: T | null | undefined | false;
    try {
      value = fn();
    } catch {
      value = undefined;
    }
    if (value) return value;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${what}`);
    }
    await Zotero.Promise.delay(100);
  }
}

/**
 * The scaffold runs tests with a throwaway data directory under
 * `.scaffold/test/data`. Refuse to touch anything else, so a misconfigured
 * run can never import test files into a real library.
 */
function assertIsolatedDataDir(): void {
  const dir: string = Zotero.DataDirectory.dir;
  if (!PathUtils.normalize(dir).includes(".scaffold")) {
    throw new Error(
      `Refusing to run: Zotero data directory ${dir} is not a scaffold test directory`,
    );
  }
}

async function openFixturePdf(): Promise<any> {
  assertIsolatedDataDir();
  const path = PathUtils.join(PathUtils.tempDir, "annotation-crosshair.pdf");
  const bytes = Uint8Array.from(atob(FIXTURE_PDF_BASE64), (c) =>
    c.charCodeAt(0),
  );
  await IOUtils.write(path, bytes);
  const item = await Zotero.Attachments.importFromFile({
    file: path,
    libraryID: Zotero.Libraries.userLibraryID,
  });
  const reader: any = await Zotero.Reader.open(item.id);
  await reader._initPromise;
  await reader._internalReader._primaryView.initializedPromise;
  return reader;
}

/** Objects passed into reader (content) code must be cloned into its scope. */
function setTool(reader: any, type: string): void {
  reader._internalReader.setTool(
    Components.utils.cloneInto({ type }, reader._iframeWindow),
  );
}

describe("Annotation Crosshair in Zotero", function () {
  this.timeout(60000);

  let reader: any;

  before(async function () {
    reader = await openFixturePdf();
  });

  after(function () {
    try {
      Zotero.getMainWindow().Zotero_Tabs.close(reader.tabID);
    } catch {
      // ignore
    }
  });

  it("registers the plugin instance", function () {
    const instance = (Zotero as any)[config.addonInstance];
    assert.isOk(instance);
    assert.isTrue(instance.data.initialized);
  });

  it("installs default prefs", function () {
    assert.equal(
      Zotero.Prefs.get(`${config.prefsPrefix}.colorLight`, true),
      "#666666",
    );
    assert.equal(
      Zotero.Prefs.get(`${config.prefsPrefix}.colorDark`, true),
      "#bbbbbb",
    );
    assert.equal(Zotero.Prefs.get(`${config.prefsPrefix}.enabled`, true), true);
  });

  it("registers the preference pane", function () {
    const panes: any[] = (Zotero.PreferencePanes as any).pluginPanes;
    assert.isTrue(panes.some((p) => p.pluginID === config.addonID));
  });

  it("applies colour changes live", async function () {
    const win: any = Components.utils.unwaiveXrays(
      await waitFor(
        () => reader._internalReader._primaryView._iframeWindow,
        "pdf view window",
      ),
    );
    const doc = win.document;
    const page: Element = await waitFor(
      () => doc.querySelector("#viewerContainer .page"),
      "rendered page",
    );
    const overlay: HTMLElement = await waitFor(
      () => doc.getElementById(OVERLAY_ID),
      "crosshair overlay",
    );
    const r = page.getBoundingClientRect();
    const key = `${config.prefsPrefix}.colorLight`;
    try {
      // Pin light pages so the test doesn't depend on the OS appearance.
      reader._internalReader.setColorScheme("light");
      await waitFor(
        () =>
          doc.documentElement.style.getPropertyValue("--background-color") ===
          "#FFFFFF",
        "light page background",
      );
      setTool(reader, "image");
      doc.getElementById("viewerContainer").dispatchEvent(
        new win.PointerEvent("pointermove", {
          bubbles: true,
          clientX: r.left + 5,
          clientY: r.top + 5,
        }),
      );
      Zotero.Prefs.set(key, "#00ff00", true);
      const h = overlay.querySelector(".h") as HTMLElement;
      await waitFor(
        () => h.style.backgroundColor === "rgb(0, 255, 0)",
        "line colour update",
        3000,
      );
    } finally {
      Zotero.Prefs.clear(key, true);
      reader._internalReader.setColorScheme(null);
      setTool(reader, "pointer");
    }
  });

  it("uses the dark-page colour with a dark reader theme", async function () {
    const win: any = Components.utils.unwaiveXrays(
      reader._internalReader._primaryView._iframeWindow,
    );
    const doc = win.document;
    const overlay = doc.getElementById(OVERLAY_ID) as HTMLElement;
    const h = overlay.querySelector(".h") as HTMLElement;
    try {
      // Zotero's default dark reader theme is "Dark" (#2E3440).
      reader._internalReader.setColorScheme("dark");
      await waitFor(
        () =>
          doc.documentElement.style.getPropertyValue("--background-color") ===
          "#2E3440",
        "dark page background",
      );
      const r = doc
        .querySelector("#viewerContainer .page")
        .getBoundingClientRect();
      setTool(reader, "image");
      doc.getElementById("viewerContainer").dispatchEvent(
        new win.PointerEvent("pointermove", {
          bubbles: true,
          clientX: r.left + 5,
          clientY: r.top + 5,
        }),
      );
      assert.notEqual(overlay.style.display, "none");
      assert.equal(h.style.backgroundColor, "rgb(187, 187, 187)");
    } finally {
      reader._internalReader.setColorScheme(null);
      setTool(reader, "pointer");
    }
  });

  it("shows the crosshair for the Select Area tool only", async function () {
    // Use the Xray view: objects passed through the reader's "waived" window
    // (event init dicts, listener options) are silently dropped otherwise.
    const win: any = Components.utils.unwaiveXrays(
      await waitFor(
        () => reader._internalReader._primaryView._iframeWindow,
        "pdf view window",
      ),
    );
    const doc = win.document;
    const page: Element = await waitFor(
      () => doc.querySelector("#viewerContainer .page"),
      "rendered page",
    );
    const overlay: HTMLElement = await waitFor(
      () => doc.getElementById(OVERLAY_ID),
      "crosshair overlay",
    );
    const r = page.getBoundingClientRect();
    // Aim at the visible part of the page: a real pointer is always inside
    // the viewport unless it is dragging.
    const x = (Math.max(r.left, 0) + Math.min(r.right, win.innerWidth)) / 2;
    const y = (Math.max(r.top, 0) + Math.min(r.bottom, win.innerHeight)) / 2;
    const move = () =>
      doc.getElementById("viewerContainer").dispatchEvent(
        new win.PointerEvent("pointermove", {
          bubbles: true,
          clientX: x,
          clientY: y,
        }),
      );

    setTool(reader, "image");
    move();
    assert.notEqual(overlay.style.display, "none", "visible with image tool");
    const h = overlay.querySelector(".h") as HTMLElement;
    const v = overlay.querySelector(".v") as HTMLElement;
    assert.equal(h.style.top, `${y - 0.5}px`, "horizontal line on pointer");
    assert.equal(v.style.left, `${x - 0.5}px`, "vertical line on pointer");
    assert.equal(h.style.width, `${r.width}px`, "spans the page width");
    assert.equal(v.style.height, `${r.height}px`, "spans the page height");

    setTool(reader, "pointer");
    move();
    assert.equal(overlay.style.display, "none", "hidden with pointer tool");
  });

  it("sees pointer moves even if reader code stops propagation", async function () {
    const win: any = Components.utils.unwaiveXrays(
      reader._internalReader._primaryView._iframeWindow,
    );
    const doc = win.document;
    const container = doc.getElementById("viewerContainer");
    const overlay = doc.getElementById(OVERLAY_ID) as HTMLElement;
    const r = doc
      .querySelector("#viewerContainer .page")
      .getBoundingClientRect();
    const stop = (e: Event) => e.stopPropagation();
    container.addEventListener("pointermove", stop);
    try {
      setTool(reader, "pointer");
      container.dispatchEvent(
        new win.PointerEvent("pointermove", {
          bubbles: true,
          clientX: 0,
          clientY: 0,
        }),
      );
      setTool(reader, "image");
      container.dispatchEvent(
        new win.PointerEvent("pointermove", {
          bubbles: true,
          clientX: r.left + 5,
          clientY: r.top + 5,
        }),
      );
      assert.notEqual(overlay.style.display, "none");
    } finally {
      container.removeEventListener("pointermove", stop);
      setTool(reader, "pointer");
    }
  });
});
