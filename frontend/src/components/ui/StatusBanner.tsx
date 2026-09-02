"use client";

import { AnimatePresence, motion } from "motion/react";
import { collapsePanel } from "@/lib/motion";
import { Button } from "@/components/ui/Button";

type Tone = "danger" | "warning" | "success" | "info";

const TONE_STYLES: Record<Tone, string> = {
  danger: "bg-danger-soft text-danger-text",
  warning: "bg-warning-soft text-warning-text",
  success: "bg-success-soft text-success-text",
  info: "bg-brand-soft text-brand-strong",
};

type StatusBannerProps = {
  tone?: Tone;
  role?: "alert" | "status";
  children: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
};

export function StatusBanner({ tone = "info", role = "status", children, onRetry, retryLabel = "Try again" }: StatusBannerProps) {
  return (
    <div role={role} className={`overflow-hidden rounded-lg px-3.5 py-2.5 text-sm ${TONE_STYLES[tone]}`}>
      <p>{children}</p>
      {onRetry ? (
        <Button variant="primary" size="sm" onClick={onRetry} className="mt-3">
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Wraps a dismissible/conditional status message with an exit animation. Keep the
 * parent mounted around this and vary `active`/`children` by key for the transition
 * to apply cleanly.
 */
export function AnimatedStatus({ id, children }: { id: string | null; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {id ? (
        <motion.div key={id} variants={collapsePanel} initial="hidden" animate="show" exit="exit">
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
