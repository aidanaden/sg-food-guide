import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ComponentProps,
  type FC,
  type ReactNode,
} from "react";

import { useIsMobile } from "../../../environment";
import { cn } from "../../../utils";
import { Button } from "../button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog-primitives";

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
 * A responsive dialog component that renders as a Dialog on desktop
 * and as a Drawer on mobile devices.
 */
const ResponsiveDialog: FC<ResponsiveDialogProps> = ({
  open: controlledOpen,
  onOpenChange,
  children,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isMobile = useIsMobile();

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const contextValue = useMemo(() => ({ open, setOpen, isMobile }), [open, setOpen, isMobile]);

  if (isMobile) {
    return (
      <ResponsiveDialogContext.Provider value={contextValue}>
        <Drawer open={open} onOpenChange={setOpen}>
          {children}
        </Drawer>
      </ResponsiveDialogContext.Provider>
    );
  }

  return (
    <ResponsiveDialogContext.Provider value={contextValue}>
      <Dialog open={open} onOpenChange={setOpen}>
        {children}
      </Dialog>
    </ResponsiveDialogContext.Provider>
  );
};

type ResponsiveDialogTriggerProps = {
  children: ReactNode;
  className?: string;
};

const ResponsiveDialogTrigger: FC<ResponsiveDialogTriggerProps> = ({ children, className }) => {
  const { isMobile } = useResponsiveDialog();

  if (isMobile) {
    return <DrawerTrigger className={className}>{children}</DrawerTrigger>;
  }

  return <DialogTrigger className={className}>{children}</DialogTrigger>;
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
  const { isMobile } = useResponsiveDialog();

  if (isMobile) {
    return <DrawerContent className={className}>{children}</DrawerContent>;
  }

  return (
    <DialogContent className={className} showCloseButton={showCloseButton}>
      {children}
    </DialogContent>
  );
};

type ResponsiveDialogHeaderProps = {
  children: ReactNode;
  className?: string;
};

const ResponsiveDialogHeader: FC<ResponsiveDialogHeaderProps> = ({ children, className }) => {
  const { isMobile } = useResponsiveDialog();

  if (isMobile) {
    return <DrawerHeader className={cn("text-left", className)}>{children}</DrawerHeader>;
  }

  return <DialogHeader className={className}>{children}</DialogHeader>;
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
  const { isMobile } = useResponsiveDialog();

  if (isMobile) {
    return (
      <DrawerFooter className={cn("[&_[data-slot=button]]:min-h-11", className)}>
        {children}
        {showCloseButton && <DrawerClose render={<Button variant="outline" />}>Close</DrawerClose>}
      </DrawerFooter>
    );
  }

  return (
    <DialogFooter className={className} showCloseButton={showCloseButton}>
      {children}
    </DialogFooter>
  );
};

type ResponsiveDialogTitleProps = {
  children: ReactNode;
  className?: string;
};

const ResponsiveDialogTitle: FC<ResponsiveDialogTitleProps> = ({ children, className }) => {
  const { isMobile } = useResponsiveDialog();

  if (isMobile) {
    return <DrawerTitle className={className}>{children}</DrawerTitle>;
  }

  return <DialogTitle className={className}>{children}</DialogTitle>;
};

type ResponsiveDialogDescriptionProps = {
  children: ReactNode;
  className?: string;
};

const ResponsiveDialogDescription: FC<ResponsiveDialogDescriptionProps> = ({
  children,
  className,
}) => {
  const { isMobile } = useResponsiveDialog();

  if (isMobile) {
    return <DrawerDescription className={className}>{children}</DrawerDescription>;
  }

  return <DialogDescription className={className}>{children}</DialogDescription>;
};

const ResponsiveDialogClose: FC<{
  children: ReactNode;
  render?: ComponentProps<typeof DrawerClose>["render"];
  /** Accessible label for the close button when children is not text */
  "aria-label"?: string;
}> = ({ children, render, "aria-label": ariaLabel }) => {
  const { setOpen, isMobile } = useResponsiveDialog();

  if (isMobile) {
    return <DrawerClose render={render}>{children}</DrawerClose>;
  }

  // For desktop dialog, we just close via setOpen
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
