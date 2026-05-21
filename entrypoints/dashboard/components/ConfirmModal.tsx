import React from 'react';

export function ConfirmModal({
  open,
  title,
  message,
  confirmText,
  cancelText,
  isDestructive,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm?: () => void | Promise<void>;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-content-card ${isDestructive ? 'border-destructive/20' : 'border-border'}`}>
        <h3 className={`text-sm font-semibold mb-2 ${isDestructive ? 'text-destructive' : 'text-foreground'}`}>{title}</h3>
        <div className="text-xs text-muted-foreground mb-6 leading-relaxed">{message}</div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 bg-secondary text-secondary-foreground border border-input hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
          >
            {cancelText || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (onConfirm) void onConfirm();
              onClose();
            }}
            className={`inline-flex items-center justify-center rounded-md text-xs font-semibold px-3 py-1.5 shadow cursor-pointer transition-colors ${
              isDestructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
