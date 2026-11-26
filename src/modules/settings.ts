export interface Settings {
  enabled: boolean;
  /** Line colour on light page backgrounds. */
  colorLight: string;
  /** Line colour on dark page backgrounds. */
  colorDark: string;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  enabled: true,
  colorLight: "#666666",
  colorDark: "#bbbbbb",
});

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Only hex colours are accepted. The value ends up in an inline style, so
 * anything else (named colours, functions, injected declarations) is rejected.
 */
export function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return HEX_COLOR.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

export function normalizeSettings(raw: {
  enabled?: unknown;
  colorLight?: unknown;
  colorDark?: unknown;
}): Settings {
  return {
    enabled: raw.enabled !== false,
    colorLight: normalizeColor(raw.colorLight, DEFAULT_SETTINGS.colorLight),
    colorDark: normalizeColor(raw.colorDark, DEFAULT_SETTINGS.colorDark),
  };
}
