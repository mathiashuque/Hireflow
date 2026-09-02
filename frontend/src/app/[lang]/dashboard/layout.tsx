import type { Metadata } from "next";
import { privateRouteMetadata } from "@/lib/seo/landing";

/** Authenticated tenant surface: never indexable, never linked from public metadata. */
export const metadata: Metadata = privateRouteMetadata;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
