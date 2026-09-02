import type { Transition, Variants } from "motion/react";

/** Shared, restrained motion language: quick, small, opacity/transform-led. */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const springTransition: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.9,
};

export const quickTransition: Transition = {
  duration: 0.18,
  ease: EASE,
};

export const enterTransition: Transition = {
  duration: 0.32,
  ease: EASE,
};

/** Gentle entrance for hero/section content. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: enterTransition },
};

/** Cross-fade for route/state content becoming ready. */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: enterTransition },
  exit: { opacity: 0, transition: quickTransition },
};

/** Parent wrapper that staggers modest-sized lists/cards. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.02,
    },
  },
};

/** Child item for use inside staggerContainer. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: enterTransition },
};

/** Compact panel used for dismissible alerts/feedback banners. */
export const collapsePanel: Variants = {
  hidden: { opacity: 0, height: 0, marginTop: 0 },
  show: { opacity: 1, height: "auto", marginTop: 0, transition: enterTransition },
  exit: { opacity: 0, height: 0, marginTop: 0, transition: quickTransition },
};

/** Restrained hover/tap feedback for interactive cards and controls. */
export const hoverLift = {
  whileHover: { y: -2 },
  whileTap: { y: 0, scale: 0.98 },
  transition: quickTransition,
};

export const tapScale = {
  whileTap: { scale: 0.97 },
  transition: quickTransition,
};
