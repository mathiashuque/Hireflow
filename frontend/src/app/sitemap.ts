import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { landingLanguageAlternates, landingPath } from "@/lib/seo/landing";
import { siteUrl } from "@/lib/seo/site-origin";

/**
 * Only the localized marketing landing pages are indexable — see the nested no-index
 * layouts under `src/app/[lang]` for every other route. No `lastModified` is emitted:
 * there is no real, verified content-modification timestamp to report, and manufacturing
 * one on every build would be unverifiable freshness data.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = landingLanguageAlternates();

  return locales.map((locale) => ({
    url: siteUrl(landingPath(locale)),
    alternates: { languages },
  }));
}
