/**
 * Access to Zotero reader internals. None of this is public API, so every
 * lookup is defensive: if Zotero changes its internals, the crosshair simply
 * doesn't appear instead of breaking the reader.
 */

export const AREA_TOOL = "image";

interface InternalReaderLike {
  toolType?: unknown;
  _state?: { tool?: { type?: unknown } };
  _primaryView?: { _iframeWindow?: Window | null } | null;
  _secondaryView?: { _iframeWindow?: Window | null } | null;
}

interface ReaderLike {
  type?: unknown;
  _internalReader?: InternalReaderLike | null;
}

function internalReader(reader: unknown): InternalReaderLike | undefined {
  try {
    return (
      (reader as ReaderLike | null | undefined)?._internalReader ?? undefined
    );
  } catch {
    return undefined;
  }
}

export function isAreaToolActive(reader: unknown): boolean {
  try {
    const internal = internalReader(reader);
    if (!internal) return false;
    const type = internal.toolType ?? internal._state?.tool?.type;
    return type === AREA_TOOL;
  } catch {
    return false;
  }
}

export function getViewWindows(reader: unknown): Window[] {
  try {
    if ((reader as ReaderLike | null | undefined)?.type !== "pdf") return [];
    const internal = internalReader(reader);
    if (!internal) return [];
    return [internal._primaryView, internal._secondaryView]
      .map((view) => view?._iframeWindow)
      .filter((win): win is Window => !!win);
  } catch {
    return [];
  }
}
