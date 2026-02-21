import { DrawerPreview as DrawerPrimitive } from "@base-ui/react/drawer";
import * as React from "react";

import { cn } from "../../utils";

const DRAWER_SAFE_AREA_INSET_BOTTOM = "env(safe-area-inset-bottom)";

type DrawerProps = DrawerPrimitive.Root.Props & {
  shouldScaleBackground?: boolean;
};

const Drawer: React.FC<DrawerProps> = ({
  // Kept for API compatibility with the previous implementation.
  shouldScaleBackground: _shouldScaleBackground = true,
  ...props
}) => <DrawerPrimitive.Root data-slot="drawer" {...props} />;

const DrawerTrigger: React.FC<DrawerPrimitive.Trigger.Props> = (props) => (
  <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
);

const DrawerPortal: React.FC<DrawerPrimitive.Portal.Props> = (props) => (
  <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
);

const DrawerClose: React.FC<DrawerPrimitive.Close.Props> = (props) => (
  <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
);

const DrawerOverlay: React.FC<DrawerPrimitive.Backdrop.Props> = ({ className, ...props }) => (
  <DrawerPrimitive.Backdrop
    data-slot="drawer-overlay"
    className={cn(
      "fixed inset-0 z-50 bg-black/60 transition-all duration-300 ease-out data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none",
      className,
    )}
    {...props}
  />
);

const DrawerContent: React.FC<DrawerPrimitive.Popup.Props> = ({
  className,
  children,
  ...props
}) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Viewport data-slot="drawer-viewport" className="fixed inset-0 z-50 overflow-hidden">
      <DrawerPrimitive.Popup
        data-slot="drawer-content"
        className={cn(
          "bg-background border-border fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-xl border p-0 outline-none transition-all duration-300 ease-out data-[ending-style]:duration-200 data-[starting-style]:translate-y-full data-[starting-style]:opacity-0 data-[ending-style]:translate-y-full data-[ending-style]:opacity-0 motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        <div className="flex justify-center py-3">
          <div aria-hidden="true" className="bg-muted h-2 w-24 rounded-full" />
        </div>
        <DrawerPrimitive.Content
          data-slot="drawer-content-body"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
          style={{ paddingBottom: DRAWER_SAFE_AREA_INSET_BOTTOM }}
        >
          {children}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Popup>
    </DrawerPrimitive.Viewport>
  </DrawerPortal>
);

const DrawerHeader: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => (
  <div
    data-slot="drawer-header"
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
);

const DrawerFooter: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => (
  <div
    data-slot="drawer-footer"
    className={cn("bg-background border-border mt-auto flex flex-col gap-2 border-t p-4", className)}
    {...props}
  />
);

const DrawerTitle: React.FC<DrawerPrimitive.Title.Props> = ({ className, ...props }) => (
  <DrawerPrimitive.Title
    data-slot="drawer-title"
    className={cn("text-lg leading-none font-semibold tracking-tight", className)}
    {...props}
  />
);

const DrawerDescription: React.FC<DrawerPrimitive.Description.Props> = ({
  className,
  ...props
}) => (
  <DrawerPrimitive.Description
    data-slot="drawer-description"
    className={cn("text-foreground-muted text-sm", className)}
    {...props}
  />
);

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
