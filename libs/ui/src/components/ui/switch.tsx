"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import * as React from "react";

import { cn } from "../../utils";

type SwitchProps = SwitchPrimitive.Root.Props & {
  size?: "sm" | "default";
};

const Switch: React.FC<SwitchProps> = ({ className, size = "default", ...props }) => {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "bg-muted border-border data-checked:bg-primary data-checked:border-primary hover:bg-muted-hover hover:border-border-hover data-checked:hover:bg-primary-hover focus-visible:border-ring focus-visible:ring-ring aria-invalid:ring-destructive aria-invalid:ring-destructive aria-invalid:border-destructive aria-invalid:border-destructive peer group/switch relative inline-flex shrink-0 items-center rounded-full border transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-2 aria-invalid:ring-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[size=default]:h-4.5 data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-surface-raised data-unchecked:bg-muted-hover data-checked:bg-foreground pointer-events-none block rounded-full ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-3.5 group-data-[size=sm]/switch:data-checked:translate-x-2.5 group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
};

export { Switch };
