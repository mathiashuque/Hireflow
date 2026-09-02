import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  defaultLocale,
  isLocale,
  localeCookieMaxAge,
  localeCookieName,
  negotiateLocaleFromAcceptLanguage,
} from "@/i18n/config";

/**
 * Adds a missing locale prefix to unprefixed application URLs so bookmarks
 * and invitation links never become dead ends. Deliberately lightweight: no
 * authentication, no data fetching, no authorization decisions here — it
 * only decides which locale segment a request should carry.
 *
 * Locale selection order:
 *   1. an existing supported value in the locale preference cookie;
 *   2. `Accept-Language` negotiation (Spanish vs. English only);
 *   3. the default locale (English).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const firstSegment = pathname.split("/")[1];
  if (isLocale(firstSegment)) {
    // Already locale-prefixed: pass through untouched (also prevents redirect loops).
    return NextResponse.next();
  }

  const cookieLocale = request.cookies.get(localeCookieName)?.value;
  const locale =
    cookieLocale && isLocale(cookieLocale)
      ? cookieLocale
      : negotiateLocaleFromAcceptLanguage(request.headers.get("accept-language")) ?? defaultLocale;

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
  redirectUrl.search = search;

  const response = NextResponse.redirect(redirectUrl);
  // Refresh the preference cookie so a negotiated (not yet explicit) locale
  // still becomes "sticky" the same way an explicit switcher choice does.
  response.cookies.set(localeCookieName, locale, {
    maxAge: localeCookieMaxAge,
    path: "/",
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals, static assets, favicon, and any path with a file extension.
    "/((?!_next/|api/|favicon.ico|.*\\..*).*)",
  ],
};
