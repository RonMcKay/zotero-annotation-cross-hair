import { config } from "../../package.json";
import {
  DEFAULT_SETTINGS,
  normalizeColor,
  normalizeSettings,
  type Settings,
} from "./settings";

export type ColorPref = "colorLight" | "colorDark";

const PREF_NAMES = ["enabled", "colorLight", "colorDark"] as const;
type PrefName = (typeof PREF_NAMES)[number];

export const prefKey = (name: PrefName): string =>
  `${config.prefsPrefix}.${name}`;

export function readSettings(): Settings {
  return normalizeSettings({
    enabled: Zotero.Prefs.get(prefKey("enabled"), true),
    colorLight: Zotero.Prefs.get(prefKey("colorLight"), true),
    colorDark: Zotero.Prefs.get(prefKey("colorDark"), true),
  });
}

export function writeColor(which: ColorPref, color: string): void {
  Zotero.Prefs.set(
    prefKey(which),
    normalizeColor(color, DEFAULT_SETTINGS[which]),
    true,
  );
}

export function resetColor(which: ColorPref): void {
  Zotero.Prefs.clear(prefKey(which), true);
}

/** Calls `cb` whenever one of the plugin's prefs changes; returns unobserve. */
export function observeSettings(cb: () => void): () => void {
  const symbols = PREF_NAMES.map((name) =>
    Zotero.Prefs.registerObserver(prefKey(name), cb, true),
  );
  return () => symbols.forEach((s) => Zotero.Prefs.unregisterObserver(s));
}
