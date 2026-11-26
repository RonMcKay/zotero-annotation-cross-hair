# Annotation Crosshair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Zotero 7–10 plugin that draws page-spanning 1px guide lines through the pointer while the PDF reader's Select Area tool is active, shipped from a GitHub-ready repo with tests, CI and one-click semantic releases.

**Architecture:** Pure, Node-testable modules (geometry, tool detection, settings validation, a DOM-only crosshair controller, a reader registry) plus a thin Zotero glue layer (hooks, prefs, preference pane). A 500 ms poll scans `Zotero.Reader._readers`, attaches one controller per pdf.js view window, and refreshes visibility. Build/serve/test via zotero-plugin-scaffold; releases via semantic-release on `workflow_dispatch`.

**Tech Stack:** TypeScript 6, zotero-plugin-scaffold 0.9, zotero-types 4, Mocha 12 + Chai 6 + tsx + happy-dom (unit), scaffold tester (in-Zotero), ESLint 10 + @zotero-plugin/eslint-config, Prettier 3, semantic-release 26, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-26-crosshair-design.md`

## Global Constraints

- Add-on ID `annotation-crosshair@ronmckay.github.io`; name "Annotation Crosshair"; addonRef `annotationcrosshair`; addonInstance `AnnotationCrosshair`; prefs prefix `extensions.zotero.annotationcrosshair`.
- Repo `RonMcKay/zotero-annotation-cross-hair`; homepage `https://github.com/RonMcKay/zotero-annotation-cross-hair`.
- update_url `https://github.com/RonMcKay/zotero-annotation-cross-hair/releases/download/release/update.json`.
- Manifest `strict_min_version` `6.999`, `strict_max_version` `10.0.*` (raise min to `7.999` if Zotero 7 integration fails non-trivially).
- esbuild target `firefox115`. ESM `package.json`. `package.json` version stays `0.0.0` in git; releases inject the version at build time.
- License MIT, `Copyright (c) 2026 Philipp Oberdiek`. Author "Philipp Oberdiek" (no email anywhere).
- Prefs: `enabled` (bool, default `true`), `color` (string, default `#e5484d`).
- Overlay nodes `pointer-events: none`; all listeners `{ passive: true, capture: true }`; never `preventDefault`/`stopPropagation`.
- Internal reader access must never throw out of plugin code (catch → treat as "no crosshair").
- Never call `Zotero.Reader.unregisterEventListener` (inverted filter in Zotero 10).
- No Claude/Anthropic attribution anywhere (commits, README, PR bodies).
- GitHub Actions: `actions/checkout@v7`, `actions/setup-node@v7` (`node-version: lts/*`, `cache: npm`), `actions/upload-artifact@v7`, `amannn/action-semantic-pull-request@v6`.
- Zotero CI builds: 7.0.32 (`.tar.bz2`) and 10.0.8 (`.tar.xz`), from `https://download.zotero.org/client/release/<v>/Zotero-<v>_linux-x86_64.<ext>`.

## Review Focus

1. Pointer leaves the page mid-drag → lines stay on the drag's page, clamped to its edges (not hidden, not jumping to another page). Test in Task 2 (`geometry`) and Task 4 (controller drag test).
2. Mouse-wheel scroll / zoom with a stationary pointer → lines follow the page under the last pointer position. Test in Task 4 (`scroll recomputes`).
3. Reader view re-created (reload, split view toggle, tab close) → new window gets a controller, closed window's controller is destroyed and dropped. Test in Task 5.
4. Hand-edited `color` pref containing CSS injection (`red; display:none`) or garbage → default colour used. Test in Task 3.
5. Future Zotero renames internals (getter throws / property missing) → no crosshair, no exception. Test in Task 3 (`isAreaToolActive`) and Task 5 (registry with throwing reader).

---

## File Structure

