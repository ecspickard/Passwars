export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  isConfirming,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="panel w-full max-w-sm p-6">
        <h2 id="confirm-dialog-title" className="font-display text-lg text-parchment-50">
          {title}
        </h2>
        <p className="mt-2 text-sm text-steel-400">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={isConfirming}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="inline-flex items-center justify-center gap-2 rounded-panel bg-signal-500
              px-4 py-2 font-ui font-medium text-parchment-50 transition-colors
              hover:bg-signal-600 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isConfirming ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
