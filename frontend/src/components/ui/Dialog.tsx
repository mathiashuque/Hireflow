"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { enterTransition, quickTransition } from "@/lib/motion";
import { useI18n } from "@/i18n/LocaleProvider";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** True while a request the dialog started is in flight; suppresses all dismissal paths. */
  preventClose?: boolean;
};

/**
 * Accessible modal dialog: traps and restores focus, locks background scroll, closes on
 * Escape and true backdrop activation, and animates with the shared Motion system
 * (respects the app-wide `reducedMotion="user"` configuration automatically).
 */
export function Dialog({ open, onClose, title, description, children, preventClose = false }: DialogProps) {
  const { dict } = useI18n();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const backdropPointerDownRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const preventCloseRef = useRef(preventClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    preventCloseRef.current = preventClose;
  }, [preventClose]);

  // Runs once per open/close cycle only (not on every preventClose/onClose change) so an
  // in-flight submission never re-triggers focus capture or steals focus from the form.
  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Prefer the first focusable field inside the dialog's body content (e.g. a form
    // field) over the header's close button, which is a fallback action, not the target.
    const firstFocusable =
      contentRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
      panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (preventCloseRef.current) {
          return;
        }
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key === "Tab") {
        const nodes = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (!nodes || nodes.length === 0) {
          return;
        }

        const first = nodes[0];
        const last = nodes[nodes.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={quickTransition}
          onMouseDown={(event) => {
            backdropPointerDownRef.current = event.target === event.currentTarget;
          }}
          onMouseUp={(event) => {
            const startedAndEndedOnBackdrop =
              backdropPointerDownRef.current && event.target === event.currentTarget;
            backdropPointerDownRef.current = false;
            if (startedAndEndedOnBackdrop && !preventClose) {
              onClose();
            }
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={enterTransition}
            className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-card-hover)] outline-none"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-text-primary">
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className="mt-1 text-sm text-text-secondary">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={preventClose}
                aria-label={dict.a11y.closeDialog}
                className="shrink-0 rounded-full p-1.5 text-text-muted transition hover:bg-surface-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                  <path
                    d="M5 5l10 10M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div ref={contentRef} className="mt-4">
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