```
package.json, package-lock.json, tsconfig.json, eslint.config.mjs, .prettierignore,
.gitignore, .gitattributes, .env.example, .mocharc.json, zotero-plugin.config.ts,
release.config.mjs, LICENSE, README.md
addon/manifest.json, addon/bootstrap.js, addon/prefs.js
addon/content/preferences.xhtml, addon/content/icons/icon.svg
addon/locale/en-US/addon.ftl, addon/locale/en-US/preferences.ftl
src/index.ts            — creates addon instance on Zotero[addonInstance]
src/addon.ts            — Addon class: { data: { initialized, config, env }, hooks }
src/hooks.ts            — onStartup / onMainWindowLoad / onMainWindowUnload / onShutdown / onPrefsLoad
src/modules/geometry.ts — pure line maths
src/modules/settings.ts — pure: Settings type, DEFAULTS, normalizeColor
src/modules/tool.ts     — pure: isAreaToolActive, getViewWindows
src/modules/crosshair.ts— CrosshairController (DOM only)
src/modules/registry.ts — ReaderRegistry (window → controller bookkeeping)
src/modules/prefs.ts    — Zotero.Prefs glue: readSettings(), observe(cb) → unobserve
src/modules/preferencePane.ts — pane registration + colour input binding
typings/global.d.ts     — __env__, addon global
test/unit/*.test.ts     — Node/Mocha tests
test/zotero/*.test.ts   — scaffold in-Zotero tests
scripts/publish-update-manifest.sh
.github/workflows/ci.yml, release.yml, pr-title.yml; .github/dependabot.yml
```

---

### Task 1: Repository scaffold, build and lint

**Files:** all root config files above, `addon/*`, `src/index.ts`, `src/addon.ts`, `src/hooks.ts` (lifecycle stubs only), `typings/global.d.ts`, `LICENSE`, `.mocharc.json`, `test/unit/smoke.test.ts`.

**Interfaces:**
- Produces: `npm run build` → `.scaffold/build/annotation-crosshair.xpi` (name from scaffold `xpiName`); scripts `start`, `build`, `lint:check`, `lint:fix`, `test:unit`, `test:zotero`, `test` (= unit then zotero).
- Produces: `Zotero.AnnotationCrosshair` with `data.initialized: boolean`, `hooks` object (methods filled in Task 6).

