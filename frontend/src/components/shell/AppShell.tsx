import { AppHeader } from "@/components/shell/AppHeader";

const MAX_WIDTH: Record<NonNullable<AppShellProps["maxWidth"]>, string> = {
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
  "2xl": "max-w-7xl",
};

type AppShellProps = {
  children: React.ReactNode;
  maxWidth?: "md" | "lg" | "xl" | "2xl";
};

/** Consistent authenticated shell: persistent header plus a width-constrained content column. */
export function AppShell({ children, maxWidth = "lg" }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className={`mx-auto flex w-full flex-1 flex-col px-4 py-10 sm:px-8 ${MAX_WIDTH[maxWidth]}`}>
        {children}
      </main>
    </div>
  );
}
