import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { FooterAuthLink } from "@/components/shell/FooterAuthLink";

const LINK_CLASS =
  "rounded-sm font-medium text-text-secondary transition hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

type FooterProps = {
  variant: "public" | "app";
};

/** Shared, restrained footer for both shells: brand context plus only real internal destinations. */
export function Footer({ variant }: FooterProps) {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-2">
          <BrandMark withWordmark={false} />
          <p className="text-sm text-text-muted">Hireflow — a focused hiring tracker for modern teams.</p>
        </div>
        <nav aria-label="Footer" className="flex items-center gap-5 text-sm">
          <Link href="/" className={LINK_CLASS}>
            Home
          </Link>
          {variant === "app" ? (
            <Link href="/dashboard" className={LINK_CLASS}>
              Dashboard
            </Link>
          ) : (
            <FooterAuthLink />
          )}
        </nav>
      </div>
    </footer>
  );
}
