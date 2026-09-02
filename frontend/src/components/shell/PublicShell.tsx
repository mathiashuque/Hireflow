import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { AuthNav } from "@/components/AuthNav";
import { Footer } from "@/components/shell/Footer";

type PublicShellProps = {
  children: React.ReactNode;
};

/**
 * Shared shell for landing/auth/invitation routes: brand header, a widescreen content
 * canvas, and a footer. Individual pages compose their own inner panel widths so a
 * split desktop layout and a narrow centered panel can share the same outer canvas.
 */
export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
          <Link
            href="/"
            className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <BrandMark />
          </Link>
          <AuthNav />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-8">{children}</main>
      <Footer variant="public" />
    </div>
  );
}
