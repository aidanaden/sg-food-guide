import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul-base";

import { cn } from "../../utils";

const Drawer: React.FC<React.ComponentProps<typeof DrawerPrimitive.Root>> = ({
  shouldScaleBackground = true,
  ...props
}) => <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />;

const DrawerTrigger: React.FC<React.ComponentProps<typeof DrawerPrimitive.Trigger>> = (props) => (
  <DrawerPrimitive.Trigger {...props} />
);

const DrawerPortal: React.FC<React.ComponentProps<typeof DrawerPrimitive.Portal>> = (props) => (
  <DrawerPrimitive.Portal {...props} />
);

const DrawerClose: React.FC<React.ComponentProps<typeof DrawerPrimitive.Close>> = (props) => (
  <DrawerPrimitive.Close {...props} />
);

const DrawerOverlay: React.FC<React.ComponentProps<typeof DrawerPrimitive.Overlay>> = ({
  className,
  ...props
}) => (
  <DrawerPrimitive.Overlay
    data-slot="drawer-overlay"
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
);

const DrawerContent: React.FC<React.ComponentProps<typeof DrawerPrimitive.Content>> = ({
  className,
  children,
  ...props
}) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      data-slot="drawer-content"
      className={cn(
        "bg-background fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-xl border",
        className,
      )}
      {...props}
    >
      <div className="bg-muted mx-auto mt-4 h-2 w-24 rounded-full" />
      {children}
    </DrawerPrimitive.Content>
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
    className={cn("bg-background mt-auto flex flex-col gap-2 border-t p-4", className)}
    {...props}
  />
);

const DrawerTitle: React.FC<React.ComponentProps<typeof DrawerPrimitive.Title>> = ({
  className,
  ...props
}) => (
  <DrawerPrimitive.Title
    data-slot="drawer-title"
    className={cn("text-lg leading-none font-semibold tracking-tight", className)}
    {...props}
  />
);

const DrawerDescription: React.FC<React.ComponentProps<typeof DrawerPrimitive.Description>> = ({
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
