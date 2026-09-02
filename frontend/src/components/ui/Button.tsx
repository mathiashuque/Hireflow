"use client";

import { motion } from "motion/react";
import { tapScale } from "@/lib/motion";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const VARIANT_STYLES: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-strong focus-visible:outline-brand disabled:bg-slate-300",
  secondary:
    "border border-border-strong bg-surface text-text-secondary hover:bg-surface-muted focus-visible:outline-brand disabled:opacity-50",
  danger:
    "border border-red-200 text-danger-text hover:bg-danger-soft focus-visible:outline-red-500 disabled:opacity-50",
  ghost: "text-text-secondary hover:bg-surface-muted focus-visible:outline-brand disabled:opacity-50",
};

const SIZE_STYLES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

type ButtonProps = React.ComponentProps<typeof motion.button> & {
  variant?: Variant;
  size?: Size;
};

/** Shared button primitive with restrained tap feedback; native <button> semantics preserved. */
export function Button({ variant = "secondary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <motion.button
      type={type}
      whileTap={props.disabled ? undefined : tapScale.whileTap}
      transition={tapScale.transition}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className ?? ""}`}
      {...props}
    />
  );
}
