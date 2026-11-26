# Zotero Annotation Crosshair — Design

Date: 2026-11-26
Status: approved 2026-11-26

## Intent

When you use the "Select Area" tool (image annotation) in Zotero's built-in PDF
reader, it's hard to place the rectangle's corners exactly on a figure's edges.
This plugin draws a thin horizontal and vertical guide line through the mouse
pointer, each spanning the full width/height of the PDF page under the
pointer, so the edges of a figure can be lined up visually before and during
the drag.

The repository must be publishable on GitHub as a well-maintained plugin:
unit tests, CI, semantic versioning from conventional commits, and a
one-click release that tags, builds the `.xpi`, and publishes a GitHub release
with auto-update metadata.

## Goals

- Crosshair visible only while the active reader tool is `image` (Select Area)
  and the pointer is over a PDF page.
- Lines span the page under the pointer (not the whole viewer), are 1 CSS px,
  and sit exactly on the pointer coordinate.
- Lines keep tracking while dragging the selection rectangle.
- Works in every open PDF reader tab, including split view (secondary view).
- Preferences: enable/disable, line colour for light pages, line colour for
  dark pages (see "Light and dark pages").
- Target Zotero 10; support Zotero 7–9 as long as it costs nothing extra.
- Tooling on par with established plugins (windingwind/zotero-plugin-template):
  TypeScript, zotero-plugin-scaffold, ESLint + Prettier, unit tests, CI,
  conventional commits, manual-trigger automated releases, update.json.

## Non-goals

- EPUB / HTML snapshot readers (no Select Area tool there).
- Snapping to figure edges / auto-detection of figures.
- Crosshair for other tools (highlight, ink, …).
- Localisation beyond en-US (Fluent structure in place so it can be added).
- A release-PR workflow (release-please style) — explicitly rejected.

## Anti-goals (failure even if it "works")

- Interfering with the reader's own pointer handling (selection must behave
  exactly as without the plugin: overlay is `pointer-events: none`, listeners
  are passive and never call `preventDefault`/`stopPropagation`).
- Breaking the reader when Zotero internals change. Internal access must
  degrade to "no crosshair", never throw into reader code or spam errors.
- Leaving DOM nodes, listeners or styles behind after disable / plugin
  shutdown / tab close.

## Constraints and facts found during research

- Zotero 10 runs on Firefox 140 ESR (same as Zotero 9). esbuild target
  `firefox115` covers Zotero 7+.
- There is no public API to learn the active reader tool. The tool is at
  `reader._internalReader._state.tool.type` (string `'image'` for Select Area).
  This is internal and may change.
- The PDF view is a nested iframe:
  `reader._internalReader._primaryView._iframeWindow` (pdf.js `viewer.html`);
  split view adds `_secondaryView`. Pages are `.page` elements inside
  `#viewerContainer`; pdf.js destroys/re-creates page contents on scroll, so
  overlay nodes must not live inside `.page`.
- `reader._initPromise` resolves after `_internalReader` exists; views expose
  `initializedPromise`.
- `Zotero.Reader.registerEventListener('renderToolbar', handler, pluginID)` is
  public and fires for each reader as it renders — usable as the "a reader
  appeared" signal. Listeners registered with the plugin ID are removed on
  plugin shutdown; we still unregister explicitly.
- `zotero-plugin test` does not download Zotero; CI must fetch the Linux
  tarball and point `ZOTERO_PLUGIN_ZOTERO_BIN_PATH` at it. Scaffold's built-in
  headless mode supports Ubuntu 22.04/24.04 runners.
- `strict_max_version`: Zotero 10 docs recommend `10.0.*` after confirming
  compatibility.

## Approaches considered

### Tool detection

1. **Read tool state on every pointer move (chosen).** No monkey-patching;
   if internals change, the crosshair simply doesn't appear. Trade-off: after
   a keyboard tool switch with a stationary mouse, the lines appear/disappear
   on the next pointer move.
2. Wrap each view's `setTool` method. Instant updates, but patches Zotero
   code, must track late-created views, and is fragile across versions.

User picked (1) "for now". The code isolates tool detection behind one
function so (2) could be added later without touching the rest.

### Release flow

