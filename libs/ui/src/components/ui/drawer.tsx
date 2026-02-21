import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import * as React from "react";

import { cn } from "../../utils";

const DRAWER_CLOSE_DRAG_DISTANCE = 72;

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

const DrawerOverlay: React.FC<DialogPrimitive.Backdrop.Props> = ({ className, ...props }) => (
  <DialogPrimitive.Backdrop
    data-slot="drawer-overlay"
    className={cn(
      "fixed inset-0 z-50 bg-black/60 data-[closed]:opacity-0 data-[open]:opacity-100 transition-opacity duration-200",
      className,
    )}
    {...props}
  />
);

const DrawerContent: React.FC<DialogPrimitive.Popup.Props> = ({
  className,
  children,
  style,
  ...props
}) => {
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const dragStateRef = React.useRef<{ pointerId: number; startY: number } | null>(null);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

  const clearDragState = React.useCallback(() => {
    dragStateRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  const onDragStart = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    dragStateRef.current = { pointerId: event.pointerId, startY: event.clientY };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onDragMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const nextOffset = Math.max(0, event.clientY - dragState.startY);
    setDragOffset(nextOffset);
  }, []);

  const onDragEnd = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      const dragDistance = Math.max(0, event.clientY - dragState.startY);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      clearDragState();

      if (dragDistance >= DRAWER_CLOSE_DRAG_DISTANCE) {
        closeRef.current?.click();
      }
    },
    [clearDragState],
  );

  const onDragCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      clearDragState();
    },
    [clearDragState],
  );

  const mergedStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (dragOffset <= 0) return style;
    return {
      ...(style ?? {}),
      transform: `translateY(${dragOffset}px)`,
    };
  }, [dragOffset, style]);

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DialogPrimitive.Popup
        data-slot="drawer-content"
        className={cn(
          "bg-background border-border fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[85dvh] flex-col rounded-t-xl border p-0 outline-none data-[closed]:translate-y-2 data-[closed]:opacity-0 data-[open]:translate-y-0 data-[open]:opacity-100 transition-[opacity,transform] duration-200 ease-out",
          isDragging && "transition-none",
          className,
        )}
        style={mergedStyle}
        {...props}
      >
        <DialogPrimitive.Close ref={closeRef} tabIndex={-1} className="sr-only">
          Close
        </DialogPrimitive.Close>
        <div className="flex justify-center py-3">
          <div
            className="bg-muted h-2 w-24 touch-none rounded-full"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragCancel}
          />
        </div>
        {children}
      </DialogPrimitive.Popup>
    </DrawerPortal>
  );
};

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

const DrawerTitle: React.FC<DialogPrimitive.Title.Props> = ({ className, ...props }) => (
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
