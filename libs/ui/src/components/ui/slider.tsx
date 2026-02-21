import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import * as React from "react";

import { cn } from "../../utils";

const Slider: React.FC<SliderPrimitive.Root.Props> = ({ className, ...props }) => (
  <SliderPrimitive.Root
    data-slot="slider"
    className={cn("w-full", className)}
    thumbAlignment="edge"
    {...props}
  />
);

const SliderControl: React.FC<SliderPrimitive.Control.Props> = ({ className, ...props }) => (
  <SliderPrimitive.Control
    data-slot="slider-control"
    className={cn(
      "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
      className,
    )}
    {...props}
  />
);

const SliderTrack: React.FC<SliderPrimitive.Track.Props> = ({ className, ...props }) => (
  <SliderPrimitive.Track
    data-slot="slider-track"
    className={cn("bg-muted relative h-1.5 w-full grow rounded-full select-none", className)}
    {...props}
  />
);

const SliderIndicator: React.FC<SliderPrimitive.Indicator.Props> = ({ className, ...props }) => (
  <SliderPrimitive.Indicator
    data-slot="slider-range"
    className={cn("bg-primary h-full rounded-full select-none", className)}
    {...props}
  />
);

const SliderThumb: React.FC<SliderPrimitive.Thumb.Props> = ({ className, ...props }) => (
  <SliderPrimitive.Thumb
    data-slot="slider-thumb"
    className={cn(
      "border-ring ring-ring/50 relative block size-5 shrink-0 cursor-grab rounded-full border bg-white transition-colors transition-shadow select-none after:absolute after:-inset-2 hover:ring-2 focus-visible:ring-2 focus-visible:outline-hidden active:ring-2 disabled:pointer-events-none disabled:opacity-50 data-[dragging]:cursor-grabbing",
      className,
    )}
    {...props}
  />
);

export { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack };
