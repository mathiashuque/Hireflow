import type { Metadata } from "next";
import { privateRouteMetadata } from "@/lib/seo/landing";

/** Public-but-not-a-search-landing-page: authentication screens must never be indexed. */
export const metadata: Metadata = privateRouteMetadata;

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
