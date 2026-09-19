// Hook to trigger toast notifications from anywhere in the app.
// Assumes ToastContext exists and is mounted at the root level.

import { useContext } from "react";

/**
 * If ToastContext doesn't exist, this is a minimal fallback that just
 * logs to console. Replace with your actual ToastContext if you have one.
 */
const ToastContext = (() => {
  try {
    return require("../context/ToastContext").ToastContext;
  } catch {
    return null;
  }
})();

export interface UseToastReturn {
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

export function useToast(): UseToastReturn {
  // If ToastContext is available, use it
  if (ToastContext) {
    const ctx = useContext(ToastContext);
    if (ctx) return ctx;
  }

  // Fallback: just log and alert
  return {
    showToast: (message: string, type = "info") => {
      console.log(`[Toast ${type}]`, message);
      if (type === "error") alert(message);
    },
  };
}