1. **Manually triggered workflow + semantic-release (chosen).** A
   `workflow_dispatch` "Release" action on `main` analyses conventional
   commits since the last tag, computes the next semver, sets it in the build
   (not committed back), builds the `.xpi`, creates the tag and GitHub release
   with generated notes and the `.xpi` asset, and refreshes `update.json` on a
   rolling `release` tag. Optional `dry-run` input.
2. Template style (`npm run release` locally with bumpp → tag push → CI
   publishes). Rejected: version picked by hand, local step required.
3. release-please (release PR). Rejected by user.

### Feature rendering

Only one sensible way: two absolutely positioned `<div>`s in the pdf.js
viewer document (outside `.page`), `pointer-events: none`, positioned from the
page's bounding rect and the pointer's client coordinates. Canvas overlay or
CSS cursor images were dismissed (canvas: more code for two lines; cursor
image: can't span the page).

## Design

### Architecture (src/)

- `index.ts` / `addon.ts` / `hooks.ts` — template-style lifecycle
  (`onStartup`, `onMainWindowLoad/Unload`, `onShutdown`, `onPrefsEvent`).
- `modules/geometry.ts` — **pure**. Given page rects and a pointer
  coordinate: choose the page containing the point (during a drag the pointer
  may leave the page: keep the page where the drag started, clamp the line
  position to its bounds); compute the horizontal/vertical line boxes
  relative to the overlay's coordinate space. Unit-tested.
- `modules/tool.ts` — **pure-ish**. `isAreaToolActive(reader): boolean`,
  reads `_internalReader._state.tool.type` defensively (optional chaining,
  try/catch → `false`). Unit-tested with fake reader objects.
- `modules/crosshair.ts` — `CrosshairController` bound to one pdf.js view
  window: creates overlay nodes + a `<style>` element, attaches passive
  `pointermove` / `pointerdown` / `pointerup` / `pointerleave` / `scroll`
  listeners, calls geometry + tool modules, `destroy()` removes everything.
  Tested with a fake DOM (happy-dom or linkedom) in unit tests.
- `modules/readerRegistry.ts` — keeps a `WeakMap<view window, controller>`.
  Attaches controllers for existing readers at startup and for new ones via
  the `renderToolbar` event; re-scans a reader's views lazily (e.g. when its
  view changes / on pointer enter) to pick up the split view; destroys all on
  shutdown or disable. Controllers whose window unloads clean themselves up
  (`unload` listener).
- `modules/prefs.ts` — typed access to `enabled` and `color`; colour
  validated (fallback to default on invalid values). Unit-tested.
- `modules/preferenceScript.ts` + `addon/content/preferences.xhtml` —
  preference pane registered via `Zotero.PreferencePanes.register`.

### Behaviour details

- Visible iff: plugin enabled ∧ tool is `image` ∧ pointer over a page (or a
  drag that started on a page is in progress).
