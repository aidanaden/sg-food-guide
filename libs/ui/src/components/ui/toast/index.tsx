import type { ReactNode } from "react";
import { toast as sonnerToast } from "sonner";

import { Num } from "@sg-food-guide/toolkit";

import {
  ToastCloseButton,
  ToastContent,
  ToastDescription,
  ToastIcon,
  ToastRoot,
  ToastTitle,
} from "./Toast";

export { ToastContext, useToast } from "./context";
export { ToastCloseButton, ToastContent, ToastDescription, ToastIcon, ToastRoot, ToastTitle };

const DEFAULT_TOAST_DURATION = 5000;

const DEFAULT_TOAST_STYLE = {
  transitionDuration: "0.2s",
};

type ToastProps = {
  id?: number;
  title: ReactNode;
  description?: ReactNode;
};

const SuccessToast: React.FC<{ toastId: number; title: ReactNode; description?: ReactNode }> = ({
  toastId,
  title,
  description,
}) => {
  return (
    <ToastRoot toastId={toastId}>
      <ToastIcon className="text-success-text ph--check-circle-fill" />
      <ToastContent>
        <ToastTitle>{title}</ToastTitle>
        {description != null && <ToastDescription>{description}</ToastDescription>}
      </ToastContent>
      <ToastCloseButton />
    </ToastRoot>
  );
};

const ErrorToast: React.FC<{ toastId: number; title: ReactNode; description?: ReactNode }> = ({
  toastId,
  title,
  description,
}) => {
  return (
    <ToastRoot toastId={toastId}>
      <ToastIcon className="text-destructive-text ph--x-circle-fill" />
      <ToastContent>
        <ToastTitle>{title}</ToastTitle>
        {description != null && <ToastDescription>{description}</ToastDescription>}
      </ToastContent>
      <ToastCloseButton />
    </ToastRoot>
  );
};

const InfoToast: React.FC<{ toastId: number; title: ReactNode; description?: ReactNode }> = ({
  toastId,
  title,
  description,
}) => {
  return (
    <ToastRoot toastId={toastId}>
      <ToastIcon className="text-primary ph--info-fill" />
      <ToastContent>
        <ToastTitle>{title}</ToastTitle>
        {description != null && <ToastDescription>{description}</ToastDescription>}
      </ToastContent>
      <ToastCloseButton />
    </ToastRoot>
  );
};

const LoadingToast: React.FC<{ toastId: number; title: ReactNode; description?: ReactNode }> = ({
  toastId,
  title,
  description,
}) => {
  return (
    <ToastRoot toastId={toastId}>
      <ToastIcon className="ph--spinner-bold animate-spin" />
      <ToastContent>
        <ToastTitle>{title}</ToastTitle>
        {description != null && <ToastDescription>{description}</ToastDescription>}
      </ToastContent>
    </ToastRoot>
  );
};

export const adminToast = {
  success: ({ id, title, description }: ToastProps) =>
    sonnerToast.custom(
      (toastId) => {
        const _id = Num.toSafeNumber(id ?? toastId);
        return <SuccessToast toastId={_id} title={title} description={description} />;
      },
      {
        ...(id !== undefined && { id }),
        duration: DEFAULT_TOAST_DURATION,
        style: DEFAULT_TOAST_STYLE,
      },
    ),

  error: ({ id, title, description }: ToastProps) =>
    sonnerToast.custom(
      (toastId) => {
        const _id = Num.toSafeNumber(id ?? toastId);
        return <ErrorToast toastId={_id} title={title} description={description} />;
      },
      {
        ...(id !== undefined && { id }),
        duration: DEFAULT_TOAST_DURATION,
        style: DEFAULT_TOAST_STYLE,
      },
    ),

  info: ({ id, title, description }: ToastProps) =>
    sonnerToast.custom(
      (toastId) => {
        const _id = Num.toSafeNumber(id ?? toastId);
        return <InfoToast toastId={_id} title={title} description={description} />;
      },
      {
        ...(id !== undefined && { id }),
        duration: DEFAULT_TOAST_DURATION,
        style: DEFAULT_TOAST_STYLE,
      },
    ),

  loading: ({ id, title, description }: ToastProps): number => {
    const toastId = sonnerToast.custom(
      (tId) => {
        const _id = Num.toSafeNumber(id ?? tId);
        return <LoadingToast toastId={_id} title={title} description={description} />;
      },
      {
        ...(id !== undefined && { id }),
        duration: 30_000,
        style: DEFAULT_TOAST_STYLE,
      },
    );
    return Num.toSafeNumber(toastId);
  },

  dismiss: sonnerToast.dismiss,
};
