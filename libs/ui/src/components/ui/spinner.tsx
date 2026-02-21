import * as React from "react";

import { cn } from "../../utils";

/**
 * Props for the Spinner component.
 */
type SpinnerProps = React.ComponentProps<"span"> & {
  /** Size of the spinner. @default "md" */
  size?: "xs" | "sm" | "md" | "lg";
};

const sizeClasses = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
} as const;

/**
 * A loading spinner component with configurable size.
 *
 * @example
 * ```tsx
 * <Spinner size="sm" />
 * <Spinner /> // default medium size
 * <Spinner size="lg" className="text-primary" />
 * ```
 */
const Spinner: React.FC<SpinnerProps> = ({ className, size = "md", ...props }) => {
  return (
    <span
      data-slot="spinner"
      className={cn(
        "iconify ph--spinner text-foreground-muted animate-spin",
        sizeClasses[size],
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
};

export { Spinner };
export type { SpinnerProps };
