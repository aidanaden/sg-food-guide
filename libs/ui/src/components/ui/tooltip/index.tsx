import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { type FC } from "react";

import { cn } from "../../../utils";

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip: FC<TooltipPrimitive.Root.Props> = (props) => {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
};

const TooltipTrigger: FC<TooltipPrimitive.Trigger.Props> = (props) => {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
};

type TooltipContentProps = TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">;

const TooltipContent: FC<TooltipContentProps> = ({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 6,
  ...props
}) => {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "bg-surface-overlay text-foreground ring-border max-w-64 rounded-lg px-2 py-1 text-sm shadow-md ring-1",
            "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-open:blur-in-sm data-closed:blur-out-sm",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            "origin-(--transform-origin) outline-hidden duration-100",
            className,
          )}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
};

export { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider };

// Re-export composed components
export * from "./tooltip-text";
