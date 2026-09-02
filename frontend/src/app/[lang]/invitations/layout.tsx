import type { Metadata } from "next";
import { privateRouteMetadata } from "@/lib/seo/landing";

/**
 * Covers `/[lang]/invitations/[token]`. Invitation tokens are sensitive, single-use
 * capabilities — this route must never be indexed and no metadata generation here may
 * ever read or echo the token.
 */
export const metadata: Metadata = privateRouteMetadata;

export default function InvitationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
