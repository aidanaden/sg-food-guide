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

function resolveStyleProp<TState>(
  style:
    | React.CSSProperties
    | ((state: TState) => React.CSSProperties | undefined)
    | undefined,
  state: TState,
): React.CSSProperties {
  if (typeof style === "function") {
    return style(state) ?? {};
  }

  return style ?? {};
}

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
  style,
  ...props
}) => (
  <DialogPrimitive.Backdrop
    data-slot="drawer-overlay"
    className={cn("fixed inset-0 z-50 bg-black/60", className)}
    style={(state) => ({
      ...resolveStyleProp(style, state),
      opacity: state.open && state.transitionStatus !== "starting" ? 1 : 0,
      transitionProperty: "opacity",
      transitionDuration: `${DRAWER_CLOSE_ANIMATION_DURATION_MS}ms`,
      transitionTimingFunction: "cubic-bezier(0, 0, 0.2, 1)",
    })}
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

  const getContentStyle = React.useCallback(
    (state: DialogPrimitive.Popup.State): React.CSSProperties => {
      const resolvedStyle = resolveStyleProp(style, state);
      const shouldHide =
        !state.open || state.transitionStatus === "starting" || state.transitionStatus === "ending";
      const transform =
        dragOffset > 0
          ? `translateY(${dragOffset}px)`
          : shouldHide
            ? "translateY(100%)"
            : "translateY(0)";

      return {
        ...resolvedStyle,
        maxHeight: "85dvh",
        opacity: shouldHide ? 0 : 1,
        transform,
        transitionProperty: isDragging ? "none" : "transform, opacity",
        transitionDuration: isDragging ? undefined : `${DRAWER_CLOSE_ANIMATION_DURATION_MS}ms`,
        transitionTimingFunction: isDragging ? undefined : "cubic-bezier(0, 0, 0.2, 1)",
      };
    },
    [dragOffset, isDragging, style],
  );

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DialogPrimitive.Popup
        data-slot="drawer-content"
        className={cn(
          "bg-background border-border fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-xl border p-0 outline-none",
          className,
        )}
        style={getContentStyle}
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
