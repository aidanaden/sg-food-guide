import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../../utils";

const buttonVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring aria-invalid:ring-destructive aria-invalid:ring-destructive aria-invalid:border-destructive aria-invalid:border-destructive group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover [a]:hover:bg-primary-hover",
        outline:
          "border-border-input bg-surface-raised hover:border-border-hover hover:bg-surface-hover hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-muted text-foreground hover:bg-muted-hover hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        "destructive-solid":
          "bg-destructive text-destructive-foreground hover:bg-destructive-hover focus-visible:ring-destructive focus-visible:ring-destructive focus-visible:border-destructive",
        "destructive-ghost":
          "bg-destructive-hover text-destructive-text hover:bg-destructive-active hover:text-destructive-foreground focus-visible:border-destructive focus-visible:ring-destructive focus-visible:ring-destructive",
        link: "text-primary underline-offset-4 hover:text-primary-hover hover:underline",
      },
      size: {
        default:
          "h-8 min-h-11 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 sm:min-h-8",
        xs: "h-6 min-h-11 gap-1 rounded-md px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 sm:min-h-6 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 min-h-11 gap-1 rounded-md px-2.5 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 sm:min-h-7 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 min-h-11 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 sm:min-h-9",
        icon: "size-8 min-h-11 min-w-11 sm:min-h-8 sm:min-w-8",
        "icon-xs":
          "size-6 min-h-11 min-w-11 rounded-md in-data-[slot=button-group]:rounded-lg sm:min-h-6 sm:min-w-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 min-h-11 min-w-11 rounded-md in-data-[slot=button-group]:rounded-lg sm:min-h-7 sm:min-w-7",
        "icon-lg": "size-9 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

const Button: React.FC<ButtonProps> = ({
  className,
  variant = "default",
  size = "default",
  ...props
}) => {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
};

export { Button, buttonVariants };
