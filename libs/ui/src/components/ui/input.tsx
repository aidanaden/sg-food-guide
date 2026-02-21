import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

import { cn } from "../../utils";

const Input: React.FC<React.ComponentProps<"input">> = ({ className, type, ...props }) => {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "bg-surface-raised border-border-input hover:bg-surface-hover hover:border-border-hover focus-visible:border-ring focus-visible:ring-ring aria-invalid:ring-destructive aria-invalid:ring-destructive aria-invalid:border-destructive aria-invalid:border-destructive disabled:bg-surface-raised disabled:bg-muted-active file:text-foreground placeholder:text-foreground-muted h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 md:text-sm",
        className,
      )}
      {...props}
    />
  );
};

export { Input };
