"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { tapScale } from "@/lib/motion";

export function AuthNav() {
  const { status, user, logout } = useAuth();

  if (status === "loading") {
    return <span className="text-sm text-text-muted">Loading…</span>;
  }

  if (status === "authenticated" && user) {
    return (
      <div className="flex items-center gap-2.5">
        <Link
          href="/dashboard"
          className="rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Dashboard
        </Link>
        <motion.button
          type="button"
          whileTap={tapScale.whileTap}
          transition={tapScale.transition}
          onClick={() => void logout()}
          className="rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Log out
        </motion.button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <Link
        href="/login"
        className="rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Log in
      </Link>
      <Link
        href="/register"
        className="rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Sign up
      </Link>
    </div>
  );
}
