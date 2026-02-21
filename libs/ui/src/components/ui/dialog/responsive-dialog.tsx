import { type ComponentProps, type FC, type ReactNode } from "react";

import { useMediaQuery } from "../../../environment";
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog-primitives";

type ResponsiveDialogProps = {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const ResponsiveDialog: FC<ResponsiveDialogProps> = ({ children, open, onOpenChange }) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {children}
    </Drawer>
  );
};

type ResponsiveDialogTriggerProps = {
  children: ReactNode;
  className?: string;
};

const ResponsiveDialogTrigger: FC<ResponsiveDialogTriggerProps> = ({ children, className }) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  if (isDesktop) return <DialogTrigger className={className}>{children}</DialogTrigger>;
  return <DrawerTrigger className={className}>{children}</DrawerTrigger>;
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
  const isDesktop = useMediaQuery("(min-width: 768px)");
  if (isDesktop) {
    return (
      <DialogContent className={className} showCloseButton={showCloseButton}>
        {children}
      </DialogContent>
    );
  }
  return <DrawerContent className={className}>{children}</DrawerContent>;
};

type ResponsiveDialogHeaderProps = {
  children: ReactNode;
  className?: string;
};

const ResponsiveDialogHeader: FC<ResponsiveDialogHeaderProps> = ({ children, className }) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  if (isDesktop) return <DialogHeader className={className}>{children}</DialogHeader>;
  return <DrawerHeader className={cn("text-left", className)}>{children}</DrawerHeader>;
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
  const isDesktop = useMediaQuery("(min-width: 768px)");
  if (isDesktop) {
    return (
      <DialogFooter className={className} showCloseButton={showCloseButton}>
        {children}
      </DialogFooter>
    );
  }
  return (
    <DrawerFooter className={cn("[&_[data-slot=button]]:min-h-11", className)}>
      {children}
      {showCloseButton && <DrawerClose render={<Button variant="outline" />}>Close</DrawerClose>}
    </DrawerFooter>
  );
};

type ResponsiveDialogTitleProps = {
  children: ReactNode;
  className?: string;
};

const ResponsiveDialogTitle: FC<ResponsiveDialogTitleProps> = ({ children, className }) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  if (isDesktop) return <DialogTitle className={className}>{children}</DialogTitle>;
  return <DrawerTitle className={className}>{children}</DrawerTitle>;
};

type ResponsiveDialogDescriptionProps = {
  children: ReactNode;
  className?: string;
};

const ResponsiveDialogDescription: FC<ResponsiveDialogDescriptionProps> = ({
  children,
  className,
}) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  if (isDesktop) return <DialogDescription className={className}>{children}</DialogDescription>;
  return <DrawerDescription className={className}>{children}</DrawerDescription>;
};

const ResponsiveDialogClose: FC<{
  children: ReactNode;
  render?: ComponentProps<typeof DrawerClose>["render"];
}> = ({ children, render }) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  if (isDesktop) return <DialogClose>{children}</DialogClose>;
  return <DrawerClose render={render}>{children}</DrawerClose>;
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
};