- [ ] **Step 1:** Write `package.json` modelled on windingwind/zotero-plugin-template 3.1.0 with the Global Constraints values in `config`, `"version": "0.0.0"`, `"license": "MIT"`, `"type": "module"`. devDependencies: zotero-plugin-scaffold ^0.9.4, zotero-types ^4.1.3, @zotero-plugin/eslint-config ^0.6.10, eslint ^10.15.0, prettier ^3.10.1, typescript ^6.0.3, mocha ^12.0.3, chai ^6.3.0, @types/mocha, @types/chai, tsx ^4.23.15, happy-dom ^21.0.4, semantic-release ^26.0.1, @semantic-release/exec ^7.1.0, conventional-changelog-conventionalcommits ^10.4.1. No zotero-plugin-toolkit.
- [ ] **Step 2:** Write `zotero-plugin.config.ts` as the template's (source/dist/updateURL/xpiDownloadLink/esbuild/prefs), but `test: { entries: ["test/zotero"], waitForPlugin: "() => Zotero.AnnotationCrosshair.data.initialized" }`.
- [ ] **Step 3:** Write `addon/manifest.json` (template placeholders, `strict_min_version "6.999"`, `strict_max_version "10.0.*"`, icons → `content/icons/icon.svg`), `addon/bootstrap.js` (template's, verbatim structure), `addon/prefs.js` (`pref("enabled", true); pref("color", "#e5484d");` — scaffold prefixes them), `icon.svg` (simple crosshair, 96×96 viewBox), locale `.ftl` stubs.
- [ ] **Step 4:** `src/index.ts`, `src/addon.ts`, `src/hooks.ts` with `onStartup` setting `addon.data.initialized = true` after `Zotero.initializationPromise`/`unlockPromise`/`uiReadyPromise`.
- [ ] **Step 5:** `tsconfig.json` extends `zotero-types/entries/sandbox/`, includes `src`, `typings`, `package.json`; `test/tsconfig.json` for test files (mocha/chai types, DOM lib). `eslint.config.mjs` from `@zotero-plugin/eslint-config`. `.mocharc.json`: spec `test/unit/**/*.test.ts`, node-option `import=tsx`.
- [ ] **Step 6:** `test/unit/smoke.test.ts`: `it("package config has addon id", () => expect(pkg.config.addonID).to.equal("annotation-crosshair@ronmckay.github.io"))`.
- [ ] **Step 7:** Run `npm install && npm run build && npm run lint:check && npm run test:unit`. Expected: xpi exists in `.scaffold/build/`; check whether `update.json` and `update-beta.json` are emitted there (needed by Task 7 — if not, note it for Task 7); lint clean; 1 passing.
- [ ] **Step 8:** Commit `build: scaffold zotero plugin project` (only if the owner has OK'd commits).

### Task 2: Geometry

**Files:** Create `src/modules/geometry.ts`, `test/unit/geometry.test.ts`.

**Interfaces:**
- Produces:
  ```ts
  export interface Rect { left: number; top: number; right: number; bottom: number }
  export interface Point { x: number; y: number }
  export interface LineBoxes { h: { left: number; top: number; width: number }; v: { left: number; top: number; height: number } }
  export function findPageIndex(pages: readonly Rect[], p: Point): number   // -1 if none; inclusive edges
  export function clampToRect(r: Rect, p: Point): Point
  export function lineBoxes(page: Rect, p: Point): LineBoxes                 // p is clamped first
  ```

- [ ] **Step 1: Tests** —
  - `findPageIndex` returns index of containing rect; `-1` in the gap between two pages; edge point (`x === right`) counts as inside.
  - `clampToRect({0,0,100,200}, {x:150,y:-10})` → `{x:100,y:0}`.
  - `lineBoxes({left:10,top:20,right:110,bottom:220}, {x:50,y:70})` → `h = {left:10, top:69.5, width:100}`, `v = {left:49.5, top:20, height:200}` (1px line centred on the pointer).
  - Review Focus 1: `lineBoxes` with pointer outside page (`{x:500,y:70}`) → `v.left === 109.5`.
- [ ] **Step 2:** Run `npm run test:unit` → FAIL (module missing).
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: add crosshair geometry`.

### Task 3: Settings and tool detection

**Files:** Create `src/modules/settings.ts`, `src/modules/tool.ts`, `test/unit/settings.test.ts`, `test/unit/tool.test.ts`.

**Interfaces:**
- Produces:
  ```ts
  // settings.ts
  export interface Settings { enabled: boolean; color: string }
  export const DEFAULT_SETTINGS: Settings = { enabled: true, color: "#e5484d" };
  export function normalizeColor(value: unknown): string    // accepts #rgb, #rrggbb, #rrggbbaa (case-insensitive); else DEFAULT_SETTINGS.color
  export function normalizeSettings(raw: { enabled?: unknown; color?: unknown }): Settings  // enabled: only `false` disables
  // tool.ts
  export const AREA_TOOL = "image";
  export function isAreaToolActive(reader: unknown): boolean
  export function getViewWindows(reader: unknown): Window[]  // primary + secondary `_iframeWindow`s that exist; [] for non-"pdf" readers
  ```

- [ ] **Step 1: Tests** —
  - `normalizeColor("#ABCDEF") === "#abcdef"`, `"#abc"` ok, `"#11223344"` ok; Review Focus 4: `"red; display:none"`, `"url(x)"`, `42`, `undefined` → `"#e5484d"`.
  - `normalizeSettings({ enabled: false, color: "#000" })` → `{enabled:false,color:"#000"}`; `{}` → defaults.
  - `isAreaToolActive({ _internalReader: { toolType: "image" } })` → true; `{ _internalReader: { _state: { tool: { type: "image" } } } }` → true (fallback); `toolType: "highlight"` → false; `null`, `{}` → false.
  - Review Focus 5: reader whose `_internalReader` getter throws → `false` for `isAreaToolActive` and `[]` for `getViewWindows`.
  - `getViewWindows({ type: "pdf", _internalReader: { _primaryView: { _iframeWindow: w1 }, _secondaryView: { _iframeWindow: w2 } } })` → `[w1, w2]`; secondary `null` → `[w1]`; `type: "epub"` → `[]`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement (wrap every internal access in try/catch; `toolType` first, `_state.tool.type` second).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: add settings validation and reader tool detection`.

### Task 4: Crosshair controller

**Files:** Create `src/modules/crosshair.ts`, `test/unit/crosshair.test.ts`.

**Interfaces:**
- Consumes: `findPageIndex`, `lineBoxes`, `Rect` (Task 2); `Settings` (Task 3).
- Produces:
  ```ts
  export interface CrosshairDeps { isToolActive(): boolean; getSettings(): Settings }
  export class CrosshairController {
    constructor(win: Window, deps: CrosshairDeps)
    readonly win: Window
    readonly destroyed: boolean
    attach(): void          // idempotent; inserts <style id="annotationcrosshair-style"> + <div id="annotationcrosshair-overlay"> with two children .h/.v into doc.documentElement/body; adds listeners
    refresh(): void         // re-evaluate visibility/position from last pointer + current settings
    destroy(): void         // removes nodes, style, listeners, html class; sets destroyed; calls onDestroy
    onDestroy?: () => void
  }
  ```
- Behaviour: page rects come from `doc.querySelectorAll("#viewerContainer .page")` → `getBoundingClientRect()`. Listeners on `win`, `{capture:true, passive:true}`: `pointermove` (store last point, refresh), `pointerdown` (if visible: lock drag page index), `pointerup`/`pointercancel` (unlock, refresh), `scroll` (refresh), `keyup` (refresh), `unload` (destroy). `pointerleave` on `doc.documentElement` → clear last point, hide. Visible iff `settings.enabled && isToolActive() && lastPoint && (dragPage ?? findPageIndex(...)) >= 0`. Overlay `position:fixed; inset:0; pointer-events:none; z-index:2147483000`; lines `position:fixed; background: <color>`, h height 1px, v width 1px, positioned via `lineBoxes`. While visible, `<html>` gets class `annotationcrosshair-active`; style rule: `html.annotationcrosshair-active #viewerContainer[style*="cursor: default"] { cursor: crosshair !important; }`.

- [ ] **Step 1: Tests** (happy-dom `Window`; stub `getBoundingClientRect` on two `.page` divs: page0 `{0,0,600,800}`, page1 `{0,810,600,1610}`; dispatch `PointerEvent`s with `clientX/clientY`):
  - attach twice → exactly one overlay and one style element.
  - tool inactive → overlay hidden after pointermove.
  - tool active, move to (100,200) → visible; `.h` style `top: 199.5px; left: 0px; width: 600px`; `.v` `left: 99.5px; top: 0px; height: 800px`; html has class `annotationcrosshair-active`.
  - move into gap (100,805) → hidden.
  - Review Focus 1: pointerdown at (100,700), move to (100,900) → still visible on page0, `.h` top `799.5px`; pointerup then refresh → page1 lines.
  - Review Focus 2: after move to (100,200), change page0 stub to `{0,-100,600,700}`, dispatch `scroll` → `.v` top `-100px`, height `800px`.
  - settings `enabled:false` → hidden; colour change + `refresh()` → line `background-color` updated.
  - `pointerleave` → hidden. `destroy()` → no overlay/style/class left, later pointermove does nothing, `onDestroy` called once.
  - Listeners never call `preventDefault` (dispatch cancelable event, assert `defaultPrevented === false`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: draw crosshair overlay in pdf view`.

### Task 5: Reader registry

**Files:** Create `src/modules/registry.ts`, `test/unit/registry.test.ts`.

**Interfaces:**
- Consumes: `getViewWindows`, `isAreaToolActive` (Task 3); `CrosshairController`, `CrosshairDeps` (Task 4).
- Produces:
  ```ts
  export interface ControllerLike { readonly win: Window; readonly destroyed: boolean; attach(): void; refresh(): void; destroy(): void; onDestroy?: () => void }
  export type ControllerFactory = (win: Window, deps: CrosshairDeps) => ControllerLike
  export class ReaderRegistry {
    constructor(getSettings: () => Settings, factory?: ControllerFactory)  // default factory: new CrosshairController
    sync(readers: Iterable<unknown>): void   // attach new view windows, refresh existing, destroy controllers whose window is no longer listed
    refreshAll(): void
    destroyAll(): void
    readonly size: number
  }
  ```
- Each controller's `isToolActive` closes over its reader (`() => isAreaToolActive(reader)`). A controller's `onDestroy` removes it from the map.

- [ ] **Step 1: Tests** (fake factory recording calls; fake readers with fake window objects):
  - `sync([r1])` with primary only → 1 controller attached; `sync([r1])` again → no new controller, `refresh` called.
  - Review Focus 3: r1 gains a secondary view → 2 controllers; r1's primary window replaced by a new object → old controller destroyed, new attached; `sync([])` → all destroyed, `size === 0`; controller self-destroys (window unload) → `size` decremented.
  - Review Focus 5: `sync([throwingReader, r1])` → no throw, r1 still attached.
  - `isToolActive` passed to the factory reflects that reader's tool.
  - `destroyAll()` → every controller destroyed.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement (`Map<Window, ControllerLike>`).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: track pdf reader views`.

### Task 6: Zotero glue, preference pane, in-Zotero tests

**Files:** Create `src/modules/prefs.ts`, `src/modules/preferencePane.ts`, `addon/content/preferences.xhtml`, `addon/locale/en-US/preferences.ftl`, `test/zotero/startup.test.ts`; Modify `src/hooks.ts`.

**Interfaces:**
- Consumes: `ReaderRegistry` (Task 5), `normalizeSettings`, `Settings` (Task 3).
- Produces:
  ```ts
  // prefs.ts
  export function readSettings(): Settings          // Zotero.Prefs.get(`${prefsPrefix}.enabled`, true) etc. → normalizeSettings
  export function writeColor(color: string): void
  export function observeSettings(cb: () => void): () => void   // registers observers on both prefs, returns unregister
  // preferencePane.ts
  export function registerPreferencePane(rootURI: string): Promise<void>
  export function onPrefsLoad(win: Window): void    // binds <html:input type="color" id="annotationcrosshair-color">
  ```
- hooks: `onStartup` → register pane, create `ReaderRegistry(readSettings)`, `observeSettings(() => registry.refreshAll())`, `setInterval(() => registry.sync(Zotero.Reader._readers), 500)` (on the main window's `setInterval` is not available in the sandbox — use `Zotero.getMainWindow()?.setInterval` or a `Components` timer; pick whichever works and note it), set `initialized = true`. `onShutdown` → clear timer, `destroyAll()`, unobserve, `delete Zotero.AnnotationCrosshair`.
- Pane: `preferences.xhtml` with a checkbox bound via `preference="extensions.zotero.annotationcrosshair.enabled"`, colour input + "Reset" button, a short help line; root element `onload="Zotero.AnnotationCrosshair.hooks.onPrefsLoad(window)"`. Fluent ids prefixed `annotationcrosshair-`.

- [ ] **Step 1: In-Zotero tests** (`test/zotero/startup.test.ts`, using `zotero-plugin-scaffold/test` API):
  - `Zotero.AnnotationCrosshair` defined and `data.initialized === true`.
  - Prefs defaults: `Zotero.Prefs.get("extensions.zotero.annotationcrosshair.color", true) === "#e5484d"`.
  - Open a PDF: import a tiny fixture PDF (`test/zotero/fixtures/blank.pdf`, generated once and committed) via `Zotero.Attachments.importFromFile`, `Zotero.Reader.open(item.id)`, await `reader._initPromise` and `_internalReader._primaryView.initializedPromise`; `reader._internalReader.setTool({ type: "image" })`; wait ≤2 s for `#annotationcrosshair-overlay` in the view document; dispatch a pointermove over the first page; assert overlay visible. Then `setTool({ type: "pointer" })`, wait one poll → hidden.
- [ ] **Step 2:** Implement prefs, pane, hooks.
- [ ] **Step 3:** Run `npm run build && npm run test:unit`. Expected PASS, typecheck clean.
- [ ] **Step 4:** Run `npm run test:zotero` locally against `/Applications/Zotero.app/Contents/MacOS/zotero` (separate blank profile, launched by scaffold; owner OK needed since it starts a second Zotero window). Expected: all in-Zotero tests pass. If the scaffold cannot run on macOS, record that and rely on CI.
- [ ] **Step 5:** Manual check with `npm start` (owner): Select Area shows lines across the page, drag keeps lines, split view works, prefs apply live.
- [ ] **Step 6:** Commit `feat: wire crosshair into zotero reader and add preferences`.

### Task 7: CI, PR-title lint, release pipeline, docs

**Files:** Create `.github/workflows/ci.yml`, `.github/workflows/pr-title.yml`, `.github/workflows/release.yml`, `.github/dependabot.yml`, `release.config.mjs`, `scripts/publish-update-manifest.sh`, `README.md`.

**Interfaces:**
- Consumes: npm scripts (Task 1); xpi + update manifests in `.scaffold/build/`.

- [ ] **Step 1:** `ci.yml` (push to main, pull_request): jobs `lint` (`npm ci && npm run lint:check`), `unit` (`npm run test:unit`), `build` (`npm run build`, upload `.scaffold/build/*.xpi` as artifact `xpi`), `zotero` (needs build; matrix `zotero: [{v: 7.0.32, ext: tar.bz2}, {v: 10.0.8, ext: tar.xz}]`, `fail-fast: false`; download + extract to `$RUNNER_TEMP/zotero`, cache by version with `actions/cache@v5`? — use latest major of actions/cache; env `ZOTERO_PLUGIN_ZOTERO_BIN_PATH=$RUNNER_TEMP/zotero/Zotero_linux-x86_64/zotero`; run `npm run test:zotero`; if scaffold headless fails, fall back to `xvfb-run` with `test.headless=false`).
- [ ] **Step 2:** `pr-title.yml`: `pull_request_target` types opened/edited/synchronize/reopened, `amannn/action-semantic-pull-request@v6` with default types, `permissions: pull-requests: read`.
- [ ] **Step 3:** `release.config.mjs`: branches `["main"]`, tagFormat `v${version}`, plugins commit-analyzer + release-notes-generator (preset `conventionalcommits`), `@semantic-release/exec` (`prepareCmd: "npm version ${nextRelease.version} --no-git-tag-version --allow-same-version && npm run build"`, `successCmd: "bash scripts/publish-update-manifest.sh"`), `@semantic-release/github` (assets `.scaffold/build/*.xpi`).
- [ ] **Step 4:** `scripts/publish-update-manifest.sh`: `set -euo pipefail`; create release `release` (`--latest=false`, title "Auto-update manifest", notes explaining it) if `gh release view release` fails; `gh release upload release .scaffold/build/update.json .scaffold/build/update-beta.json --clobber`. If Task 1 found the scaffold does not emit `update-beta.json`, copy `update.json` to it first.
- [ ] **Step 5:** `release.yml`: `on: workflow_dispatch` with input `dry-run` (boolean, default false); job guard `if: github.ref == 'refs/heads/main'`; permissions contents/issues/pull-requests write; checkout `fetch-depth: 0`; `npm ci`; seed step: if `git tag -l 'v*'` empty → `git tag v0.0.0 $(git rev-list --max-parents=0 HEAD | tail -n1)`; `npx semantic-release ${{ inputs.dry-run && '--dry-run' || '' }}` with `GITHUB_TOKEN`/`GH_TOKEN` = `secrets.GITHUB_TOKEN`.
- [ ] **Step 6:** `dependabot.yml`: npm + github-actions, weekly, grouped minor/patch, commit-message prefix `build(deps)` / `ci(deps)`.
- [ ] **Step 7:** `README.md`: what/why, screenshot placeholder note, install (download `.xpi` from Releases → Tools › Plugins › gear › Install from file), settings, compatibility (Zotero 7–10), development (`npm install`, `.env`, `npm start`, `npm test`), releasing (Actions › Release › Run workflow; dry-run first; version derived from PR titles; `feat` → minor, `fix` → patch, `!`/`BREAKING CHANGE` → major), repo settings the owner must apply (squash-only, PR title as default commit message, branch protection requiring CI + PR-title checks).
- [ ] **Step 8:** Validate: `npx prettier --check .`, `npx semantic-release --dry-run --no-ci` locally is not possible without a remote — instead run `node -e "import('./release.config.mjs').then(c=>console.log(c.default.plugins.length))"` → `4`; `bash -n scripts/publish-update-manifest.sh` → no output; if `actionlint` is installable via `brew`/`go`, run it on `.github/workflows` → no errors.
- [ ] **Step 9:** Commit `ci: add ci, pr title lint and release workflows`.
