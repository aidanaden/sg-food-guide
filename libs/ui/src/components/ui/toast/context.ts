import { createContext, useContext } from "react";

type ToastContextValue = {
  id: number;
  onClose: () => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastContext.Provider");
  }
  return context;
};
