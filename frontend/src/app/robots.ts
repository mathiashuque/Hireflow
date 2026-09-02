import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { siteUrl } from "@/lib/seo/site-origin";

/**
 * Robots exclusion is a courtesy to well-behaved crawlers, not an access-control
 * mechanism — every disallowed path below is also independently authenticated/authorized
 * on the backend and carries its own `noindex, nofollow` metadata. Keep this list in sync
 * with the nested no-index layouts under `src/app/[lang]`.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = locales.flatMap((locale) => [
    `/${locale}/login`,
    `/${locale}/register`,
    `/${locale}/dashboard`,
    `/${locale}/workspaces/`,
    `/${locale}/invitations/`,
  ]);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
