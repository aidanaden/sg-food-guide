import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import * as React from "react";

import { cn } from "../../utils";

type DrawerProps = DialogPrimitive.Root.Props & {
  shouldScaleBackground?: boolean;
};

const Drawer: React.FC<DrawerProps> = ({
  // Kept for API compatibility with the previous vaul-based implementation.
  shouldScaleBackground: _shouldScaleBackground = true,
  ...props
}) => <DialogPrimitive.Root data-slot="drawer" {...props} />;

const DrawerTrigger: React.FC<DialogPrimitive.Trigger.Props> = (props) => (
  <DialogPrimitive.Trigger data-slot="drawer-trigger" {...props} />
);

const DrawerPortal: React.FC<DialogPrimitive.Portal.Props> = (props) => (
  <DialogPrimitive.Portal data-slot="drawer-portal" {...props} />
);

const DrawerClose: React.FC<DialogPrimitive.Close.Props> = (props) => (
  <DialogPrimitive.Close data-slot="drawer-close" {...props} />
);

const DrawerOverlay: React.FC<DialogPrimitive.Backdrop.Props> = ({
  className,
  ...props
}) => (
  <DialogPrimitive.Backdrop
    data-slot="drawer-overlay"
    className={cn(
      "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 fixed inset-0 z-50 bg-black/60 duration-100",
      className,
    )}
    {...props}
  />
);

const DrawerContent: React.FC<DialogPrimitive.Popup.Props> = ({
  className,
  children,
  ...props
}) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DialogPrimitive.Popup
      data-slot="drawer-content"
      className={cn(
        "bg-background data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[85dvh] flex-col rounded-t-xl border p-0 outline-none duration-100",
        className,
      )}
      {...props}
    >
      <div className="bg-muted mx-auto mt-4 h-2 w-24 rounded-full" />
      {children}
    </DialogPrimitive.Popup>
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

const DrawerTitle: React.FC<DialogPrimitive.Title.Props> = ({
  className,
  ...props
}) => (
  <DialogPrimitive.Title
    data-slot="drawer-title"
    className={cn("text-lg leading-none font-semibold tracking-tight", className)}
    {...props}
  />
);

const DrawerDescription: React.FC<DialogPrimitive.Description.Props> = ({
  className,
  ...props
}) => (
  <DialogPrimitive.Description
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
