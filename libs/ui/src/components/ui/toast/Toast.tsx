import { useCallback } from "react";
import { toast } from "sonner";

import { cn } from "../../../utils/cn";
import { ToastContext, useToast } from "./context";

type ToastRootProps = React.ComponentProps<"div"> & {
  toastId: number;
};

export const ToastRoot: React.FC<ToastRootProps> = ({ toastId, className, children, ...props }) => {
  const onClose = useCallback(() => {
    toast.dismiss(toastId);
  }, [toastId]);

  return (
    <ToastContext.Provider value={{ id: toastId, onClose }}>
      <div
        className={cn(
          "bg-surface text-foreground ring-border flex w-full items-center gap-2 rounded-lg p-3 text-sm whitespace-nowrap shadow ring-1",
          className,
        )}
        style={{ maxWidth: "22.5rem" }}
        {...props}
      >
        {children}
      </div>
    </ToastContext.Provider>
  );
};

export const ToastIcon: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => {
  return <div aria-hidden="true" className={cn("iconify size-4 shrink-0", className)} {...props} />;
};

export const ToastContent: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => {
  return <div className={cn("[text-wrap:wrap] [overflow-wrap:anywhere]", className)} {...props} />;
};

export const ToastTitle: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => {
  return <div className={cn("", className)} {...props} />;
};

export const ToastDescription: React.FC<React.ComponentProps<"div">> = ({
  className,
  ...props
}) => {
  return <div className={cn("text-foreground-muted", className)} {...props} />;
};

export const ToastCloseButton: React.FC<React.ComponentProps<"button">> = ({
  className,
  onClick,
  ...props
}) => {
  const { onClose } = useToast();

  return (
    <button
      type="button"
      aria-label="Close"
      className={cn(
        "group hover:bg-muted ml-auto flex shrink-0 items-center justify-center rounded-full p-1",
        className,
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        onClick?.(e);
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        className="iconify text-foreground-muted ph--x-bold size-3 group-hover:text-inherit"
      />
    </button>
  );
};
