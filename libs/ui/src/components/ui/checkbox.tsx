import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../utils";

const checkboxVariants = cva(
  "border-border-input bg-surface-raised hover:bg-surface-hover hover:border-border-hover aria-invalid:aria-checked:border-primary aria-invalid:border-destructive aria-invalid:border-destructive focus-visible:border-ring focus-visible:ring-ring aria-invalid:ring-destructive aria-invalid:ring-destructive peer relative flex size-4 shrink-0 items-center justify-center rounded border transition-colors outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2",
  {
    variants: {
      variant: {
        default:
          "data-checked:bg-primary data-checked:border-primary data-checked:text-primary-foreground data-checked:hover:bg-primary-hover data-checked:hover:border-primary-hover",
        tick:
          "data-checked:bg-primary data-checked:border-primary data-checked:hover:bg-primary-hover data-checked:hover:border-primary-hover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type CheckboxProps = CheckboxPrimitive.Root.Props & VariantProps<typeof checkboxVariants>;

const Checkbox: React.FC<CheckboxProps> = ({ className, variant, ...props }) => {
  const resolvedVariant = variant ?? "default";

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(checkboxVariants({ variant: resolvedVariant }), className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className={cn(
          "grid place-content-center transition-none",
          resolvedVariant === "tick" ? "text-surface" : "text-primary-foreground",
        )}
      >
        <span aria-hidden="true" className="iconify ph--check size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
};

export { Checkbox };
