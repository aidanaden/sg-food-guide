/**
 * Returns the current page padding value in pixels.
 *
 * Reads the `--page-padding` CSS variable from :root and converts it to pixels.
 * This value is responsive (8px on mobile, 16px on sm+) and is the single source
 * of truth for horizontal page padding throughout the app.
 *
 * ## Why this exists
 *
 * The page layout uses horizontal padding (`px-page`) that changes at the `sm`
 * breakpoint. Components that need full-bleed styling (like VirtualTable on mobile)
 * use negative margins (`-mx-page`) to extend to the viewport edge.
 *
 * VirtualTableWindow needs this value in pixels (not CSS) for its `horizontalPadding`
 * prop, which adds inline padding to edge cells so content aligns with the page
 * container while the table itself extends full-width.
 *
 * ## Usage
 *
 * ```tsx
 * // In VirtualTableWindow - reads CSS variable as default
 * const horizontalPadding = props.horizontalPadding ?? getPagePadding();
 * ```
 *
 * ## Responsiveness
 *
 * The value is read once at call time. Since VirtualTableWindow re-mounts when
 * switching between mobile (window mode) and desktop (container mode) via the
 * `mode` prop, it will naturally re-read the correct value on breakpoint changes.
 *
 * @returns Page padding in pixels (8 on mobile, 16 on sm+)
 */
export const getPagePadding = (): number => {
  // SSR/test fallback - assume desktop
  if (typeof window === "undefined") return 16;

  const root = document.documentElement;
  const cssValue = getComputedStyle(root).getPropertyValue("--page-padding").trim();

  // Parse rem value (e.g., "0.5rem" -> 0.5)
  const remValue = parseFloat(cssValue);
  if (Number.isNaN(remValue)) return 16; // Fallback if parsing fails

  // Convert rem to pixels using root font size
  const rootFontSize = parseFloat(getComputedStyle(root).fontSize);
  return remValue * rootFontSize;
};
