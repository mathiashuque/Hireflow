import type { Metadata } from "next";
import Link from "next/link";
import { getSiteOrigin } from "@/lib/seo/site-origin";
import { privateRouteMetadata } from "@/lib/seo/landing";
import "./globals.css";

/**
 * Top-level not-found boundary. Used when `app/[lang]/layout.tsx` itself
 * calls `notFound()` for an unsupported locale segment (e.g. `/fr`,
 * `/en-US`) — at that point no locale has been validated, so this renders
 * a minimal, locale-neutral 404 rather than guessing a language.
 */
export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  ...privateRouteMetadata,
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-2 bg-canvas px-4 text-center text-text-primary">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="max-w-sm text-sm text-text-secondary">
          Hireflow supports English (/en) and Spanish (/es). The page you requested doesn&apos;t exist.
        </p>
        <Link href="/en" className="mt-2 text-sm font-medium text-brand hover:underline">
          Go to Hireflow
        </Link>
      </body>
    </html>
  );
}
