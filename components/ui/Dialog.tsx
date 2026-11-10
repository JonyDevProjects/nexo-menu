"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reusable accessible dialog primitive.
 * Features: role="dialog", aria-modal, Escape handler, focus trap,
 *          initial focus restoration, pointer-events isolation for overlay.
 */
interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

// Focusable element selectors compatible with most UI libraries
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
].join(", ");

export const Dialog: React.FC<DialogProps> = ({ open, onClose, children, title }) => {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [firstFocusable, setFirstFocusable] = useState<HTMLElement | null>(null);

  // Capture first focusable element when dialog opens
  useEffect(() => {
    if (open && containerRef.current) {
      const focusable = containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTORS);
      setFirstFocusable(focusable);
    }
  }, [open]);

  // Restore focus to trigger on close + prevent body scroll
  useEffect(() => {
    if (!open) return;

    const previousTrigger = triggerRef.current;

    // Trap focus inside dialog
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      );
      if (focusableElements.length === 0) return;

      const firstEl = focusableElements[0];
      const lastEl = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    // Auto-focus first element after render
    requestAnimationFrame(() => {
      firstFocusable?.focus();
    });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      // Restore focus to the button that opened the dialog
      if (previousTrigger) previousTrigger.focus();
    };
  }, [open, onClose, firstFocusable]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking directly on the overlay (not the dialog content)
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={handleOverlayClick}
      style={{ pointerEvents: "auto" }}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        style={{ pointerEvents: "auto" }}
      >
        {title && (
          <div className="px-6 pt-5 pb-0">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
          </div>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
};

/**
 * Hook to programmatically control a dialog while capturing the trigger reference
 * for focus restoration. Use this inside components that already manage their own
 * modal state (e.g., via setState + conditional rendering).
 */
export function useDialogController(initialOpen: boolean = false) {
  const [open, setOpen] = useState(initialOpen);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<(() => void) | null>(null);

  const close = useCallback(() => {
    const cb = closeRef.current;
    if (cb) cb();
    setOpen(false);
  }, []);

  closeRef.current = close;

  const openDialog = useCallback((onCloseHandler: () => void) => {
    closeRef.current = onCloseHandler;
    setOpen(true);
  }, []);

  return { open, openDialog, close, triggerRef };
}
