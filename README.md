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

## Contributing

Bug reports and pull requests are welcome. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, tests and
pull request conventions.

## License

[MIT](LICENSE)
