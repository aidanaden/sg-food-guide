import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import * as React from "react";

import { cn } from "../../utils";

const ScrollArea: React.FC<ScrollAreaPrimitive.Root.Props> = ({
  className,
  children,
  ...props
}) => {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="focus-visible:ring-ring size-full transition-colors transition-shadow outline-none focus-visible:ring-2 focus-visible:outline-1"
        style={{ borderRadius: "inherit" }}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
};

const ScrollBar: React.FC<ScrollAreaPrimitive.Scrollbar.Props> = ({
  className,
  orientation = "vertical",
  ...props
}) => {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="bg-border hover:bg-border-hover relative flex-1 rounded-full transition-colors"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
};

export { ScrollArea, ScrollBar };
