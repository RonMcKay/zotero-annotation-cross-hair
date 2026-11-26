import Addon from "./addon";
import { config } from "../package.json";

const Z = Zotero as unknown as Record<string, unknown>;

if (!Z[config.addonInstance]) {
  _globalThis.addon = new Addon();
  Z[config.addonInstance] = _globalThis.addon;
}
