# Contributing

Thanks for helping out! Bug reports, ideas and pull requests are all welcome.

## Development setup

Requirements: Node.js LTS and Zotero 7 or newer installed locally.

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

## Keep your own Zotero library safe

- **Tests never touch your library.** `npm run test:zotero` always starts
  Zotero with a throwaway profile and data directory under `.scaffold/test/`,
  whatever your `.env` says. The integration tests also refuse to run unless
  Zotero's data directory is inside `.scaffold`.
- **`npm start` uses the profile and data directory from `.env`.** Leave
  `ZOTERO_PLUGIN_PROFILE_PATH` and `ZOTERO_PLUGIN_DATA_DIR` empty for a
  throwaway `.scaffold/data` directory, or point both at a git-ignored folder
  such as `zotero-dev/`. Only point them at your real profile if you mean to.
- **Ctrl+C can kill your normal Zotero.** When you stop `npm start` or
  `npm run test:zotero` with Ctrl+C, the build tool kills Zotero. Its macOS
  default is `kill -9 $(ps -x | grep zotero)`, which also force-quits a normal
  Zotero you have open. On macOS and Linux, set this in your `.env` so only
  the instances the tool started itself are killed:

  ```text
  ZOTERO_PLUGIN_KILL_COMMAND = pkill -9 -f -- -start-debugger-server
  ```

## Project layout

```
addon/                       static plugin files (manifest, bootstrap, prefs, pane, locale)
src/hooks.ts                 lifecycle: startup / shutdown, timer, prefs observer
src/modules/geometry         pure line maths
src/modules/settings         pref validation (hex colours only)
src/modules/background       page-background brightness (light vs dark)
src/modules/tool             defensive access to reader internals
src/modules/crosshair        the overlay inside one pdf.js view window
src/modules/registry         one overlay per live view window
src/modules/prefs            reading, writing and observing Zotero prefs
src/modules/preferencePane   settings pane registration and colour pickers
test/unit                    Node tests (Mocha, Chai, happy-dom)
test/zotero                  in-Zotero tests (zotero-plugin-scaffold)
```

Everything under `src/modules` except `prefs` and `preferencePane` is free of
Zotero globals, so it can be unit-tested in Node. Keep new logic there when
you can, and add a test for it.

## Pull requests

Pull requests are **squash-merged**, so the **PR title** becomes the commit
message on `main`. It must follow
[Conventional Commits](https://www.conventionalcommits.org), and a CI check
enforces this. The title also decides what the next release will be:

| PR title                                        | Release effect          |
| ----------------------------------------------- | ----------------------- |
| `fix: …`                                        | patch (0.1.0 → 0.1.1)   |
| `feat: …`                                       | minor (0.1.0 → 0.2.0)   |
| `feat!: …` or a `BREAKING CHANGE:` footer       | major (0.x → 1.0.0)     |
| `docs:`, `ci:`, `build:`, `chore:`, `refactor:` | no release on their own |

Before opening a PR, run `npm run lint:check` and `npm test`.
