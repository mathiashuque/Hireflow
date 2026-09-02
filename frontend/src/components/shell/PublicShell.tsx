import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { AuthNav } from "@/components/AuthNav";

type PublicShellProps = {
  children: React.ReactNode;
  maxWidth?: "md" | "6xl";
};

/** Shared shell for landing/auth/invitation routes: brand header plus a content column. */
export function PublicShell({ children, maxWidth = "6xl" }: PublicShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div
          className={`mx-auto flex w-full items-center justify-between px-4 py-5 sm:px-8 ${maxWidth === "6xl" ? "max-w-6xl" : "max-w-md"}`}
        >
          <Link href="/" className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <BrandMark />
          </Link>
          <AuthNav />
        </div>
      </header>
      <main className={`mx-auto flex w-full flex-1 flex-col px-4 sm:px-8 ${maxWidth === "6xl" ? "max-w-6xl" : "max-w-md"}`}>
        {children}
      </main>
    </div>
  );
}
