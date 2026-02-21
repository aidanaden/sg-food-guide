import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { type FC, type ComponentProps } from "react";

import { cn } from "../../../utils";
import { Button } from "../button";

const Dialog: FC<DialogPrimitive.Root.Props> = (props) => {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
};

const DialogTrigger: FC<DialogPrimitive.Trigger.Props> = (props) => {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
};

const DialogPortal: FC<DialogPrimitive.Portal.Props> = (props) => {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
};

const DialogClose: FC<DialogPrimitive.Close.Props> = (props) => {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
};

const DialogOverlay: FC<DialogPrimitive.Backdrop.Props> = ({ className, ...props }) => {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 transition-all duration-200 ease-out data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 supports-backdrop-filter:backdrop-blur-xs motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
};

type DialogContentProps = DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
};

const DialogContent: FC<DialogContentProps> = ({
  className,
  children,
  showCloseButton = true,
  ...props
}) => {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "bg-background ring-border fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl p-4 text-sm ring-1 transition-all duration-200 ease-out data-[ending-style]:duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95 motion-reduce:transition-none sm:max-w-sm",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />}
          >
            <span aria-hidden="true" className="iconify ph--x-bold text-foreground-muted size-4 shrink-0" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
};

const DialogHeader: FC<ComponentProps<"div">> = ({ className, ...props }) => {
  return (
    <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
  );
};

type DialogFooterProps = ComponentProps<"div"> & {
  showCloseButton?: boolean;
};

const DialogFooter: FC<DialogFooterProps> = ({
  className,
  showCloseButton = false,
  children,
  ...props
}) => {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "bg-background -mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t px-4 py-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>
      )}
    </div>
  );
};

const DialogTitle: FC<DialogPrimitive.Title.Props> = ({ className, ...props }) => {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-left text-base leading-none font-medium", className)}
      {...props}
    />
  );
};

const DialogDescription: FC<DialogPrimitive.Description.Props> = ({ className, ...props }) => {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-foreground-muted *:[a]:hover:text-foreground text-sm *:[a]:underline *:[a]:underline-offset-3",
        className,
      )}
      {...props}
    />
  );
};

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
export type { DialogContentProps, DialogFooterProps };
