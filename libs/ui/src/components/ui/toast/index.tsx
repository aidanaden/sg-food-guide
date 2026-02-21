import type { ReactNode } from "react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";

import { Num } from "@sg-food-guide/toolkit";

import { cn } from "../../../utils";

const DEFAULT_TOAST_DURATION = 5000;
const LOADING_TOAST_DURATION = 30_000;
const DEFAULT_TOAST_LIMIT = 3;

const toastManager = ToastPrimitive.createToastManager();
let nextToastId = 1;

type ToastKind = "success" | "error" | "info" | "loading";

type ToastProps = {
  id?: number;
  title: ReactNode;
  description?: ReactNode;
};

function resolveToastId(id?: number): string {
  if (typeof id === "number" && Number.isFinite(id)) {
    return String(id);
  }

  const nextId = nextToastId;
  nextToastId += 1;
  return String(nextId);
}

function getToastIconClassName(type?: string): string {
  if (type === "success") return "text-success-text ph--check-circle-fill";
  if (type === "error") return "text-destructive-text ph--x-circle-fill";
  if (type === "loading") return "ph--spinner-bold animate-spin";
  return "text-primary ph--info-fill";
}

function addToast({ id, title, description, type, timeout }: ToastProps & {
  type: ToastKind;
  timeout: number;
}): number {
  const toastId = resolveToastId(id);
  toastManager.add({
    id: toastId,
    title,
    description,
    type,
    timeout,
  });
  return Num.toSafeNumber(toastId);
}

const ToastProvider: React.FC<ToastPrimitive.Provider.Props> = ({
  children,
  timeout = DEFAULT_TOAST_DURATION,
  limit = DEFAULT_TOAST_LIMIT,
  toastManager: _toastManager,
  ...props
}) => {
  return (
    <ToastPrimitive.Provider toastManager={toastManager} timeout={timeout} limit={limit} {...props}>
      {children}
    </ToastPrimitive.Provider>
  );
};

const ToastPortal: React.FC<ToastPrimitive.Portal.Props> = (props) => {
  return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />;
};

const ToastViewport: React.FC<ToastPrimitive.Viewport.Props> = ({ className, ...props }) => {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "fixed right-4 bottom-4 z-50 flex w-[22.5rem] max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none",
        className,
      )}
      {...props}
    />
  );
};

const ToastRoot: React.FC<ToastPrimitive.Root.Props> = ({ className, ...props }) => {
  return (
    <ToastPrimitive.Root
      data-slot="toast-root"
      className={cn(
        "bg-surface text-foreground ring-border data-open:animate-in data-closed:animate-out data-open:fade-in-0 data-closed:fade-out-0 flex w-full items-center gap-2 rounded-lg p-3 text-sm whitespace-nowrap shadow ring-1 duration-150",
        className,
      )}
      {...props}
    />
  );
};

const ToastContent: React.FC<ToastPrimitive.Content.Props> = ({ className, ...props }) => {
  return (
    <ToastPrimitive.Content
      data-slot="toast-content"
      className={cn("[text-wrap:wrap] [overflow-wrap:anywhere]", className)}
      {...props}
    />
  );
};

const ToastTitle: React.FC<ToastPrimitive.Title.Props> = ({ className, ...props }) => {
  return <ToastPrimitive.Title data-slot="toast-title" className={cn("", className)} {...props} />;
};

const ToastDescription: React.FC<ToastPrimitive.Description.Props> = ({ className, ...props }) => {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("text-foreground-muted", className)}
      {...props}
    />
  );
};

const ToastCloseButton: React.FC<ToastPrimitive.Close.Props> = ({
  className,
  children,
  ...props
}) => {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      className={cn(
        "group hover:bg-muted ml-auto flex shrink-0 items-center justify-center rounded-full p-1",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <span
            aria-hidden="true"
            className="iconify text-foreground-muted ph--x-bold size-3 group-hover:text-inherit"
          />
          <span className="sr-only">Close</span>
        </>
      )}
    </ToastPrimitive.Close>
  );
};

const ToastIcon: React.FC<React.ComponentProps<"div">> = ({ className, ...props }) => {
  return <div aria-hidden="true" className={cn("iconify size-4 shrink-0", className)} {...props} />;
};

const ToastList: React.FC = () => {
  const { toasts } = ToastPrimitive.useToastManager();

  return (
    <>
      {toasts.map((toast) => (
        <ToastRoot key={toast.id} toast={toast}>
          <ToastIcon className={getToastIconClassName(toast.type)} />
          <ToastContent>
            <ToastTitle>{toast.title}</ToastTitle>
            {toast.description != null && <ToastDescription>{toast.description}</ToastDescription>}
          </ToastContent>
          {toast.type !== "loading" && <ToastCloseButton />}
        </ToastRoot>
      ))}
    </>
  );
};

type ToasterProps = {
  className?: string;
  timeout?: number;
  limit?: number;
};

const Toaster: React.FC<ToasterProps> = ({
  className,
  timeout = DEFAULT_TOAST_DURATION,
  limit = DEFAULT_TOAST_LIMIT,
}) => {
  return (
    <ToastProvider timeout={timeout} limit={limit}>
      <ToastPortal>
        <ToastViewport className={className}>
          <ToastList />
        </ToastViewport>
      </ToastPortal>
    </ToastProvider>
  );
};

const useToast = ToastPrimitive.useToastManager;

export const adminToast = {
  success: ({ id, title, description }: ToastProps) =>
    addToast({ id, title, description, type: "success", timeout: DEFAULT_TOAST_DURATION }),
  error: ({ id, title, description }: ToastProps) =>
    addToast({ id, title, description, type: "error", timeout: DEFAULT_TOAST_DURATION }),
  info: ({ id, title, description }: ToastProps) =>
    addToast({ id, title, description, type: "info", timeout: DEFAULT_TOAST_DURATION }),
  loading: ({ id, title, description }: ToastProps): number =>
    addToast({ id, title, description, type: "loading", timeout: LOADING_TOAST_DURATION }),
  dismiss: (id?: number) => {
    if (typeof id === "number" && Number.isFinite(id)) {
      toastManager.close(String(id));
    }
  },
};

export {
  ToastProvider,
  ToastPortal,
  ToastViewport,
  ToastRoot,
  ToastContent,
  ToastTitle,
  ToastDescription,
  ToastCloseButton,
  ToastIcon,
  Toaster,
  useToast,
};
