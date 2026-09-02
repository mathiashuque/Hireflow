"use client";

import { motion, type Variants } from "motion/react";
import { enterTransition, fadeIn, fadeUp } from "@/lib/motion";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "fade" | "fade-up";
  delay?: number;
};

/** Small entrance wrapper for content becoming ready — cross-fade or gentle rise. */
export function Reveal({ children, className, variant = "fade-up", delay = 0 }: RevealProps) {
  const base = variant === "fade" ? fadeIn : fadeUp;
  const variants: Variants = delay
    ? {
        ...base,
        show: { ...base.show, transition: { ...enterTransition, delay } },
      }
    : base;

  return (
    <motion.div className={className} initial="hidden" animate="show" variants={variants}>
      {children}
    </motion.div>
  );
}
