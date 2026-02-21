import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { useIsMobile } from "../../../environment";
import { cn } from "../../../utils";
import { Button } from "../button";

type ResponsiveDialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  isMobile: boolean;
};

const ResponsiveDialogContext = createContext<ResponsiveDialogContextValue | null>(null);

function useResponsiveDialog() {
  const context = useContext(ResponsiveDialogContext);
  if (!context) {
    throw new Error("useResponsiveDialog must be used within a ResponsiveDialog");
  }
  return context;
}

type ResponsiveDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

/**
 * Responsive dialog state container.
 * Renders no wrapper element and lets Trigger/Content coordinate through context.
 */
const ResponsiveDialog: FC<ResponsiveDialogProps> = ({
  open: controlledOpen,
  onOpenChange,
  children,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isMobile = useIsMobile();

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (onOpenChange) {
        onOpenChange(nextOpen);
        return;
      }
      setUncontrolledOpen(nextOpen);
    },
    [onOpenChange],
  );

  const contextValue = useMemo(() => ({ open, setOpen, isMobile }), [open, setOpen, isMobile]);

  return (
    <ResponsiveDialogContext.Provider value={contextValue}>
      {children}
    </ResponsiveDialogContext.Provider>
  );
};

type ResponsiveDialogTriggerProps = {
  children: ReactNode;
  className?: string;
};

const ResponsiveDialogTrigger: FC<ResponsiveDialogTriggerProps> = ({ children, className }) => {
  const { setOpen } = useResponsiveDialog();

  return (
    <button
      type="button"
      className={className}
      aria-haspopup="dialog"
      onClick={() => setOpen(true)}
    >
      {children}
    </button>
  );
};

type ResponsiveDialogContentProps = {
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
};

const ResponsiveDialogContent: FC<ResponsiveDialogContentProps> = ({
  children,
  className,
  showCloseButton = true,
}) => {
  const { open, setOpen, isMobile } = useResponsiveDialog();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, open]);

  useEffect(() => {
    if (!mounted || !open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted, open, setOpen]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        className={cn(
          "absolute inset-0 m-0 h-full w-full border-0 p-0",
          isMobile ? "bg-black/60" : "bg-black/10 supports-backdrop-filter:backdrop-blur-xs",
        )}
        onClick={() => setOpen(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          isMobile
            ? "bg-background fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[85dvh] flex-col rounded-t-xl border p-0 outline-none"
            : "bg-background ring-foreground/10 fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl p-4 text-sm ring-1 outline-none sm:max-w-sm",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {isMobile && <div className="bg-muted mx-auto mt-4 h-2 w-24 rounded-full" />}

        {!isMobile && showCloseButton && (
          <Button
            variant="ghost"
            className="absolute top-2 right-2"
            size="icon-sm"
            onClick={() => setOpen(false)}
          >
            <span aria-hidden="true" className="iconify ph--x size-4" />
            <span className="sr-only">Close</span>
          </Button>
        )}

        {children}
      </div>
    </div>,
    document.body,
  );
};

type ResponsiveDialogHeaderProps = {
  children: ReactNode;
  className?: string;
};

const ResponsiveDialogHeader: FC<ResponsiveDialogHeaderProps> = ({ children, className }) => {
  const { isMobile } = useResponsiveDialog();

  if (isMobile) {
    return <div className={cn("grid gap-1.5 p-4 text-left", className)}>{children}</div>;
  }

  return <div className={cn("flex flex-col gap-2", className)}>{children}</div>;
};

type ResponsiveDialogFooterProps = {
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
};

const ResponsiveDialogFooter: FC<ResponsiveDialogFooterProps> = ({
  children,
  className,
  showCloseButton = false,
}) => {
  const { isMobile, setOpen } = useResponsiveDialog();

  if (isMobile) {
    return (
      <div className={cn("bg-background mt-auto flex flex-col gap-2 border-t p-4", className)}>
        {children}
        {showCloseButton && (
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-background -mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t px-4 py-2 sm:flex-row sm:justify-end",
        className,
      )}
    >
      {children}
      {showCloseButton && (
        <Button variant="outline" onClick={() => setOpen(false)}>
          Close
        </Button>
      )}
    </div>
  );
};

type ResponsiveDialogTitleProps = {
  children: ReactNode;
  className?: string;
};

const ResponsiveDialogTitle: FC<ResponsiveDialogTitleProps> = ({ children, className }) => {
  const { isMobile } = useResponsiveDialog();

  return (
    <h2 className={cn(isMobile ? "text-lg leading-none font-semibold tracking-tight" : "text-base leading-none font-medium", className)}>
      {children}
    </h2>
  );
};

type ResponsiveDialogDescriptionProps = {
  children: ReactNode;
  className?: string;
};

const ResponsiveDialogDescription: FC<ResponsiveDialogDescriptionProps> = ({
  children,
  className,
}) => {
  return (
    <p
      className={cn(
        "text-foreground-muted *:[a]:hover:text-foreground text-sm *:[a]:underline *:[a]:underline-offset-3",
        className,
      )}
    >
      {children}
    </p>
  );
};

const ResponsiveDialogClose: FC<{
  children: ReactNode;
  render?: unknown;
  /** Accessible label for the close button when children is not text */
  "aria-label"?: string;
}> = ({ children, render: _render, "aria-label": ariaLabel }) => {
  const { setOpen } = useResponsiveDialog();

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? (typeof children !== "string" ? "Close dialog" : undefined)}
      onClick={() => setOpen(false)}
    >
      {children}
    </button>
  );
};

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogClose,
  useResponsiveDialog,
};
