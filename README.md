# Annotation Crosshair for Zotero

Page-wide crosshair guides for the **Select Area** tool in Zotero's built-in
PDF reader.

When you draw an image annotation around a figure, it is hard to tell whether
the rectangle's corner sits exactly on the figure's edge. With this plugin, a
thin horizontal and vertical line follows the pointer across the whole PDF
page while Select Area is active, so you can line up the edges before and
while you drag.

- Lines span the page under the pointer and are 1px wide, centred on the
  pointer.
- They keep tracking while you drag, clamped to the page you started on.
- Works in split view. Nothing changes for any other tool.
- Subtle grey by default, with separate colours for light and dark pages,
  so a dark reader theme never hides the lines. Both colours can be
  configured, and the crosshair can be switched off.

## Install

1. Download the latest `annotation-crosshair.xpi` from
   [Releases](https://github.com/RonMcKay/zotero-annotation-cross-hair/releases/latest).
2. In Zotero, open **Tools → Plugins**, click the gear icon, choose
   **Install Plugin From File…** and select the `.xpi`.

Zotero updates the plugin automatically after that.

**Compatibility:** Zotero 7 to 10 (CI tests against 7.0.32 and 10.0.8).

## Settings

**Zotero → Settings → Annotation Crosshair**

- **Show crosshair while the Select Area tool is active**: on/off.
- **Line colour on light pages**: default mid grey `#666666`.
- **Line colour on dark pages**: default light grey `#bbbbbb`.
- **Reset** next to each colour restores its default.

The plugin picks the colour from the **page background**, not from Zotero's
light/dark mode. So it also gets it right when dark mode shows white pages
(reader dark theme set to none) or when you use a light theme such as Sepia.
If the page background can't be read, it falls back to the app's light/dark
mode.

Grey guides can blend into figures with grey axes or gridlines. If that
happens, choose a stronger colour.

## How it works

Zotero has no public API that tells plugins which reader tool is active. The
plugin therefore reads the reader's internal state (`_internalReader.toolType`)
and draws two absolutely positioned, click-through `<div>`s inside the pdf.js
view. All access to internals is defensive. If a future Zotero version
renames them, the crosshair just stops appearing, and the reader itself keeps
working. Every 500 ms, open readers are re-scanned to pick up new tabs, split
views and keyboard tool switches.

## Development

Requirements: Node.js LTS and Zotero 7+ installed locally.

```bash
npm install
cp .env.example .env   # set ZOTERO_PLUGIN_ZOTERO_BIN_PATH
npm start              # starts Zotero with the plugin and hot-reloads on changes
```

| Command               | What it does                                                   |
| --------------------- | -------------------------------------------------------------- |
| `npm run build`       | Production build to `.scaffold/build/` (`.xpi`, `update.json`) |
| `npm run lint:check`  | Prettier and ESLint                                            |
| `npm run lint:fix`    | Auto-fix formatting and lint issues                            |
| `npm run test:unit`   | Fast Node tests (geometry, settings, overlay, reader tracking) |
| `npm run test:zotero` | Integration tests inside a real Zotero                         |
| `npm test`            | Both test suites                                               |

### Your library is safe during tests

`npm run test:zotero` always starts Zotero with a throwaway profile and data
directory under `.scaffold/test/`, whatever your `.env` says. The integration
tests also refuse to run unless Zotero's data directory is inside `.scaffold`.

`npm start` uses `ZOTERO_PLUGIN_PROFILE_PATH` and `ZOTERO_PLUGIN_DATA_DIR`
from `.env`. Leave both empty to get a throwaway `.scaffold/data` directory.
Only point them at a real profile if you mean to.

### Layout

```
addon/                 static plugin files (manifest, bootstrap, prefs, pane, locale)
src/hooks.ts           lifecycle: startup / shutdown, timer, prefs observer
src/modules/geometry   pure line maths
src/modules/settings   pref validation (hex colours only)
src/modules/background page-background brightness (light vs dark)
src/modules/tool       defensive access to reader internals
src/modules/crosshair  the overlay inside one pdf.js view window
src/modules/registry   one overlay per live view window
test/unit              Node tests (Mocha, Chai, happy-dom)
test/zotero            in-Zotero tests (zotero-plugin-scaffold)
```

## Contributing and releases

Commits on `main` follow [Conventional Commits](https://www.conventionalcommits.org).
Pull requests are **squash-merged**, so the **PR title** becomes the commit
message. A CI check enforces the format.

| PR title                                        | Release effect          |
| ----------------------------------------------- | ----------------------- |
| `fix: …`                                        | patch (0.1.0 → 0.1.1)   |
| `feat: …`                                       | minor (0.1.0 → 0.2.0)   |
| `feat!: …` or a `BREAKING CHANGE:` footer       | major (0.x → 1.0.0)     |
| `docs:`, `ci:`, `build:`, `chore:`, `refactor:` | no release on their own |

To release, open **Actions → Release → Run workflow** on `main`. Tick
**dry-run** first to preview the version and notes. The workflow then does
the following:

1. computes the next version from the PR titles since the last tag
2. builds the `.xpi` with that version
3. creates the `vX.Y.Z` tag and a GitHub release with notes and the `.xpi`
4. uploads `update.json` to the rolling `release` release, which installed
   plugins poll for updates

Versions are not committed back. `package.json` stays at `0.0.0` and git tags
hold the version.

The first release is `0.1.0`. When no version tag exists, the workflow tags
the repository's root commit `v0.0.0`, and the root commit's own changes are
not part of any release. So the repository must start with an empty root
commit, `git commit --allow-empty -m "chore: initial commit"`, followed by
the real commits. The workflow refuses to run if `main` has only one commit.

## License

[MIT](LICENSE)
