"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";

const LINK_CLASS =
  "rounded-sm font-medium text-text-secondary transition hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** Shows a Dashboard link in the public footer only once the session is known to be authenticated. */
export function FooterAuthLink() {
  const { status } = useAuth();

  if (status !== "authenticated") {
    return null;
  }

  return (
    <Link href="/dashboard" className={LINK_CLASS}>
      Dashboard
    </Link>
  );
}
