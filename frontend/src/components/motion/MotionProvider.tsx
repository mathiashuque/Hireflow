"use client";

import { MotionConfig } from "motion/react";

/**
 * Honors the OS-level reduced-motion preference globally (reducedMotion="user"),
 * isolated in its own Client Component so the root layout can stay a Server Component.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