- Line style: 1px solid, colour chosen per page background (see "Light and
  dark pages"). Both lines drawn above page
  content, below reader popups (z-index chosen within the viewer document).
- Native cursor: while active, the viewer cursor is set to `crosshair` via a
  stylesheet rule with `!important` (PDFView sets inline `cursor` styles).
  My call: the arrow cursor's tip is visually offset from the line
  intersection; `crosshair` keeps the hotspot at the intersection.
- Scroll/zoom: recompute on `scroll` using the last pointer position; hide on
  `pointerleave`.
- Pref changes apply live to all open readers.

### Repository and tooling

- Based on windingwind/zotero-plugin-template layout: `addon/`
  (`manifest.json`, `bootstrap.js`, `prefs.js`, `content/`,
  `locale/en-US/*.ftl`), `src/`, `test/`, `typings/`,
  `zotero-plugin.config.ts`, ESM `package.json`.
- Manifest: `strict_min_version` `6.999` (Zotero 7), `strict_max_version`
  `10.0.*`; `update_url` → `https://github.com/<owner>/<repo>/releases/download/release/update.json`.
- Tests:
  - **Unit** (`test/unit/**`, runs in Node via Mocha + Chai, no Zotero):
    geometry, tool detection, prefs validation, crosshair controller against
    a fake DOM.
  - **Integration** (`test/zotero/**`, `zotero-plugin test`): plugin starts
    and registers; opening a PDF and switching to the image tool produces an
    overlay. Runs in CI with a downloaded Zotero 10 Linux build.
- CI (`.github/workflows/ci.yml`, push + PR): lint (Prettier + ESLint),
  typecheck, unit tests, build (upload `.xpi` as workflow artifact),
  integration tests. A separate workflow lints the **PR title** as a
  conventional commit (squash merges are enforced, so the PR title becomes
  the commit on `main`).
- Release (`.github/workflows/release.yml`, `workflow_dispatch` on `main`,
  input `dry-run`): semantic-release with commit-analyzer,
  release-notes-generator, exec (inject version → build), github (tag +
  release + `.xpi` asset); then upload `update.json` (and `update-beta.json`)
  to the rolling `release` release with `gh release upload --clobber`.
- Dependabot for npm and GitHub Actions.
- README: what it does, install, development, release process,
  conventional-commit cheat sheet.

## Light and dark pages (added 2026-11-26)

Problem: a colour chosen for light pages can become nearly invisible when
the system switches to dark mode.

- Two prefs replace the single `color`: `colorLight` (default `#666666`,
  about 5.7:1 on white) and `colorDark` (default `#bbbbbb`, about 6.6:1 on
  Zotero's default dark theme `#2E3440`). Owner asked for subtle grey defaults.
  Trade-off noted in the README: grey guides can blend with grey figure lines.
- The choice follows the **page background**, not the app mode. The reader
  sets `--background-color` on the pdf.js document root from app mode,
  the theme chosen for that mode, and per-reader overrides. App mode alone is
  wrong when `reader.darkTheme` is "none" (dark app, white pages) or a light
  theme like Sepia is used.
- A background is dark when its relative luminance is below 0.179, the point
  where white contrasts better than black.
- Fallback when `--background-color` is missing or unparseable:
  `matchMedia('(prefers-color-scheme: dark)')`. Its `change` event triggers a
  refresh so an OS switch applies without moving the mouse.
- Approaches considered: app mode via `prefers-color-scheme` only (rejected:
  white-page case above); auto-contrast halo (rejected: line looks ~3px);
  `mix-blend-mode: difference` (rejected: ignores colour, vanishes on grey).

## Calls made after builder review (owner may override)

- **Merge style:** owner enforces squash merges, so only the PR title is
  linted (no per-commit lint, no local git hook).
- **No beta channel.** Release runs only on `main`. `update-beta.json` is
  published as a copy of `update.json` (template convention, so a future
  beta channel needs no manifest URL change).
- **Compatibility is tested, not just declared:** the integration job runs
  as a matrix against latest Zotero 7.0.x and latest Zotero 10. If 7 fails
  and the fix isn't trivial, `strict_min_version` is raised instead of
  claiming support.
- **First version 0.1.0:** if no `v*` tag exists, the release workflow tags
  the root commit `v0.0.0` before running semantic-release, so the first
  `feat:` release is 0.1.0. (semantic-release pushes tags with `--tags`, so
  `v0.0.0` ends up on the remote as a harmless marker.)
- **Reader discovery by polling:** a 500 ms timer scans
  `Zotero.Reader._readers` (PDF only), attaches to new view windows, and
  re-evaluates visibility. This covers readers open before startup, split
  view, view re-creation on reload, and keyboard tool switches without a
  pointer move. `renderToolbar` is not used.
- **Do not call `Zotero.Reader.unregisterEventListener`:** in Zotero 10 its
  filter is inverted and would remove every *other* listener. (Moot now that
  `renderToolbar` isn't used, but noted for future changes.)
- **Tool detection:** prefer `_internalReader.toolType` (Zotero's own code
  uses it), fall back to `_internalReader._state.tool.type`.
- **Cursor:** only replace the reader's `default` cursor with `crosshair`
  (CSS `#viewerContainer[style*="cursor: default"]`), so resize/move cursors
  over existing annotations stay intact.

## Left to the builder

- Exact scaffold/semantic-release versions and their config syntax.
- Choice of fake-DOM library and Mocha runner wiring (ts via tsx/esbuild).
- Mechanism for picking up a late-created secondary view.
- Zotero download URL and caching in CI.
- Icon artwork (simple crosshair SVG/PNG).

## Owner decisions

- GitHub repo: `RonMcKay/zotero-annotation-cross-hair` (remote added by owner).
- Add-on ID: `annotation-crosshair@ronmckay.github.io`.
- License: MIT. First release: 0.1.0.
