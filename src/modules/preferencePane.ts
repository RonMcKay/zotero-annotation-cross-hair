import { config } from "../../package.json";
import { readSettings, resetColor, writeColor, type ColorPref } from "./prefs";

export async function registerPreferencePane(rootURI: string): Promise<void> {
  await Zotero.PreferencePanes.register({
    pluginID: config.addonID,
    src: `${rootURI}content/preferences.xhtml`,
    label: config.addonName,
    image: `${rootURI}content/icons/icon.svg`,
  });
}

/** Element id suffixes in preferences.xhtml for each colour pref. */
const COLOR_ROWS: ReadonlyArray<[ColorPref, string]> = [
  ["colorLight", "color-light"],
  ["colorDark", "color-dark"],
];

/** Binds the colour pickers; the checkbox uses Zotero's own pref binding. */
export function onPrefsLoad(win: Window): void {
  const doc = win.document;
  for (const [pref, suffix] of COLOR_ROWS) {
    const id = `zotero-prefpane-${config.addonRef}-${suffix}`;
    const input = doc.getElementById(id) as HTMLInputElement | null;
    const reset = doc.getElementById(`${id}-reset`);
    if (!input) continue;
    input.value = readSettings()[pref];
    input.addEventListener("input", () => writeColor(pref, input.value));
    reset?.addEventListener("command", () => {
      resetColor(pref);
      input.value = readSettings()[pref];
    });
  }
}
