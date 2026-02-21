import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * A hook that returns whether a media query matches.
 * Returns `false` during SSR and on first render to avoid hydration mismatches.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/**
 * A hook that returns whether the viewport is mobile-sized (< 768px).
 * Returns `false` during SSR and on first render to avoid hydration mismatches.
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}
