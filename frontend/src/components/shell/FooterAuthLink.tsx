"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useI18n } from "@/i18n/LocaleProvider";

const LINK_CLASS =
  "rounded-sm font-medium text-text-secondary transition hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** Shows a Dashboard link in the public footer only once the session is known to be authenticated. */
export function FooterAuthLink() {
  const { status } = useAuth();
  const { dict, href } = useI18n();

  if (status !== "authenticated") {
    return null;
  }

  return (
    <Link href={href("/dashboard")} className={LINK_CLASS}>
      {dict.nav.dashboard}
    </Link>
  );
}
