"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { BrandMark } from "@/components/BrandMark";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { tapScale } from "@/lib/motion";
import { useI18n } from "@/i18n/LocaleProvider";

/** Persistent authenticated top bar: Hireflow/dashboard affordance, signed-in user, and logout. */
export function AppHeader() {
  const { user, logout } = useAuth();
  const { dict, href } = useI18n();

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link
          href={href("/dashboard")}
          className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <BrandMark />
        </Link>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {user ? (
            <span className="hidden text-sm text-text-secondary sm:inline">{user.displayName}</span>
          ) : null}
          <motion.button
            type="button"
            whileTap={tapScale.whileTap}
            transition={tapScale.transition}
            onClick={() => void logout()}
            className="rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {dict.nav.logout}
          </motion.button>
        </div>
      </div>
    </header>
  );
}
