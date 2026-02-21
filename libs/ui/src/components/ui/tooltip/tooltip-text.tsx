import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { type FC, type ReactNode } from "react";

import { cn } from "../../../utils";

type TooltipTextProps = {
  children: ReactNode;
  tooltip: ReactNode;
  className?: string;
};

/**
 * A text component with a dashed underline that displays a tooltip on hover.
 * If children is null/undefined, renders nothing.
 */
const TooltipText: FC<TooltipTextProps> = ({ children, tooltip, className }) => {
  // Don't render if children is empty
  if (children == null) {
    return null;
  }

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger delay={200} tabIndex={0} className="cursor-default">
        <span
          className={cn(
            "decoration-foreground-faint hover:decoration-foreground underline decoration-dotted underline-offset-2 transition-colors",
            className,
          )}
        >
          {children}
        </span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side="top" sideOffset={6} className="isolate z-50">
          <TooltipPrimitive.Popup
            data-slot="tooltip-content"
            className={cn(
              "bg-surface-overlay text-foreground ring-border max-w-64 rounded-lg px-2 py-1 text-sm break-all shadow-md ring-1",
              "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-open:blur-in-sm data-closed:blur-out-sm",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
              "origin-(--transform-origin) outline-hidden duration-100",
            )}
          >
            {tooltip}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};

export { TooltipText };
export type { TooltipTextProps };
