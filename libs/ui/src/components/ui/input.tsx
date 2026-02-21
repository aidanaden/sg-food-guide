import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

import { cn } from "../../utils";

const Input: React.FC<React.ComponentProps<"input">> = ({ className, type, ...props }) => {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "dark:bg-gray-3 border-border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-gray-3 dark:disabled:bg-gray-5 file:text-foreground placeholder:text-foreground-muted h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 md:text-sm",
        className,
      )}
      {...props}
    />
  );
};

export { Input };
