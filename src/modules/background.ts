export interface RGB {
  r: number;
  g: number;
  b: number;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_FN =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+%?\s*)?\)$/i;

/**
 * Relative luminance at which black and white text have equal contrast:
 * (L + 0.05) / 0.05 === 1.05 / (L + 0.05)  =>  L = sqrt(0.0525) - 0.05.
 */
const DARK_THRESHOLD = Math.sqrt(0.0525) - 0.05;

/** Parses `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`; else null. */
export function parseCssColor(value: string): RGB | null {
  const v = value.trim();
  const hex = HEX.exec(v);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3) digits = digits.replace(/./g, "$&$&");
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
    };
  }
  const fn = RGB_FN.exec(v);
  if (fn) {
    const [r, g, b] = fn.slice(1, 4).map(Number);
    if ([r, g, b].every((c) => c <= 255)) return { r, g, b };
  }
  return null;
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance({ r, g, b }: RGB): number {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** True/false for a readable colour, null if it can't be parsed. */
export function isDarkBackground(value: string): boolean | null {
  const rgb = parseCssColor(value);
  return rgb ? relativeLuminance(rgb) < DARK_THRESHOLD : null;
}
