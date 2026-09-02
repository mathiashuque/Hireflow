import type { Metadata } from "next";
import { privateRouteMetadata } from "@/lib/seo/landing";

/**
 * Covers every `/[lang]/workspaces/**` route (overview, jobs, candidates, members).
 * All of it is authenticated tenant data and must never be indexed.
 */
export const metadata: Metadata = privateRouteMetadata;

export default function WorkspacesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
