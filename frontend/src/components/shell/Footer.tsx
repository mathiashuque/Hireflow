"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { FooterAuthLink } from "@/components/shell/FooterAuthLink";
import { useI18n } from "@/i18n/LocaleProvider";

const LINK_CLASS =
  "rounded-sm font-medium text-text-secondary transition hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

type FooterProps = {
  variant: "public" | "app";
};

/** Shared, restrained footer for both shells: brand context plus only real internal destinations. */
export function Footer({ variant }: FooterProps) {
  const { dict, href } = useI18n();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-2">
          <BrandMark withWordmark={false} />
          <p className="text-sm text-text-muted">{dict.nav.footerTagline}</p>
        </div>
        <nav aria-label={dict.nav.footerLabel} className="flex items-center gap-5 text-sm">
          <Link href={href("/")} className={LINK_CLASS}>
            {dict.nav.home}
          </Link>
          {variant === "app" ? (
            <Link href={href("/dashboard")} className={LINK_CLASS}>
              {dict.nav.dashboard}
            </Link>
          ) : (
            <FooterAuthLink />
          )}
        </nav>
      </div>
    </footer>
  );
}
