export type ToastPayload = {
  id?: string | number;
  title?: string;
  description?: string;
  duration?: number;
};

function emitToastEvent(name: string, payload?: ToastPayload): string {
  const resolvedId = String(payload?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(name, {
        detail: {
          ...payload,
          id: resolvedId,
        },
      }),
    );
  }

  return resolvedId;
}

export const toast = {
  success: (payload?: ToastPayload): string => emitToastEvent("toast:success", payload),
  error: (payload?: ToastPayload): string => emitToastEvent("toast:error", payload),
  info: (payload?: ToastPayload): string => emitToastEvent("toast:info", payload),
  loading: (payload?: ToastPayload): string => emitToastEvent("toast:loading", payload),
  dismiss: (id: string | number): void => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("toast:dismiss", {
          detail: { id: String(id) },
        }),
      );
    }
  },
};
