import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import * as React from "react";

import { cn } from "../../utils";

const DRAWER_CLOSE_DRAG_DISTANCE = 72;
const DRAWER_CLOSE_ANIMATION_DURATION_MS = 200;

type DragState = {
  mode: "pointer" | "touch";
  id: number;
  startY: number;
  lastY: number;
};

type DrawerProps = DialogPrimitive.Root.Props & {
  shouldScaleBackground?: boolean;
};

const Drawer: React.FC<DrawerProps> = ({
  // Kept for API compatibility with the previous vaul-based implementation.
  shouldScaleBackground: _shouldScaleBackground = true,
  onOpenChange,
  actionsRef,
  ...props
}) => {
  const internalActionsRef = React.useRef<DialogPrimitive.Root.Actions | null>(null);
  const closeTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = internalActionsRef.current;
  });

  React.useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        globalThis.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleOpenChange = React.useCallback<NonNullable<DialogPrimitive.Root.Props["onOpenChange"]>>(
    (open, eventDetails) => {
      if (closeTimeoutRef.current !== null) {
        globalThis.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }

      if (!open) {
        eventDetails.preventUnmountOnClose();
        closeTimeoutRef.current = globalThis.setTimeout(() => {
          internalActionsRef.current?.unmount();
          closeTimeoutRef.current = null;
        }, DRAWER_CLOSE_ANIMATION_DURATION_MS);
      }

      onOpenChange?.(open, eventDetails);
    },
    [onOpenChange],
  );

  return (
    <DialogPrimitive.Root
      data-slot="drawer"
      actionsRef={internalActionsRef}
      onOpenChange={handleOpenChange}
      {...props}
    />
  );
};

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
      "fixed inset-0 z-50 bg-black/60 opacity-100 data-starting-style:opacity-0 data-ending-style:opacity-0 data-closed:opacity-0 transition-opacity duration-200",
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
  const dragStateRef = React.useRef<DragState | null>(null);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);

  const startDrag = React.useCallback((state: DragState) => {
    dragStateRef.current = state;
    setIsDragging(true);
  }, []);

  const updateDrag = React.useCallback((clientY: number) => {
    const state = dragStateRef.current;
    if (!state) return;

    state.lastY = clientY;
    setDragOffset(Math.max(0, clientY - state.startY));
  }, []);

  const clearDragState = React.useCallback(() => {
    dragStateRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  const endDrag = React.useCallback(
    (clientY?: number) => {
      const state = dragStateRef.current;
      if (!state) return;

      const finalY = clientY ?? state.lastY;
      const dragDistance = Math.max(0, finalY - state.startY);

      clearDragState();

      if (dragDistance >= DRAWER_CLOSE_DRAG_DISTANCE) {
        closeRef.current?.click();
      }
    },
    [clearDragState],
  );

  const onDragPointerStart = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      startDrag({
        mode: "pointer",
        id: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
      });

      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [startDrag],
  );

  const onDragPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.mode !== "pointer" || dragState.id !== event.pointerId) return;

      updateDrag(event.clientY);
    },
    [updateDrag],
  );

  const onDragPointerEnd = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.mode !== "pointer" || dragState.id !== event.pointerId) return;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      endDrag(event.clientY);
    },
    [endDrag],
  );

  const onDragPointerCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.mode !== "pointer" || dragState.id !== event.pointerId) return;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      clearDragState();
    },
    [clearDragState],
  );

  const getTouchByIdentifier = React.useCallback((touches: React.TouchList, id: number) => {
    for (let index = 0; index < touches.length; index += 1) {
      const touch = touches.item(index);
      if (touch && touch.identifier === id) {
        return touch;
      }
    }

    return null;
  }, []);

  const onDragTouchStart = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches.item(0);
    if (!touch) return;

    startDrag({
      mode: "touch",
      id: touch.identifier,
      startY: touch.clientY,
      lastY: touch.clientY,
    });
  }, [startDrag]);

  const onDragTouchMove = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.mode !== "touch") return;

    const touch =
      getTouchByIdentifier(event.touches, dragState.id) ??
      getTouchByIdentifier(event.changedTouches, dragState.id);
    if (!touch) return;

    event.preventDefault();
    updateDrag(touch.clientY);
  }, [getTouchByIdentifier, updateDrag]);

  const onDragTouchEnd = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.mode !== "touch") return;

    const touch = getTouchByIdentifier(event.changedTouches, dragState.id);
    if (!touch) return;

    endDrag(touch.clientY);
  }, [endDrag, getTouchByIdentifier]);

  const onDragTouchCancel = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.mode !== "touch") return;

    const touch = getTouchByIdentifier(event.changedTouches, dragState.id);
    if (!touch) return;

    clearDragState();
  }, [clearDragState, getTouchByIdentifier]);

  const mergedStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (dragOffset <= 0) {
      return {
        ...(style ?? {}),
        maxHeight: "85dvh",
      };
    }

    return {
      ...(style ?? {}),
      maxHeight: "85dvh",
      transform: `translateY(${dragOffset}px)`,
    };
  }, [dragOffset, style]);

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DialogPrimitive.Popup
        data-slot="drawer-content"
        className={cn(
          "bg-background border-border fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-xl border p-0 opacity-100 outline-none translate-y-0 data-starting-style:translate-y-full data-starting-style:opacity-0 data-ending-style:translate-y-full data-ending-style:opacity-0 data-closed:translate-y-full data-closed:opacity-0 transition duration-200 ease-out",
          isDragging && "transition-none",
          className,
        )}
        style={mergedStyle}
        {...props}
      >
        <DialogPrimitive.Close ref={closeRef} tabIndex={-1} className="sr-only">
          Close
        </DialogPrimitive.Close>
        <div
          className="flex cursor-grab touch-none justify-center py-3 active:cursor-grabbing"
          onPointerDown={onDragPointerStart}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerEnd}
          onPointerCancel={onDragPointerCancel}
          onTouchStart={onDragTouchStart}
          onTouchMove={onDragTouchMove}
          onTouchEnd={onDragTouchEnd}
          onTouchCancel={onDragTouchCancel}
        >
          <div
            aria-hidden="true"
            className="bg-muted h-2 w-24 rounded-full"
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
