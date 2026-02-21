type Rgb = {
  r: number;
  g: number;
  b: number;
};

/**
 * Parse a hex color string into RGB components.
 * Supports 3-digit (`#RGB`) and 6-digit (`#RRGGBB`) formats.
 */
export function hexToRgbObj(hex: string): Rgb {
  const clean = hex.replace("#", "");
  // Convert 3-digit hex to 6-digit by duplicating each character (f0a → ff00aa)
  const expanded = clean.length === 3 ? clean.replace(/./g, "$&$&") : clean;

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

/**
 * Convert hex color to CSS `rgb()` format with opacity.
 *
 * @example
 * hexToRgb('#ff0000', 0.5) // → 'rgb(255 0 0 / 0.5)'
 */
export function hexToRgb(hex: string, opacity = 1): string {
  const { r, g, b } = hexToRgbObj(hex);
  return `rgb(${r} ${g} ${b} / ${opacity})`;
}

/**
 * Convert hex color to CSS `rgba()` format with opacity.
 *
 * @example
 * hexToRgba('#ff0000', 0.5) // → 'rgba(255, 0, 0, 0.5)'
 */
export function hexToRgba(hex: string, opacity = 1): string {
  const { r, g, b } = hexToRgbObj(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * HSLA color representation with conversion utilities.
 *
 * Provides bidirectional conversion between hex, RGB, and HSLA formats.
 * Useful for programmatic color manipulation (charts, themes, palettes).
 *
 * @example
 * ```ts
 * const color = HslaColor.fromHex('#FF5733');
 * color.l += 10; // lighten
 * const lighter = color.toHex(); // → "#FF8566"
 * ```
 */
export class HslaColor {
  h: number;
  s: number;
  l: number;
  a: number;

  constructor(h: number, s: number, l: number, a: number) {
    this.h = h;
    this.s = s;
    this.l = l;
    this.a = a;
  }

  /**
   * Create from a hex color string.
   * Returns `null` if the input is invalid.
   */
  static fromHex(hex: string): HslaColor | null {
    let clean = hex.replace("#", "");
    if (clean.length === 3)
      clean = clean
        .split("")
        .map((x) => x + x)
        .join("");
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;

    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);

    return HslaColor.fromRgb({ r, g, b, a: 1 });
  }

  /**
   * Create from RGBA values (r/g/b: 0-255, a: 0-1).
   */
  static fromRgb({ r, g, b, a }: { r: number; g: number; b: number; a: number }): HslaColor {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    const d = max - min;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case r:
          h = ((g - b) / d) % 6;
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h *= 60;
      if (h < 0) h += 360;
    }

    return new HslaColor(h, s * 100, l * 100, a);
  }

  /** Convert to RGBA tuple [r, g, b, a] (r/g/b: 0-255, a: 0-1). */
  toRgba(): [number, number, number, number] {
    const { h } = this;
    const s = this.s / 100;
    const l = this.l / 100;
    const a = this.a;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0;
    let g = 0;
    let b = 0;
    if (h >= 0 && h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];

    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255), a];
  }

  /** Convert to hex string (`#RRGGBB`). */
  toHex(): string {
    const [r, g, b] = this.toRgba();
    return (
      "#" +
      [r, g, b]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    );
  }

  /** Convert to CSS `rgba()` string. */
  toRgbaCss(): string {
    const [r, g, b, a] = this.toRgba();
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(2)})`;
  }
}
