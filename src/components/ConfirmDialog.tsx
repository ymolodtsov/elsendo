import React, { useRef, useEffect, useCallback, useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [focusedButton, setFocusedButton] = useState<'confirm' | 'cancel'>('confirm');

  // Open/close dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
      setFocusedButton('confirm');
      confirmButtonRef.current?.focus();
    } else {
      dialog.close();
    }
  }, [open]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }

    // Arrow key navigation between buttons
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (focusedButton === 'confirm') {
        setFocusedButton('cancel');
        cancelButtonRef.current?.focus();
      } else {
        setFocusedButton('confirm');
        confirmButtonRef.current?.focus();
      }
    }
  }, [onCancel, focusedButton]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    const dialog = dialogRef.current;
    if (e.target === dialog) {
      onCancel();
    }
  }, [onCancel]);

  const isDanger = variant === 'danger';

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      className="
        fixed inset-0 z-50
        bg-transparent p-0 m-auto
        backdrop:bg-black/40 backdrop:backdrop-blur-sm
        open:animate-fade-in
      "
    >
      <div className="
        bg-white dark:bg-stone-800
        rounded-2xl shadow-2xl
        border border-stone-200/50 dark:border-stone-700/50
        w-[320px] max-w-[calc(100vw-2rem)]
        mx-4
        overflow-hidden
        animate-scale-in
      ">
        {/* Content */}
        <div className="px-5 pt-5 pb-4">
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-1">
            {title}
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions - Confirm on left, Cancel on right */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            onFocus={() => setFocusedButton('confirm')}
            className={`
              flex-1 px-4 py-3 rounded-xl
              text-sm font-medium
              focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-stone-800
              transition-colors
              ${isDanger
                ? 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400'
                : 'bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-800 hover:bg-stone-700 dark:hover:bg-stone-200 focus:ring-stone-400'
              }
            `}
          >
            {confirmLabel}
          </button>
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            onFocus={() => setFocusedButton('cancel')}
            className="
              flex-1 px-4 py-3 rounded-xl
              text-sm font-medium
              bg-stone-100 dark:bg-stone-700
              text-stone-700 dark:text-stone-300
              hover:bg-stone-200 dark:hover:bg-stone-600
              focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 dark:focus:ring-offset-stone-800
              transition-colors
            "
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
};
