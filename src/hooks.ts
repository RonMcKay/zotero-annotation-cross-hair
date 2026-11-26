import { onPrefsLoad, registerPreferencePane } from "./modules/preferencePane";
import { observeSettings, readSettings } from "./modules/prefs";
import { CrosshairController } from "./modules/crosshair";
import { ReaderRegistry } from "./modules/registry";
import type { Settings } from "./modules/settings";

/** How often open readers are scanned for new views and tool changes. */
const SYNC_INTERVAL_MS = 500;

let settings: Settings;
let registry: ReaderRegistry | null = null;
let unobserve: (() => void) | null = null;
let timer: nsITimer | null = null;

function startRepeatingTimer(fn: () => void, ms: number): nsITimer {
  const classes = Components.classes as unknown as Record<
    string,
    { createInstance(iface: unknown): nsITimer }
  >;
  const t = classes["@mozilla.org/timer;1"].createInstance(
    Components.interfaces.nsITimer,
  );
  t.initWithCallback(
    { notify: fn },
    ms,
    Components.interfaces.nsITimer.TYPE_REPEATING_SLACK ?? 1,
  );
  return t;
}

function syncReaders(): void {
  try {
    registry?.sync(Zotero.Reader._readers);
  } catch (e) {
    Zotero.debug(`[${addon.data.config.addonName}] sync failed: ${e}`);
  }
}

async function onStartup(): Promise<void> {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  await registerPreferencePane(addon.data.rootURI);

  settings = readSettings();
  // The reader hands out "waived" content windows. Work on their Xray view
  // instead: listener options and DOM calls then behave as in chrome code
  // (with waived windows the capture/passive options are silently lost).
  registry = new ReaderRegistry(
    () => settings,
    (win, deps) =>
      new CrosshairController(Components.utils.unwaiveXrays(win), deps),
  );
  unobserve = observeSettings(() => {
    settings = readSettings();
    registry?.refreshAll();
  });

  timer = startRepeatingTimer(syncReaders, SYNC_INTERVAL_MS);
  syncReaders();

  addon.data.initialized = true;
}

async function onMainWindowLoad(_win: Window): Promise<void> {}

async function onMainWindowUnload(_win: Window): Promise<void> {}

async function onShutdown(): Promise<void> {
  timer?.cancel();
  timer = null;
  unobserve?.();
  unobserve = null;
  registry?.destroyAll();
  registry = null;
  addon.data.alive = false;
  delete (Zotero as unknown as Record<string, unknown>)[
    addon.data.config.addonInstance
  ];
}

export default {
  onStartup,
  onMainWindowLoad,
  onMainWindowUnload,
  onShutdown,
  onPrefsLoad,
};
