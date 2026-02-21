"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import * as React from "react";

import { cn } from "../../utils";

const Separator: React.FC<SeparatorPrimitive.Props> = ({
  className,
  orientation = "horizontal",
  ...props
}) => {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch",
        className,
      )}
      {...props}
    />
  );
};

export { Separator };
