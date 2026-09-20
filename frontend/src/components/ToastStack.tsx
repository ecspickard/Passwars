import { useToast, type ToastVariant } from "../context/ToastContext";

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: "border-steel-500 text-parchment-100",
  success: "border-felt-500 text-parchment-50",
  error: "border-signal-500 text-parchment-50",
};

const VARIANT_ICON: Record<ToastVariant, string> = {
  info: "♞",
  success: "♛",
  error: "♟",
};

export function ToastStack() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => {
        const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac');
        return (
          <div
            key={toast.id}
            role="status"
            className={`panel flex items-start gap-3 border-l-4 px-4 py-3 shadow-lg shadow-black/40 ${VARIANT_STYLES[toast.variant]}`}
          >
            <span className={`text-gold-400 ${isMac ? '-translate-y-0.5 inline-block' : 'mt-0.5'}`} aria-hidden>
              {VARIANT_ICON[toast.variant]}
            </span>
            <p className={`flex-1 text-sm leading-snug ${isMac ? 'mt-0.5' : ''}`}>{toast.message}</p>
          <button
            onClick={() => dismissToast(toast.id)}
            className="text-steel-400 hover:text-parchment-50"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
        );
      })}
    </div>
  );
}
